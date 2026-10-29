import { describe, expect, it } from 'vitest'
import { createPathFilter, DEFAULT_EXCLUDE, DEFAULT_INCLUDE, globToRegExp } from '../src'

describe('globs', () => {
  it('matches folders, names and alternatives', () => {
    const match = (glob: string, path: string) => globToRegExp(glob).test(path)
    expect(match('**', 'src/app/page.tsx')).toBe(true)
    expect(match('**/*.test.*', 'page.test.tsx')).toBe(true)
    expect(match('**/*.test.*', 'src/a/b.test.ts')).toBe(true)
    expect(match('src/*.ts', 'src/a/b.ts')).toBe(false)
    expect(match('src/**', 'src/a/b.ts')).toBe(true)
    expect(match('./app/(admin)/**', 'app/(admin)/users/page.tsx')).toBe(true)
    expect(match('**/*.{test,spec}.ts', 'x/y.spec.ts')).toBe(true)
    expect(match('**/__mocks__/**', 'src/__mocks__/api.ts')).toBe(true)
    expect(match('lib/?.ts', 'lib/a.ts')).toBe(true)
  })

  it('scans everything but tests, stories and mocks by default', () => {
    const scanned = createPathFilter(DEFAULT_INCLUDE, DEFAULT_EXCLUDE)
    expect(scanned('src/app/page.tsx')).toBe(true)
    expect(scanned('src/components/Button.stories.tsx')).toBe(false)
    expect(scanned('src/lib/api.spec.ts')).toBe(false)
    expect(scanned('src\\__tests__\\x.ts')).toBe(false)
  })
})
