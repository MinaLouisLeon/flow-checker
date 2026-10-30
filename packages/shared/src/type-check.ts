// Type comparison (M8, docs/PLAN.md 8): a captured request or response body checked against the
// TypeShape the scan found for its request site. The tool server runs it on every matched
// capture and stores the result on the capture (`Capture.typeCheck`).
import { z } from 'zod'
import type { CapturedBody } from './capture'
import { formatTypeShape } from './format-types'
import type { NamedType, RequestSite, TypeProperty, TypeRef, TypeShape } from './model'

/** What the runtime puts in place of a masked string (see the runtime's redaction). */
const REDACTED_STRING = '[REDACTED:string]'
/** Array items checked per array. Mismatches in items share one path (`body[].id`). */
const MAX_ITEMS = 200
const MAX_DEPTH = 64
/** Distinct mismatches kept per part. */
const MAX_MISMATCHES = 50

export const TYPE_MISMATCH_KINDS = [
  /** A required property is not in the data. */
  'missing-field',
  /** The data has a property the type does not declare. */
  'extra-field',
  /** The value has another type, e.g. a string where the type says number. */
  'wrong-type',
  /** The value is `null` where the type does not allow it. */
  'null',
] as const
export const TypeMismatchKindSchema = z.enum(TYPE_MISMATCH_KINDS)
export type TypeMismatchKind = z.infer<typeof TypeMismatchKindSchema>

export const TypeMismatchSchema = z.object({
  kind: TypeMismatchKindSchema,
  /**
   * Where, in the same form as `Capture.redactedPaths`: `response.body.user.email`. Array items
   * share one path: `response.body[].id`.
   */
  path: z.string(),
  /** The declared type, e.g. `number`, `"admin" | "member"`. */
  expected: z.string(),
  /** What the data has, e.g. `string "42"`, `null`, `missing`. */
  actual: z.string(),
  /** Array items with this mismatch, when more than one. */
  count: z.number().int().positive().optional(),
})
export type TypeMismatch = z.infer<typeof TypeMismatchSchema>

export const TypeCheckPartSchema = z.object({
  part: z.enum(['request', 'response']),
  /** The declared type as written, e.g. `User[]`. */
  type: z.string(),
  /** `skipped`: the data could not be checked (see `reason`), e.g. an error response. */
  status: z.enum(['ok', 'mismatch', 'skipped']),
  reason: z.string().optional(),
  mismatches: z.array(TypeMismatchSchema),
  /** More distinct mismatches than were kept. */
  truncated: z.boolean().optional(),
})
export type TypeCheckPart = z.infer<typeof TypeCheckPartSchema>

export const TypeCheckSchema = z.object({
  /** The site the data was checked against (the capture's matched site). */
  siteId: z.string(),
  /** One entry per declared type the site has (request body, response). */
  parts: z.array(TypeCheckPartSchema),
})
export type TypeCheck = z.infer<typeof TypeCheckSchema>

export type TypeCheckStatus = TypeCheckPart['status']

/** `mismatch` if any part has one, `ok` if any part was checked, else `skipped`. */
export function typeCheckStatus(check: TypeCheck): TypeCheckStatus {
  if (check.parts.some((p) => p.status === 'mismatch')) return 'mismatch'
  if (check.parts.some((p) => p.status === 'ok')) return 'ok'
  return 'skipped'
}

/** The parts of a capture the checker reads. */
export interface CheckableCapture {
  request: { body: CapturedBody }
  response?: { status: number; body: CapturedBody }
  redactedPaths: readonly string[]
}

/** Named project types by id, for `ref` shapes. */
export type TypeTable = ReadonlyMap<string, TypeShape>

export function typeTable(types: readonly NamedType[]): TypeTable {
  return new Map(types.map((t) => [t.id, t.shape]))
}

/**
 * Checks a capture's request body and response against the site's declared types.
 * Returns `undefined` when the site declares neither.
 */
