import { describe, expect, it } from 'vitest'
import {
  type AppModel,
  applyVerification,
  type CapturedBody,
  checkCapture,
  checkValue,
  MODEL_VERSION,
  type RequestSite,
  summarizeTypeChecks,
  type TypeShape,
  typeCheckStatus,
  typeTable,
} from '../src'

const str: TypeShape = { kind: 'primitive', name: 'string' }
const num: TypeShape = { kind: 'primitive', name: 'number' }
const bool: TypeShape = { kind: 'primitive', name: 'boolean' }
const nul: TypeShape = { kind: 'primitive', name: 'null' }
const undef: TypeShape = { kind: 'primitive', name: 'undefined' }
const lit = (value: string | number | boolean): TypeShape => ({ kind: 'literal', value })
const obj = (props: Record<string, TypeShape>, optional: string[] = []): TypeShape => ({
  kind: 'object',
  properties: Object.entries(props).map(([name, type]) => ({
    name,
    type,
    ...(optional.includes(name) ? { optional: true } : {}),
  })),
})
const arr = (element: TypeShape): TypeShape => ({ kind: 'array', element })
const union = (...types: TypeShape[]): TypeShape => ({ kind: 'union', types })
const ref = (typeId: string, name = typeId): TypeShape => ({ kind: 'ref', typeId, name })

const USER = obj({ id: num, name: str, role: union(lit('admin'), lit('member')) })
const types = new Map<string, TypeShape>([['typ_user', USER]])

const check = (value: unknown, shape: TypeShape, redactedPaths: string[] = []) =>
  checkValue(value, shape, { types, root: 'response.body', redactedPaths }).mismatches

describe('checkValue', () => {
  it('accepts data that fits', () => {
    expect(check({ id: 1, name: 'Ada', role: 'admin' }, ref('typ_user'))).toEqual([])
    expect(check([{ id: 1, name: 'Ada', role: 'member' }], arr(ref('typ_user')))).toEqual([])
  })

  it('reports missing, extra, wrong-type and null', () => {
    const shape = obj({ id: num, name: str, email: str, team: obj({ name: str }) })
    expect(check({ id: '7', name: 'Ada', team: null, role: 'admin' }, shape)).toEqual([
      { kind: 'wrong-type', path: 'response.body.id', expected: 'number', actual: 'string "7"' },
      { kind: 'missing-field', path: 'response.body.email', expected: 'string', actual: 'missing' },
      { kind: 'null', path: 'response.body.team', expected: '{ name: string }', actual: 'null' },
      { kind: 'extra-field', path: 'response.body.role', expected: 'not declared', actual: 'string "admin"' },
    ])
  })

  it('treats optional and `| undefined` properties as not required', () => {
    const shape = obj({ a: str, b: union(str, undef) }, ['a'])
    expect(check({}, shape)).toEqual([])
  })

  it('merges array items with the same mismatch into one path with a count', () => {
    const result = check(
      [
        { id: '1', name: 'a', role: 'admin' },
        { id: '2', name: 'b', role: 'admin' },
        { id: 3, name: 'c', role: 'owner' },
      ],
      arr(ref('typ_user')),
    )
    expect(result).toEqual([
      { kind: 'wrong-type', path: 'response.body[].id', expected: 'number', actual: 'string "1"', count: 2 },
      {
        kind: 'wrong-type',
        path: 'response.body[].role',
        expected: '"admin" | "member"',
        actual: 'string "owner"',
      },
    ])
  })

  it('allows null only when the type does', () => {
    expect(check(null, union(ref('typ_user'), nul))).toEqual([])
    expect(check({ a: null }, obj({ a: str }))).toEqual([
      { kind: 'null', path: 'response.body.a', expected: 'string', actual: 'null' },
    ])
  })

  it('reports against the closest union member', () => {
    const ok = obj({ kind: lit('ok'), data: num })
    const fail = obj({ kind: lit('error'), message: str })
    expect(check({ kind: 'error', message: 5 }, union(ok, fail))).toEqual([
      { kind: 'wrong-type', path: 'response.body.message', expected: 'string', actual: 'number 5' },
    ])
    expect(check(true, union(str, num))).toEqual([
      { kind: 'wrong-type', path: 'response.body', expected: 'string | number', actual: 'boolean true' },
    ])
  })

  it('only checks the JSON type of masked values', () => {
    const shape = obj({ token: lit('abc'), pin: lit(1234), code: str })
    const value = { token: '[REDACTED:string]', pin: 0, code: '[REDACTED:string]' }
    expect(check(value, shape, ['response.body.token', 'response.body.pin', 'response.body.code'])).toEqual(
      [],
    )
    expect(check({ code: 0 }, obj({ code: str }), ['response.body.code'])).toEqual([
      { kind: 'wrong-type', path: 'response.body.code', expected: 'string', actual: 'number (masked)' },
    ])
  })

  it('handles index signatures, intersections, tuples, Date and unchecked types', () => {
    const record: TypeShape = {
      kind: 'object',
      properties: [],
      indexSignatures: [{ key: 'string', type: num }],
    }
    expect(check({ a: 1, b: 'x' }, record)).toEqual([
      { kind: 'wrong-type', path: 'response.body.b', expected: 'number', actual: 'string "x"' },
    ])
    const both: TypeShape = { kind: 'intersection', types: [obj({ a: str }), obj({ b: num })] }
    expect(check({ a: 'x', b: 1 }, both)).toEqual([])
    const branded: TypeShape = { kind: 'intersection', types: [str, obj({ __brand: lit('Id') })] }
    expect(check('id_1', branded)).toEqual([])
    const tuple: TypeShape = { kind: 'tuple', elements: [{ type: str }, { type: num }] }
    expect(check(['a', 1, 2], tuple)).toEqual([
      { kind: 'extra-field', path: 'response.body[2]', expected: 'not declared', actual: 'number 2' },
    ])
    expect(check({ at: '2026-01-01T00:00:00Z' }, obj({ at: { kind: 'external', name: 'Date' } }))).toEqual([])
    expect(check({ x: { y: 1 } }, obj({ x: { kind: 'type-parameter', name: 'T' } }))).toEqual([])
    expect(check({ any: 1 }, obj({ any: { kind: 'primitive', name: 'unknown' } }))).toEqual([])
    expect(check({ x: 1 }, obj({}))).toEqual([])
  })
})

