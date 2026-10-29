import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ExportWriteError, MANIFEST, writeExport } from '../src'

const options = { format: 'md', generatedAt: '2026-10-29T12:00:00.000Z' }
const temp = () => mkdtempSync(join(tmpdir(), 'fc-write-'))

describe('writeExport', () => {
  it('writes the files and a manifest into a new folder', () => {
    const dir = join(temp(), 'docs', 'flow')
    const written = writeExport(dir, { 'README.md': '# a\n', 'pages/index.md': '# b\n' }, options)
    expect(written).toEqual(['README.md', 'pages/index.md'])
    expect(readFileSync(join(dir, 'pages', 'index.md'), 'utf8')).toBe('# b\n')
    expect(JSON.parse(readFileSync(join(dir, MANIFEST), 'utf8'))).toMatchObject({
      format: 'md',
      files: ['README.md', 'pages/index.md'],
    })
  })

  it('replaces its previous export and removes pages that are gone, but nothing else', () => {
    const dir = temp()
    writeExport(dir, { 'README.md': 'v1', 'pages/old.md': 'old', 'pages/kept.md': 'kept' }, options)
    writeFileSync(join(dir, 'NOTES.md'), 'mine')
    writeFileSync(join(dir, 'pages', 'mine.md'), 'mine')
    writeExport(dir, { 'README.md': 'v2', 'pages/kept.md': 'kept 2' }, options)
    expect(readFileSync(join(dir, 'README.md'), 'utf8')).toBe('v2')
    expect(existsSync(join(dir, 'pages', 'old.md'))).toBe(false)
    expect(readFileSync(join(dir, 'pages', 'kept.md'), 'utf8')).toBe('kept 2')
    expect(readFileSync(join(dir, 'NOTES.md'), 'utf8')).toBe('mine')
    expect(readFileSync(join(dir, 'pages', 'mine.md'), 'utf8')).toBe('mine')
  })

  it('removes folders a previous export left empty', () => {
    const dir = temp()
    writeExport(dir, { 'README.md': 'v1', 'flows/a.md': 'a' }, options)
    writeExport(dir, { 'README.md': 'v2' }, options)
    expect(existsSync(join(dir, 'flows'))).toBe(false)
  })

  it("refuses a folder with files it didn't write, unless forced", () => {
    const dir = temp()
    writeFileSync(join(dir, 'index.html'), 'someone else')
    expect(() => writeExport(dir, { 'index.html': 'ours' }, options)).toThrow(ExportWriteError)
    expect(readFileSync(join(dir, 'index.html'), 'utf8')).toBe('someone else')
    writeExport(dir, { 'index.html': 'ours' }, { ...options, force: true })
    expect(readFileSync(join(dir, 'index.html'), 'utf8')).toBe('ours')
  })

  it('accepts an existing empty folder', () => {
    const dir = join(temp(), 'empty')
    mkdirSync(dir)
    expect(writeExport(dir, { 'a.md': 'a' }, options)).toEqual(['a.md'])
  })

  it('never writes or deletes outside the folder', () => {
    const dir = temp()
    expect(() => writeExport(dir, { '../escape.md': 'x' }, options)).toThrow(ExportWriteError)
    const outside = join(dir, '..', `fc-outside-${Date.now()}.md`)
    writeFileSync(outside, 'keep')
    writeFileSync(
      join(dir, MANIFEST),
      JSON.stringify({
        version: 1,
        format: 'md',
        generatedAt: '',
        files: [`../${outside.split(/[\\/]/).pop()}`],
      }),
    )
    writeExport(dir, { 'a.md': 'a' }, options)
    expect(readFileSync(outside, 'utf8')).toBe('keep')
  })
})
