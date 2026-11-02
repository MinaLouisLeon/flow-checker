// M34: every status, flag kind, trigger kind and transport has a plain explanation.
import { describe, expect, it } from 'vitest'
import {
  CaptureMatchSchema,
  ComponentSchema,
  ENDPOINT_STATUSES,
  ENDPOINT_TRANSPORTS,
  explain,
  explainTitle,
  FlagSchema,
  findTerms,
  formatGlossary,
  GLOSSARY,
  type GlossaryGroupId,
  glossaryTerms,
  RequestSiteSchema,
  RequestUrlSchema,
  RouteAccessSchema,
  TriggerSchema,
  TypeCheckPartSchema,
  termId,
} from '../src/index'

// Read from the schemas, so a new value in the model fails here until it is explained.
const COVERED: [GlossaryGroupId, readonly string[]][] = [
  ['request-status', RequestSiteSchema.shape.status.options],
  ['flag', FlagSchema.shape.kind.options],
  ['trigger', TriggerSchema.shape.kind.options],
  ['transport', RequestSiteSchema.shape.transport.options],
  ['transport', ENDPOINT_TRANSPORTS],
  ['url', RequestUrlSchema.shape.confidence.options],
  ['access', RouteAccessSchema.shape.status.options],
  ['flow-status', ['confirmed', 'partial', 'unconfirmed']],
  ['endpoint-status', ENDPOINT_STATUSES],
  ['capture', CaptureMatchSchema.shape.status.options],
  ['type-check', TypeCheckPartSchema.shape.status.options],
  ['component', ComponentSchema.shape.kind.options],
]

describe('glossary', () => {
  for (const [group, values] of COVERED) {
    it(`explains every ${group} value`, () => {
      const missing = values.filter((v) => !explain(group, v))
      expect(missing).toEqual([])
    })
  }

  it('has a label and a plain sentence for every entry', () => {
    for (const { group, key, entry } of glossaryTerms()) {
      const where = `${group.id}:${key}`
      expect(entry.label.trim(), where).not.toBe('')
      expect(entry.means, where).toMatch(/^[A-Z`'"].*[.)]$/s)
      if (entry.todo) expect(entry.todo, where).toMatch(/^[A-Z`'"].*[.)]$/s)
      // Backticks come in pairs, so code spans render.
      expect((entry.means + (entry.todo ?? '')).split('`').length % 2, where).toBe(1)
    }
  })

  it('gives each group a distinct id, title and anchor-safe term ids', () => {
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length)
    expect(new Set(GLOSSARY.map((g) => g.title)).size).toBe(GLOSSARY.length)
    const ids = glossaryTerms().map((t) => termId(t.group.id, t.key))
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  it('says what to do about every flag that asks for a check', () => {
    for (const kind of FlagSchema.shape.kind.options) expect(explain('flag', kind)?.todo, kind).toBeTruthy()
    expect(explain('flag', 'dynamic-url')?.todo).toContain('apiClients')
  })

  it('writes tooltips without backticks', () => {
    expect(explainTitle('flag', 'dynamic-url')).toContain('apiClients in the config')
    expect(explainTitle('flag', 'nope')).toBeUndefined()
    // Object keys like `constructor` are not entries.
    expect(explain('flag', 'constructor')).toBeUndefined()
  })

  it('finds terms by key or label, in every group that has them', () => {
    expect(findTerms('dynamic-url').map((t) => t.group.id)).toEqual(['flag'])
    expect(findTerms('Dynamic URL').map((t) => t.key)).toEqual(['dynamic-url'])
    expect(findTerms('needs re-check').map((t) => t.group.id)).toEqual(['request-status', 'endpoint-status'])
    expect(findTerms('verified').map((t) => t.group.id)).toEqual(['request-status', 'endpoint-status'])
    expect(findTerms('flag-stale').map((t) => t.group.id)).toEqual(['flag'])
    // No exact match: anything containing the word.
    expect(findTerms('mismatch').length).toBeGreaterThan(2)
    expect(findTerms('  ')).toEqual([])
    expect(findTerms('zzz')).toEqual([])
  })

  it('formats terms as plain text', () => {
    const text = formatGlossary(findTerms('dynamic-url'))
    expect(text).toBe(
      [
        'Notes on a request',
        '  dynamic-url',
        '    The URL is built at runtime, so the scan could not tell which endpoint it calls.',
        '    What to do: Use the page once with capture on, or add the function that builds it to apiClients in the config.',
      ].join('\n'),
    )
    const all = formatGlossary()
    for (const group of GLOSSARY) expect(all).toContain(group.title)
  })
})