const site = (over: Partial<RequestSite> = {}): RequestSite => ({
  id: 'req_1',
  origin: 'component',
  componentId: 'cmp_1',
  transport: 'fetch',
  method: 'POST',
  url: { text: "'/api/users'", confidence: 'exact', path: '/api/users' },
  trigger: { kind: 'event', event: 'onSubmit' },
  bodyType: { text: 'NewUser', shape: obj({ name: str, admin: bool }) },
  responseType: { text: 'User', shape: ref('typ_user', 'User') },
  callStack: [],
  status: 'inferred',
  flags: [],
  ...over,
})

const capture = (request: CapturedBody, status: number, response: CapturedBody) => ({
  request: { body: request },
  response: { status, body: response },
  redactedPaths: [],
})
const json = (value: unknown): CapturedBody => ({ kind: 'json', value })

describe('checkCapture', () => {
  const table = typeTable([
    {
      id: 'typ_user',
      name: 'User',
      declarationKind: 'interface',
      definedAt: { file: 'a.ts', line: 1, column: 1 },
      shape: USER,
    },
  ])

  it('checks the request body and the success response', () => {
    const result = checkCapture(
      capture(json({ name: 'Ada', admin: 'yes' }), 201, json({ id: 1, name: 'Ada', role: 'admin' })),
      site(),
      table,
    )
    expect(result?.parts.map((p) => [p.part, p.status, p.mismatches.length])).toEqual([
      ['request', 'mismatch', 1],
      ['response', 'ok', 0],
    ])
    expect(result && typeCheckStatus(result)).toBe('mismatch')
  })

  it('skips error responses, server action calls and unreadable bodies', () => {
    const error = checkCapture(
      capture(json({ name: 'a', admin: true }), 422, json({ error: 'bad' })),
      site(),
      table,
    )
    expect(error?.parts[1]).toMatchObject({ status: 'skipped', reason: expect.stringContaining('422') })

    const action = checkCapture(
      capture(json([1]), 200, { kind: 'text', value: '0:...' }),
      site({ transport: 'server-action' }),
      table,
    )
    expect(action && typeCheckStatus(action)).toBe('skipped')

    const cut = checkCapture(
      capture({ kind: 'none' }, 200, { kind: 'text', value: '{"id":', truncated: true }),
      site({ bodyType: undefined }),
      table,
    )
    expect(cut?.parts[0]).toMatchObject({ status: 'skipped', reason: expect.stringContaining('cut short') })
  })

  it('accepts an empty body for void responses', () => {
    const result = checkCapture(
      capture({ kind: 'none' }, 204, { kind: 'none' }),
      site({
        bodyType: undefined,
        responseType: { text: 'void', shape: { kind: 'primitive', name: 'void' } },
      }),
      table,
    )
    expect(result?.parts).toEqual([{ part: 'response', type: 'void', status: 'ok', mismatches: [] }])
  })

  it('returns nothing when the site declares no types', () => {
    const none = site({ bodyType: undefined, responseType: undefined })
    expect(checkCapture(capture({ kind: 'none' }, 200, json(1)), none, table)).toBeUndefined()
  })
})

describe('applyVerification', () => {
  const model = (requests: RequestSite[]): AppModel => ({
    version: MODEL_VERSION,
    project: { appDir: 'app' },
    routeTree: { segment: { raw: '', kind: 'static', name: '' }, dir: 'app', files: {}, children: [] },
    routes: [],
    components: [],
    types: [],
    requests,
    navigations: [],
    flows: [],
  })

  it('marks mismatched sites with a type-mismatch flag, and clears it again', () => {
    const typeCheck = summarizeTypeChecks([
      {
        captureId: 'cap_1',
        check: {
          siteId: 'req_1',
          parts: [
            {
              part: 'response',
              type: 'User',
              status: 'mismatch',
              mismatches: [
                { kind: 'wrong-type', path: 'response.body.id', expected: 'number', actual: 'string "1"' },
              ],
            },
          ],
        },
      },
      {
        captureId: 'cap_2',
        check: { siteId: 'req_1', parts: [{ part: 'response', type: 'User', status: 'ok', mismatches: [] }] },
      },
    ])
    const sites = { req_1: { captures: 2, typeCheck }, req_2: { captures: 1 } }
    const served = applyVerification(model([site(), site({ id: 'req_2' })]), { sites })
    expect(served.requests.map((s) => s.status)).toEqual(['mismatch', 'verified'])
    expect(served.requests[0]?.flags).toEqual([
      {
        kind: 'type-mismatch',
        message: `Response doesn't match User: id is string "1" (expected number) (1 of 2 captures).`,
      },
    ])
    // Applying again changes nothing. Without captures, the site goes back to inferred.
    expect(applyVerification(served, { sites })).toBe(served)
    const cleared = applyVerification(served, { sites: {} })
    expect(cleared.requests.map((s) => [s.status, s.flags.length])).toEqual([
      ['inferred', 0],
      ['inferred', 0],
    ])
  })
})