export function checkCapture(
  capture: CheckableCapture,
  site: Pick<RequestSite, 'id' | 'transport' | 'bodyType' | 'responseType' | 'hook'>,
  types: TypeTable,
): TypeCheck | undefined {
  const parts: TypeCheckPart[] = []
  if (site.bodyType) parts.push(checkRequest(capture, site, site.bodyType, types))
  if (site.responseType) parts.push(checkResponse(capture, site, site.responseType, types))
  return parts.length > 0 ? { siteId: site.id, parts } : undefined
}

function skipped(part: TypeCheckPart['part'], type: TypeRef, reason: string): TypeCheckPart {
  return { part, type: type.text, status: 'skipped', reason, mismatches: [] }
}

const SERVER_ACTION_REASON = 'Server action calls are encoded by React, not plain JSON.'

function checkRequest(
  capture: CheckableCapture,
  site: Pick<RequestSite, 'transport'>,
  type: TypeRef,
  types: TypeTable,
): TypeCheckPart {
  if (site.transport === 'server-action') return skipped('request', type, SERVER_ACTION_REASON)
  if (site.transport === 'graphql') {
    // The body is `{ query, variables, ... }`: the type is the variables'.
    const payload = capture.request.body.kind === 'json' ? capture.request.body.value : undefined
    if (!isRecord(payload)) return skipped('request', type, 'No GraphQL payload was captured.')
    const value = payload.variables ?? {}
    return checkBody('request', { kind: 'json', value }, type, types, capture.redactedPaths, 'variables')
  }
  return checkBody('request', capture.request.body, type, types, capture.redactedPaths)
}

