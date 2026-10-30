// M12: the scan reports its phases (CLI progress output). Each phase starts with `done: 0`, counts
// up without going back, and ends with `finished: true` and what it found.
import { join } from 'node:path'
import { InMemoryFileSystemHost } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { createScanSession, SCAN_PHASES, type ScanProgress, scanProject } from '../src'

const fixture = join(import.meta.dirname, '..', '..', '..', 'fixtures', 'basic')

function phasesOf(events: ScanProgress[]) {
  return [...new Set(events.map((e) => e.phase))]
}

function expectWellFormed(events: ScanProgress[]) {
  for (const phase of phasesOf(events)) {
    const own = events.filter((e) => e.phase === phase)
    expect(own[0]?.done, phase).toBe(0)
    expect(own.at(-1)?.finished, phase).toBe(true)
    expect(
      own.filter((e) => e.finished),
      phase,
    ).toHaveLength(1)
    for (let i = 1; i < own.length; i++) {
      expect(own[i]?.done ?? 0, phase).toBeGreaterThanOrEqual(own[i - 1]?.done ?? 0)
    }
    for (const e of own) if (e.total !== undefined) expect(e.done, phase).toBeLessThanOrEqual(e.total)
  }
}

describe('scan progress', () => {
  it('reports every phase in order, with counts and details', () => {
    const events: ScanProgress[] = []
    const model = scanProject({ root: fixture, onProgress: (e) => events.push(e) })

    expect(phasesOf(events)).toEqual([...SCAN_PHASES])
    expectWellFormed(events)

    const detail = (phase: string) => events.find((e) => e.phase === phase && e.finished)?.detail
    const pages = model.routes.filter((r) => r.kind === 'page').length
    expect(detail('discover')).toMatch(/(^|, )app$/)
    expect(detail('load')).toMatch(/^\d[\d,]* files?$/)
    expect(detail('routes')).toBe(
      `${pages} page${pages === 1 ? '' : 's'}, ${model.routes.length - pages} route handler${model.routes.length - pages === 1 ? '' : 's'}`,
    )
    expect(detail('components')).toMatch(new RegExp(`^${model.components.length} components?$`))
    expect(detail('requests')).toMatch(new RegExp(`^${model.requests.length} requests?$`))
    // The components phase counts routes.
    expect(events.find((e) => e.phase === 'components' && e.finished)?.total).toBe(model.routes.length)
  }, 20_000)

  it('reports a re-scan without the discover phase, counting changed files', () => {
    const fs = new InMemoryFileSystemHost()
    fs.writeFileSync('/p/package.json', '{}')
    fs.writeFileSync('/p/app/page.tsx', 'export default function Home() { return null }\n')
    const events: ScanProgress[] = []
    const session = createScanSession({ root: '/p', fileSystem: fs, onProgress: (e) => events.push(e) })

    events.length = 0
    fs.writeFileSync('/p/app/page.tsx', 'export default function Home() { return <main /> }\n')
    session.update({ changed: ['app/page.tsx'] })
    expect(phasesOf(events)).toEqual(['load', 'routes', 'components', 'requests', 'flows'])
    expectWellFormed(events)
    expect(events.find((e) => e.phase === 'load' && e.finished)?.detail).toBe('1 changed file')
  })

  it('keeps scanning when the progress callback throws', () => {
    const fs = new InMemoryFileSystemHost()
    fs.writeFileSync('/p/package.json', '{}')
    fs.writeFileSync('/p/app/page.tsx', 'export default function Home() { return null }\n')
    const model = scanProject({
      root: '/p',
      fileSystem: fs,
      onProgress: () => {
        throw new Error('display broke')
      },
    })
    expect(model.routes.map((r) => r.path)).toEqual(['/'])
  })
})
