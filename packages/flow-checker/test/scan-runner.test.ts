import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ScanError } from '@flow-checker/scanner'
import { afterEach, describe, expect, it } from 'vitest'
import { createScanRunner } from '../src/cli/scan-runner'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function project() {
  const dir = mkdtempSync(join(tmpdir(), 'flow-checker-runner-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'app', 'about'), { recursive: true })
  writeFileSync(join(dir, 'package.json'), '{}')
  writeFileSync(join(dir, 'app', 'page.tsx'), 'export default function Home() { return null }\n')
  return dir
}

describe('scan runner', () => {
  it('scans, re-scans and writes model.json', async () => {
    const root = project()
    const runner = createScanRunner({ root })
    // From source there is no built worker, so it runs in this thread.
    expect(runner.inWorker).toBe(false)

    const first = await runner.scan()
    expect(first.model.routes.map((r) => r.path)).toEqual(['/'])

    writeFileSync(join(root, 'app', 'about', 'page.tsx'), 'export default function About() { return null }\n')
    const next = await runner.update({ added: ['app/about/page.tsx'] })
    expect(next.model.routes.map((r) => r.path).sort()).toEqual(['/', '/about'])
    const written = JSON.parse(readFileSync(join(root, '.flow-checker', 'model.json'), 'utf8'))
    expect(written.routes).toHaveLength(2)
    await runner.close()
  })

  it('keeps ScanError for a missing app directory, then recovers with a full scan', async () => {
    const root = project()
    const runner = createScanRunner({ root, appDir: 'src/app' })
    await expect(runner.scan()).rejects.toBeInstanceOf(ScanError)

    mkdirSync(join(root, 'src', 'app'), { recursive: true })
    writeFileSync(join(root, 'src', 'app', 'page.tsx'), 'export default function Home() { return null }\n')
    // No session after the failure, so an update scans from scratch.
    const result = await runner.update({ added: ['src/app/page.tsx'] })
    expect(result.model.project.appDir).toBe('src/app')
    await runner.close()
  })
})