/** Fields GraphQL clients add to every selection (Apollo's and urql's caches). */
const GRAPHQL_EXTRA = new Set(['__typename'])
/** The Relay compiler also selects `id` wherever the type has one; its generated types leave it out. */
const RELAY_EXTRA = new Set(['__typename', 'id'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function checkResponse(
  capture: CheckableCapture,
  site: Pick<RequestSite, 'transport' | 'hook'>,
  type: TypeRef,
  types: TypeTable,
): TypeCheckPart {
  if (site.transport === 'server-action') return skipped('response', type, SERVER_ACTION_REASON)
  const response = capture.response
  if (!response) return skipped('response', type, 'The request failed before a response arrived.')
  // The declared type describes success. Error bodies have their own shape.
  if (response.status < 200 || response.status >= 300) {
    return skipped(
      'response',
      type,
      `Error response (${response.status}) is not checked against the success type.`,
    )
  }
  if (site.transport === 'graphql') {
    // `{ data, errors }`: the type is `data`. GraphQL errors come with status 200.
    const result = response.body.kind === 'json' ? response.body.value : undefined
    if (!isRecord(result)) return checkBody('response', response.body, type, types, capture.redactedPaths)
    const errors = Array.isArray(result.errors) ? result.errors : []
    if (result.data === undefined || result.data === null) {
      const first = errors[0]
      const message = isRecord(first) && typeof first.message === 'string' ? `: ${first.message}` : ''
      return skipped('response', type, `GraphQL error${message}`)
    }
    return checkBody(
      'response',
      { kind: 'json', value: result.data },
      type,
      types,
      capture.redactedPaths,
      'data',
      site.hook && /relay/.test(site.hook.module) ? RELAY_EXTRA : GRAPHQL_EXTRA,
    )
  }
  return checkBody('response', response.body, type, types, capture.redactedPaths)
}

function checkBody(
  part: TypeCheckPart['part'],
  body: CapturedBody,
  type: TypeRef,
  types: TypeTable,
  redactedPaths: readonly string[],
  /** GraphQL: the property of the body that holds the value (`variables`, `data`). */
  inner?: string,
  allowExtra: ReadonlySet<string> = GRAPHQL_EXTRA,
): TypeCheckPart {
  const root = inner ? `${part}.body.${inner}` : `${part}.body`
  let value: unknown
  switch (body.kind) {
    case 'json':
      value = body.value
      break
    case 'none':
      // Nothing to read: fine for `void`, `undefined` and the like.
      if (acceptsEmpty(type.shape, types)) return { part, type: type.text, status: 'ok', mismatches: [] }
      return skipped(part, type, 'No body was captured.')
    case 'text':
      if (body.truncated) return skipped(part, type, 'The body was cut short (capture.maxBodyBytes).')
      value = body.value
      break
    case 'form':
      return skipped(part, type, 'Form data is not compared with types.')
    case 'binary':
      return skipped(part, type, 'Binary content is not compared with types.')
  }
  const result = checkValue(value, type.shape, {
    types,
    root,
    redactedPaths,
    ...(inner ? { allowExtra } : {}),
  })
  return {
    part,
    type: type.text,
    status: result.mismatches.length > 0 ? 'mismatch' : 'ok',
    mismatches: result.mismatches,
    ...(result.truncated ? { truncated: true } : {}),
  }
}

// --- Value checking -------------------------------------------------------------------------

export interface CheckOptions {
  types: TypeTable
  /** Path of the value, e.g. `response.body`. Default: `body`. */
  root?: string
  /** Paths the runtime masked: masked values only need the right JSON type. */
  redactedPaths?: readonly string[]
  /** Property names that may be there without being declared, e.g. GraphQL's `__typename`. */
  allowExtra?: ReadonlySet<string>
}

/** Compares a JSON value with a TypeShape. Mismatches at the same path are merged. */
export function checkValue(
  value: unknown,
  shape: TypeShape,
  options: CheckOptions,
): { mismatches: TypeMismatch[]; truncated: boolean } {
  const checker = new Checker(options.types, options.redactedPaths ?? [], options.allowExtra)
  const raw = checker.check(value, shape, options.root ?? 'body', 0)
  const merged = new Map<string, TypeMismatch>()
  for (const m of raw) {
    // Array items share a path. Tuple positions (`[#1]` while checking) keep theirs.
    const path = m.path.replace(/\[\d+\]/g, '[]').replace(/\[#(\d+)\]/g, '[$1]')
    const key = `${m.kind}\u0000${path}`
    const existing = merged.get(key)
    if (existing) existing.count = (existing.count ?? 1) + 1
    else merged.set(key, { ...m, path })
  }
  const all = [...merged.values()]
  return { mismatches: all.slice(0, MAX_MISMATCHES), truncated: all.length > MAX_MISMATCHES }
}

type Raw = Omit<TypeMismatch, 'count'>

class Checker {
  constructor(
    private readonly types: TypeTable,
    private readonly redacted: readonly string[],
    private readonly allowExtra: ReadonlySet<string> = new Set(),
  ) {}

  check(value: unknown, shape: TypeShape, path: string, depth: number): Raw[] {
    if (depth > MAX_DEPTH) return []
    switch (shape.kind) {
      case 'primitive':
        return this.primitive(value, shape.name, shape, path)
      case 'literal':
        return this.literal(value, shape, path)
      case 'object':
        return this.object(value, shape, path, depth)
      case 'array':
        return this.array(value, shape.element, shape, path, depth)
      case 'tuple':
        return this.tuple(value, shape, path, depth)
      case 'union':
        return this.union(value, shape, path, depth)
      case 'intersection':
        return this.intersection(value, shape, path, depth)
      case 'function':
        // Functions never travel as JSON. A method on a class type is simply not there.
        return value === undefined ? [] : [this.wrong(value, shape, path)]
      case 'ref': {
        const target = this.types.get(shape.typeId)
        return target ? this.check(value, target, path, depth + 1) : []
      }
      case 'external':
        return this.external(value, shape, path, depth)
      case 'type-parameter':
      case 'unresolved':
        return []
    }
  }

  private primitive(value: unknown, name: string, shape: TypeShape, path: string): Raw[] {
    const ok = (() => {
      switch (name) {
        case 'any':
        case 'unknown':
        case 'void':
          return true
        case 'string':
          return typeof value === 'string'
        case 'number':
          return typeof value === 'number'
        case 'boolean':
          return typeof value === 'boolean'
        // JSON has no bigint: APIs send them as numbers or digit strings.
        case 'bigint':
          return typeof value === 'number' || (typeof value === 'string' && /^-?\d+$/.test(value))
        case 'null':
          return value === null
        case 'undefined':
          return value === undefined
        case 'object':
          return typeof value === 'object' && value !== null
        default:
          // `never`, `symbol`: nothing in JSON fits.
          return false
      }
    })()
    return ok ? [] : [this.wrong(value, shape, path)]
  }

  private literal(value: unknown, shape: Extract<TypeShape, { kind: 'literal' }>, path: string): Raw[] {
    if (shape.bigint) {
      const text = String(shape.value).replace(/n$/, '')
      return String(value) === text ? [] : [this.wrong(value, shape, path)]
    }
    if (value === shape.value) return []
    // A masked value only keeps its JSON type.
    if (typeof value === typeof shape.value && (value === REDACTED_STRING || this.isRedacted(path))) return []
    return [this.wrong(value, shape, path)]
  }

  private object(
    value: unknown,
    shape: Extract<TypeShape, { kind: 'object' }>,
    path: string,
    depth: number,
  ): Raw[] {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return [this.wrong(value, shape, path)]
    }
    const record = value as Record<string, unknown>
    const out: Raw[] = []
    const declared = new Set<string>()
    for (const property of shape.properties) {
      declared.add(property.name)
      const child = `${path}.${property.name}`
      const v = record[property.name]
      if (v === undefined) {
        if (!this.required(property)) continue
        out.push({ kind: 'missing-field', path: child, expected: text(property.type), actual: 'missing' })
        continue
      }
      out.push(...this.check(v, property.type, child, depth + 1))
    }
    // `{}` (no members at all) accepts any object.
    const open = shape.truncated || (shape.properties.length === 0 && !shape.indexSignatures?.length)
    for (const [key, v] of Object.entries(record)) {
      if (declared.has(key)) continue
      const child = `${path}.${key}`
      const index =
        shape.indexSignatures?.find((s) => s.key === 'number' && /^-?\d+(\.\d+)?$/.test(key)) ??
        shape.indexSignatures?.find((s) => s.key === 'string')
      if (index) out.push(...this.check(v, index.type, child, depth + 1))
      else if (!open && v !== undefined && !this.allowExtra.has(key)) {
        out.push({
          kind: 'extra-field',
          path: child,
          expected: 'not declared',
          actual: describe(v, this.isRedacted(child)),
        })
      }
    }
    return out
  }

  /** Missing is fine for optional properties, `T | undefined`, `void`, `any`, and methods. */
  private required(property: TypeProperty): boolean {
    if (property.optional) return false
    return !this.acceptsUndefined(property.type, 0)
  }

  private acceptsUndefined(shape: TypeShape, depth: number): boolean {
    if (depth > MAX_DEPTH) return true
    switch (shape.kind) {
      case 'primitive':
        return ['undefined', 'void', 'any', 'unknown'].includes(shape.name)
      case 'union':
        return shape.types.some((t) => this.acceptsUndefined(t, depth + 1))
      case 'function':
      case 'type-parameter':
      case 'unresolved':
        return true
      case 'ref': {
        const target = this.types.get(shape.typeId)
        return target ? this.acceptsUndefined(target, depth + 1) : true
      }
      default:
        return false
    }
  }

  private array(value: unknown, element: TypeShape, shape: TypeShape, path: string, depth: number): Raw[] {
    if (!Array.isArray(value)) return [this.wrong(value, shape, path)]
    const out: Raw[] = []
    for (let i = 0; i < Math.min(value.length, MAX_ITEMS); i++) {
      out.push(...this.check(value[i], element, `${path}[${i}]`, depth + 1))
    }
    return out
  }

  private tuple(
    value: unknown,
    shape: Extract<TypeShape, { kind: 'tuple' }>,
    path: string,
    depth: number,
  ): Raw[] {
    if (!Array.isArray(value)) return [this.wrong(value, shape, path)]
    const out: Raw[] = []
    let i = 0
    for (const element of shape.elements) {
      if (element.rest) {
        const restElement = element.type.kind === 'array' ? element.type.element : element.type
        for (; i < Math.min(value.length, MAX_ITEMS); i++) {
          out.push(...this.check(value[i], restElement, `${path}[#${i}]`, depth + 1))
        }
        return out
      }
      const child = `${path}[#${i}]`
      if (i >= value.length) {
        if (!element.optional)
          out.push({ kind: 'missing-field', path: child, expected: text(element.type), actual: 'missing' })
      } else {
        out.push(...this.check(value[i], element.type, child, depth + 1))
      }
      i++
    }
    for (; i < value.length; i++) {
      out.push({
        kind: 'extra-field',
        path: `${path}[#${i}]`,
        expected: 'not declared',
        actual: describe(value[i], false),
      })
    }
    return out
  }

  private union(
    value: unknown,
    shape: Extract<TypeShape, { kind: 'union' }>,
    path: string,
    depth: number,
  ): Raw[] {
    if (shape.truncated) return []
    const results = shape.types.map((member) => ({
      member,
      mismatches: this.check(value, member, path, depth + 1),
    }))
    if (results.some((r) => r.mismatches.length === 0)) return []
    if (value === null) return [{ kind: 'null', path, expected: text(shape), actual: 'null' }]
    // Report against the member the value is closest to: same JSON kind, matching literal
    // discriminant, then fewest mismatches. If no member has the value's kind, it's a wrong type.
    const kind = jsonKind(value)
    const sameKind = results.filter((r) => this.kindsOf(r.member, 0).has(kind))
    if (sameKind.length === 0) return [this.wrong(value, shape, path)]
    const best = sameKind
      .map((r) => ({ ...r, score: r.mismatches.length - (this.discriminates(value, r.member) ? 1000 : 0) }))
      .sort((a, b) => a.score - b.score)[0]
    // A value that fails at this level (a scalar member) is reported against the whole union.
    if (!best || best.mismatches.every((m) => m.path === path)) return [this.wrong(value, shape, path)]
    return best.mismatches
  }

  /** The value has a property whose literal type in `member` it matches (e.g. `kind: 'a'`). */
  private discriminates(value: unknown, member: TypeShape): boolean {
    const shape = this.resolve(member)
    if (shape?.kind !== 'object' || typeof value !== 'object' || value === null) return false
    const record = value as Record<string, unknown>
    return shape.properties.some((p) => p.type.kind === 'literal' && record[p.name] === p.type.value)
  }

  private intersection(
    value: unknown,
    shape: Extract<TypeShape, { kind: 'intersection' }>,
    path: string,
    depth: number,
  ): Raw[] {
    const members = shape.types.map((t) => this.resolve(t) ?? t)
    // Branded primitives (`string & { __brand: 'Id' }`): the brand is not in the data.
    const scalar = members.filter((m) => m.kind === 'primitive' || m.kind === 'literal')
    if (scalar.length > 0) return scalar.flatMap((m) => this.check(value, m, path, depth + 1))
    // Objects: one object with every member's properties, so no member's fields count as extra.
    const objects = members.filter((m): m is Extract<TypeShape, { kind: 'object' }> => m.kind === 'object')
    const others = members.filter((m) => m.kind !== 'object')
    const out: Raw[] = []
    if (objects.length > 0) {
      const merged: TypeShape = {
        kind: 'object',
        properties: objects.flatMap((o) => o.properties),
        indexSignatures: objects.flatMap((o) => o.indexSignatures ?? []),
        truncated: objects.some((o) => o.truncated) || others.length > 0 || undefined,
      }
      out.push(...this.check(value, merged, path, depth + 1))
    }
    for (const other of others) out.push(...this.check(value, other, path, depth + 1))
    return out
  }

  private external(
    value: unknown,
    shape: Extract<TypeShape, { kind: 'external' }>,
    path: string,
    depth: number,
  ): Raw[] {
    const [arg] = shape.typeArguments ?? []
    switch (shape.name) {
      // JSON.stringify turns a Date into an ISO string.
      case 'Date':
        return typeof value === 'string' || typeof value === 'number' ? [] : [this.wrong(value, shape, path)]
      case 'Promise':
      case 'PromiseLike':
      case 'Awaited':
        return arg ? this.check(value, arg, path, depth + 1) : []
      case 'Array':
      case 'ReadonlyArray':
        return arg ? this.array(value, arg, shape, path, depth) : []
      case 'String':
        return typeof value === 'string' ? [] : [this.wrong(value, shape, path)]
      case 'Number':
        return typeof value === 'number' ? [] : [this.wrong(value, shape, path)]
      case 'Boolean':
        return typeof value === 'boolean' ? [] : [this.wrong(value, shape, path)]
      default:
        // Package types (`Blob`, `FormData`, a library's response type, ...): not checked.
        return []
    }
  }

  /** JSON kinds a shape can hold, to pick the union member a value was meant to be. */
  private kindsOf(shape: TypeShape, depth: number): Set<string> {
    const all = new Set(['string', 'number', 'boolean', 'null', 'array', 'object'])
    if (depth > MAX_DEPTH) return all
    switch (shape.kind) {
      case 'primitive':
        switch (shape.name) {
          case 'string':
          case 'number':
          case 'boolean':
          case 'null':
          case 'object':
            return new Set(shape.name === 'object' ? ['object', 'array'] : [shape.name])
          case 'bigint':
            return new Set(['number', 'string'])
          case 'any':
          case 'unknown':
          case 'void':
            return all
          default:
            return new Set()
        }
      case 'literal':
        return new Set([shape.bigint ? 'number' : typeof shape.value])
      case 'object':
        return new Set(['object'])
      case 'array':
      case 'tuple':
        return new Set(['array'])
      case 'union':
      case 'intersection':
        return new Set(shape.types.flatMap((t) => [...this.kindsOf(t, depth + 1)]))
      case 'ref': {
        const target = this.types.get(shape.typeId)
        return target ? this.kindsOf(target, depth + 1) : all
      }
      case 'external':
        if (shape.name === 'Date') return new Set(['string', 'number'])
        if (shape.name === 'Array' || shape.name === 'ReadonlyArray') return new Set(['array'])
        return all
      case 'function':
        return new Set()
      default:
        return all
    }
  }

  private resolve(shape: TypeShape): TypeShape | undefined {
    let current: TypeShape | undefined = shape
    for (let i = 0; current?.kind === 'ref' && i < MAX_DEPTH; i++) current = this.types.get(current.typeId)
    return current
  }

  private wrong(value: unknown, shape: TypeShape, path: string): Raw {
    if (value === null) return { kind: 'null', path, expected: text(shape), actual: 'null' }
    return { kind: 'wrong-type', path, expected: text(shape), actual: describe(value, this.isRedacted(path)) }
  }

  private isRedacted(path: string): boolean {
    const plain = path.replace(/\[#(\d+)\]/g, '[$1]')
    return this.redacted.some((r) => plain === r || plain.startsWith(`${r}.`) || plain.startsWith(`${r}[`))
  }
}

function acceptsEmpty(shape: TypeShape, types: TypeTable): boolean {
  const resolved = shape.kind === 'ref' ? types.get(shape.typeId) : shape
  if (!resolved) return true
  switch (resolved.kind) {
    case 'primitive':
      return ['void', 'undefined', 'null', 'any', 'unknown', 'never'].includes(resolved.name)
    case 'union':
      return resolved.types.some((t) => acceptsEmpty(t, types))
    case 'external': {
      const [arg] = resolved.typeArguments ?? []
      if ((resolved.name === 'Promise' || resolved.name === 'PromiseLike') && arg)
        return acceptsEmpty(arg, types)
      return resolved.name !== 'Date'
    }
    case 'type-parameter':
    case 'unresolved':
      return true
    default:
      return false
  }
}

function jsonKind(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

const MAX_TEXT = 80

function text(shape: TypeShape): string {
  const out = formatTypeShape(shape)
  return out.length > MAX_TEXT ? `${out.slice(0, MAX_TEXT - 1)}…` : out
}

/** Short description of a value, e.g. `string "Ada"`, `number 3`, `array (2 items)`. */
function describe(value: unknown, redacted: boolean): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `array (${value.length} item${value.length === 1 ? '' : 's'})`
  switch (typeof value) {
    case 'string': {
      if (redacted || value === REDACTED_STRING) return 'string (masked)'
      const shown = value.length > 30 ? `${value.slice(0, 29)}…` : value
      return `string ${JSON.stringify(shown)}`
    }
    case 'number':
    case 'boolean':
      return redacted ? `${typeof value} (masked)` : `${typeof value} ${String(value)}`
    case 'object':
      return 'object'
    default:
      return typeof value
  }
}
