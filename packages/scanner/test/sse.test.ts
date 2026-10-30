// Server-sent event patterns (M18) the fixture doesn't cover, scanned from in-memory projects.
import { type AppModel, AppModelSchema, type RequestSite } from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { scanProject } from '../src'

const lines = (...l: string[]) => `${l.join('\n')}\n`

const BASE: Record<string, string> = {
  'package.json': JSON.stringify({ dependencies: { next: '^16.0.0' } }),
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      jsx: 'preserve',
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: true,
      lib: ['dom', 'esnext'],
    },
  }),
  'node_modules/next/package.json': JSON.stringify({ name: 'next' }),
  'app/layout.tsx': 'export default function Root({ children }: { children: unknown }) { return children }\n',
  'lib/types.ts': lines('export interface Tick { n: number }', 'export interface Note { text: string }'),
}

function scan(files: Record<string, string>): AppModel {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries({ ...BASE, ...files })) fs.writeFileSync(`/p/${path}`, text)
  const model = scanProject({ root: '/p', fileSystem: fs })
  expect(() => AppModelSchema.parse(model)).not.toThrow()
  return model
}

const events = (site: RequestSite | undefined) =>
  site?.stream?.events.map((e) => [e.name, e.dataType?.text, e.typeFrom, e.listened])

describe('EventSource sites', () => {
  it('reads listeners on a ref, MessageEvent<T> annotations, withCredentials and an external URL', () => {
    const model = scan({
      'app/page.tsx': lines(
        `'use client'`,
        `import { useEffect, useRef } from 'react'`,
        `import type { Note, Tick } from '../lib/types'`,
        'export default function Page() {',
        '  const ref = useRef<EventSource | null>(null)',
        '  useEffect(() => {',
        `    ref.current = new EventSource('https://events.example.com/feed', { withCredentials: true })`,
        `    ref.current.addEventListener('tick', (e: MessageEvent<Tick>) => console.log(e.data.n))`,
        `    ref.current.addEventListener('note', onNote)`,
        `    ref.current.addEventListener('error', () => {})`,
        '  }, [])',
        '  return null',
        '}',
        'function onNote(event: MessageEvent) {',
        '  const note: Note = JSON.parse(event.data)',
        '  console.log(note)',
        '}',
      ),
    })
    const site = model.requests[0]
    expect(site).toMatchObject({
      transport: 'sse',
      method: 'GET',
      url: { base: 'https://events.example.com', path: '/feed' },
      trigger: { kind: 'effect' },
      stream: { api: 'event-source', withCredentials: true },
      flags: [],
    })
    expect(events(site)).toEqual([
      ['tick', 'Tick', 'code', true],
      ['note', 'Note', 'code', true],
    ])
    expect(model.streams).toBeUndefined()
  })

  it('flags a stream with no event types, and leaves a project class named EventSource alone', () => {
    const model = scan({
      'lib/EventSource.ts': lines('export class EventSource { constructor(public url: string) {} }'),
      'app/page.tsx': lines(
        `'use client'`,
        `import { EventSource as Mine } from '../lib/EventSource'`,
        'export default function Page() {',
        '  const open = () => {',
        `    const s = new EventSource('/api/feed')`,
        '    s.onmessage = (e) => console.log(e.data)',
        `    new Mine('/x')`,
        '  }',
        '  return <button onClick={open}>Open</button>',
        '}',
      ),
    })
    expect(model.requests).toHaveLength(1)
    expect(model.requests[0]).toMatchObject({
      transport: 'sse',
      trigger: { kind: 'event', event: 'onClick' },
      flags: [{ kind: 'unknown-response' }],
    })
    expect(events(model.requests[0])).toEqual([['message', undefined, undefined, true]])
  })
})

describe('event stream route handlers', () => {
  it('reads literal text, a fixed-name helper and lists events the client does not listen to', () => {
    const model = scan({
      'app/api/feed/route.ts': lines(
        `import type { Note } from '../../../lib/types'`,
        'const enc = new TextEncoder()',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source text of the scanned file
        'const note = (data: unknown) => enc.encode(`event: note\\ndata: ${JSON.stringify(data)}\\n\\n`)',
        'export function GET() {',
        '  const stream = new ReadableStream({',
        '    start(c) {',
        `      const first: Note = { text: 'hi' }`,
        '      c.enqueue(note(first))',
        `      c.enqueue(enc.encode('event: bye\\ndata: {}\\n\\n'))`,
        '      c.close()',
        '    },',
        '  })',
        `  return new Response(stream, { headers: { 'content-type': 'text/event-stream' } })`,
        '}',
        `export function POST() { return Response.json({ ok: true }) }`,
      ),
      'app/page.tsx': lines(
        `'use client'`,
        `import { useEffect } from 'react'`,
        'export default function Page() {',
        `  useEffect(() => { const s = new EventSource('/api/feed'); s.addEventListener('note', () => {}) }, [])`,
        '  return null',
        '}',
      ),
    })
    expect(model.streams).toMatchObject([{ method: 'GET', siteIds: [model.requests[0]?.id] }])
    expect(model.streams?.[0]?.events.map((e) => [e.name, e.dataType?.text])).toEqual([
      ['note', 'Note'],
      // Fixed text: no type.
      ['bye', undefined],
    ])
    expect(events(model.requests[0])).toEqual([
      ['note', 'Note', 'handler', true],
      ['bye', undefined, undefined, false],
    ])
  })

  it('turns a plain fetch of an event stream handler into a streamed fetch', () => {
    const model = scan({
      'app/api/feed/route.ts': lines(
        'export function GET() {',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: source text of the scanned file
        '  const body = new ReadableStream({ start(c) { c.enqueue(`data: ${JSON.stringify({ n: 1 })}\\n\\n`) } })',
        `  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })`,
        '}',
      ),
      'app/page.tsx': lines(
        `'use client'`,
        'export default function Page() {',
        `  const go = async () => { const res = await fetch('/api/feed'); const n: number = await res.json() }`,
        '  return <button onClick={go}>Go</button>',
        '}',
      ),
    })
    const site = model.requests[0]
    expect(site?.transport).toBe('sse')
    expect(site?.responseType).toBeUndefined()
    expect(events(site)).toEqual([['message', '{ n: number; }', 'handler', true]])
  })
})
