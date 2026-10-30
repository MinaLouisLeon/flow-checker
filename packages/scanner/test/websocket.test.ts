// WebSocket patterns (M19) the fixture doesn't cover, scanned from in-memory projects.
import { type AppModel, AppModelSchema, type RequestSite } from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { describe, expect, it } from 'vitest'
import { scanProject } from '../src'

const lines = (...l: string[]) => `${l.join('\n')}\n`

const BASE: Record<string, string> = {
  'package.json': JSON.stringify({ dependencies: { next: '^16.0.0', 'socket.io-client': '^4.8.0' } }),
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
  // A small stand-in for socket.io-client's typed events.
  'node_modules/socket.io-client/package.json': JSON.stringify({
    name: 'socket.io-client',
    types: 'index.d.ts',
  }),
  'node_modules/socket.io-client/index.d.ts': lines(
    'type Events = Record<string, (...args: any[]) => void>',
    'export interface Socket<L extends Events = Events, E extends Events = Events> {',
    '  on<K extends keyof L & string>(ev: K, fn: L[K]): this',
    '  emit<K extends keyof E & string>(ev: K, ...args: Parameters<E[K]>): this',
    '  disconnect(): this',
    '}',
    'export declare function io(url?: string, opts?: { path?: string; transports?: string[] }): Socket',
    'export declare function io(opts?: { path?: string }): Socket',
    'export default io',
  ),
  'app/layout.tsx': 'export default function Root({ children }: { children: unknown }) { return children }\n',
  'lib/types.ts': lines(
    'export interface Chat { text: string }',
    'export interface Joined { user: string }',
    'export interface Ping { kind: "ping"; at: number }',
    'export interface ServerEvents { chat: (m: Chat) => void; joined: (j: Joined) => void }',
    'export interface ClientEvents { chat: (m: Chat) => void }',
  ),
}

function scan(files: Record<string, string>): AppModel {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries({ ...BASE, ...files })) fs.writeFileSync(`/p/${path}`, text)
  const model = scanProject({ root: '/p', fileSystem: fs })
  expect(() => AppModelSchema.parse(model)).not.toThrow()
  return model
}

const messages = (site: RequestSite | undefined) =>
  site?.socket?.messages.map((m) => [m.direction, m.name, m.dataType?.text])

describe('WebSocket sites', () => {
  it('reads listeners and sends on a ref, used from event handlers, with subprotocols', () => {
    const model = scan({
      'app/page.tsx': lines(
        `'use client'`,
        `import { useEffect, useRef } from 'react'`,
        `import type { Chat, Ping } from '../lib/types'`,
        'export default function Page() {',
        '  const ws = useRef<WebSocket | null>(null)',
        '  useEffect(() => {',
        `    ws.current = new WebSocket('wss://live.example.com/ws', ['v1', 'v2'])`,
        `    ws.current.addEventListener('message', (e) => console.log(JSON.parse(e.data) as Chat))`,
        `    ws.current.addEventListener('close', () => {})`,
        '  }, [])',
        '  const ping = () => {',
        '    const p: Ping = { kind: "ping", at: Date.now() }',
        '    ws.current?.send(JSON.stringify(p))',
        '  }',
        '  return <button onClick={ping}>ping</button>',
        '}',
      ),
    })
    const site = model.requests[0]
    expect(site).toMatchObject({
      transport: 'websocket',
      method: 'GET',
      url: { base: 'wss://live.example.com', path: '/ws' },
      trigger: { kind: 'effect' },
      socket: { api: 'websocket', protocols: ['v1', 'v2'] },
      flags: [],
    })
    expect(site?.responseType).toBeUndefined()
    expect(messages(site)).toEqual([
      ['in', 'message', 'Chat'],
      ['out', 'message', 'Ping'],
    ])
  })

  it('flags a socket without any data type, and ignores a project class named WebSocket', () => {
    const model = scan({
      'app/page.tsx': lines(
        `'use client'`,
        `import { useEffect } from 'react'`,
        'class WebSocket { constructor(public url: string) {} }',
        'export default function Page() {',
        '  useEffect(() => {',
        `    const fake = new WebSocket('/not-a-socket')`,
        `    const ws = new globalThis.WebSocket('/live')`,
        '    ws.onmessage = (e) => console.log(e.data, fake)',
        '  }, [])',
        '  return null',
        '}',
      ),
    })
    expect(model.requests).toHaveLength(1)
    const site = model.requests[0]
    expect(site?.url).toMatchObject({ path: '/live' })
    expect(messages(site)).toEqual([['in', 'message', undefined]])
    expect(site?.flags.map((f) => f.kind)).toEqual(['unknown-response'])
  })
})

describe('socket.io sites', () => {
  it('reads typed events: listeners, emits with an ack, namespaces and reserved events', () => {
    const model = scan({
      'app/page.tsx': lines(
        `'use client'`,
        `import { useEffect } from 'react'`,
        `import { io, type Socket } from 'socket.io-client'`,
        `import type { ClientEvents, ServerEvents } from '../lib/types'`,
        'export default function Page() {',
        '  useEffect(() => {',
        `    const socket: Socket<ServerEvents, ClientEvents> = io('http://localhost:4011/chat', { transports: ['websocket'] })`,
        `    socket.on('connect', () => {})`,
        `    socket.on('chat', (m) => console.log(m.text))`,
        `    socket.on('joined', (j) => console.log(j.user))`,
        `    socket.emit('chat', { text: 'hi' }, () => {})`,
        '    return () => { socket.disconnect() }',
        '  }, [])',
        '  return null',
        '}',
      ),
    })
    const site = model.requests[0]
    expect(site).toMatchObject({
      transport: 'websocket',
      url: { base: 'http://localhost:4011', path: '/socket.io/', confidence: 'exact' },
      socket: { api: 'socket.io', namespace: '/chat' },
      flags: [],
    })
    expect(messages(site)).toEqual([
      ['in', 'chat', 'Chat'],
      ['in', 'joined', 'Joined'],
      ['out', 'chat', 'Chat'],
    ])
  })

  it('connects to the page origin without a URL, and follows options.path', () => {
    const model = scan({
      'app/page.tsx': lines(
        `'use client'`,
        `import { useEffect } from 'react'`,
        `import io from 'socket.io-client'`,
        `import type { Joined } from '../lib/types'`,
        'export default function Page() {',
        '  useEffect(() => {',
        `    const socket = io({ path: '/rt' })`,
        `    socket.on('joined', (j: Joined) => console.log(j))`,
        `    socket.emit('hello', 'there', 2)`,
        '  }, [])',
        '  return null',
        '}',
      ),
    })
    const site = model.requests[0]
    expect(site?.url).toMatchObject({ path: '/rt/', confidence: 'exact' })
    expect(site?.url?.base).toBeUndefined()
    expect(messages(site)).toEqual([
      ['in', 'joined', 'Joined'],
      // Two arguments: no single type.
      ['out', 'hello', undefined],
    ])
  })

  it('finds a socket opened in a helper the component calls', () => {
    const model = scan({
      'lib/live.ts': lines(
        `import { io } from 'socket.io-client'`,
        'export function connect(onJoined: (user: string) => void) {',
        `  const socket = io('http://localhost:4011')`,
        `  socket.on('joined', (j: { user: string }) => onJoined(j.user))`,
        '  return socket',
        '}',
      ),
      'app/page.tsx': lines(
        `'use client'`,
        `import { useEffect } from 'react'`,
        `import { connect } from '../lib/live'`,
        'export default function Page() {',
        '  useEffect(() => {',
        '    const socket = connect(console.log)',
        '    return () => { socket.disconnect() }',
        '  }, [])',
        '  return null',
        '}',
      ),
    })
    expect(model.requests).toHaveLength(1)
    const site = model.requests[0]
    expect(site?.callStack.map((f) => f.callee)).toEqual(['connect', 'io'])
    expect(messages(site)).toEqual([['in', 'joined', '{ user: string }']])
  })
})
