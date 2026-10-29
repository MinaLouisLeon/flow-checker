// Writes a synthetic Next.js App Router project for performance checks (docs/PLAN.md M11).
// Each "feature" has a list page and a detail page (server components that fetch through a
// typed wrapper), a client form with an event-triggered request and navigation, a React-Query
// style hook, a route handler that forwards to the backend, and its own types.
//
//   node scripts/perf/generate-app.mjs <dir> [features=200]
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function generateApp(dir, features = 200) {
  rmSync(dir, { recursive: true, force: true })
  const files = new Map()
  const add = (path, text) => files.set(path, text)

  add(
    'package.json',
    JSON.stringify(
      { name: 'perf-app', private: true, scripts: { dev: 'next dev' }, dependencies: { next: '16.0.0' } },
      null,
      2,
    ),
  )
  add(
    'tsconfig.json',
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          lib: ['dom', 'esnext'],
          strict: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          jsx: 'preserve',
          skipLibCheck: true,
          paths: { '@/*': ['./src/*'] },
        },
        include: ['src'],
      },
      null,
      2,
    ),
  )
  add(
    'src/lib/api.ts',
    `const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4010'

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, { cache: 'no-store' })
  if (!res.ok) throw new Error(res.statusText)
  return res.json() as Promise<T>
}

export async function apiSend<T, B>(method: 'POST' | 'PUT' | 'DELETE', path: string, body: B): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json() as Promise<T>
}
`,
  )
  add('src/components/ui/index.ts', "export { Button } from './Button'\nexport { Card } from './Card'\n")
  add(
    'src/components/ui/Button.tsx',
    "export function Button(props: { children: React.ReactNode; type?: 'submit' | 'button' }) {\n  return <button type={props.type ?? 'button'}>{props.children}</button>\n}\n",
  )
  add(
    'src/components/ui/Card.tsx',
    'export function Card(props: { title: string; children?: React.ReactNode }) {\n  return (\n    <section>\n      <h2>{props.title}</h2>\n      {props.children}\n    </section>\n  )\n}\n',
  )
  add(
    'src/app/layout.tsx',
    'export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}\n',
  )
  add(
    'src/app/page.tsx',
    `import Link from 'next/link'\n\nexport default function Home() {\n  return (\n    <ul>\n${Array.from({ length: features }, (_, i) => `      <li><Link href="/f${i}">Feature ${i}</Link></li>`).join('\n')}\n    </ul>\n  )\n}\n`,
  )

  for (let i = 0; i < features; i++) {
    const F = `Feature${i}`
    const f = `f${i}`
    add(
      `src/types/${f}.ts`,
      `export interface ${F}Owner {
  id: string
  name: string
  email: string | null
}

export interface ${F}Item {
  id: string
  title: string
  status: 'draft' | 'live' | 'archived'
  tags: string[]
  owner: ${F}Owner
  createdAt: string
  meta?: Record<string, string>
}

export type ${F}Summary = Pick<${F}Item, 'id' | 'title' | 'status'>
export type ${F}Input = Omit<${F}Item, 'id' | 'owner' | 'createdAt'> & { ownerId: string }
`,
    )
    add(
      `src/features/${f}/data.ts`,
      `import { apiGet } from '@/lib/api'
import type { ${F}Item, ${F}Summary } from '@/types/${f}'

export const list${F} = () => apiGet<${F}Summary[]>('/${f}/items')
export const get${F} = (id: string) => apiGet<${F}Item>(\`/${f}/items/\${id}\`)
`,
    )
    add(
      `src/features/${f}/use${F}.ts`,
      `'use client'
import { useEffect, useState } from 'react'
import type { ${F}Summary } from '@/types/${f}'

export function use${F}Search(query: string) {
  const [items, setItems] = useState<${F}Summary[]>([])
  useEffect(() => {
    fetch(\`/api/${f}?q=\${encodeURIComponent(query)}\`)
      .then((res) => res.json() as Promise<${F}Summary[]>)
      .then(setItems)
  }, [query])
  return items
}
`,
    )
    add(
      `src/features/${f}/${F}Form.tsx`,
      `'use client'
import { useRouter } from 'next/navigation'
import { apiSend } from '@/lib/api'
import { Button } from '@/components/ui'
import type { ${F}Input, ${F}Item } from '@/types/${f}'

export function ${F}Form() {
  const router = useRouter()
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const input: ${F}Input = {
      title: String(form.get('title')),
      status: 'draft',
      tags: [],
      ownerId: 'me',
    }
    try {
      const created = await apiSend<${F}Item, ${F}Input>('POST', '/${f}/items', input)
      router.push(\`/${f}/\${created.id}\`)
    } catch {
      router.push('/${f}?error=1')
    }
  }
  return (
    <form onSubmit={onSubmit}>
      <input name="title" />
      <Button type="submit">Create</Button>
    </form>
  )
}
`,
    )
    add(
      `src/features/${f}/${F}Search.tsx`,
      `'use client'
import { useState } from 'react'
import Link from 'next/link'
import { use${F}Search } from './use${F}'

export function ${F}Search() {
  const [query, setQuery] = useState('')
  const items = use${F}Search(query)
  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      {items.map((item) => (
        <Link key={item.id} href={\`/${f}/\${item.id}\`}>
          {item.title}
        </Link>
      ))}
    </div>
  )
}
`,
    )
    add(
      `src/features/${f}/index.ts`,
      `export { ${F}Form } from './${F}Form'\nexport { ${F}Search } from './${F}Search'\nexport * from './data'\n`,
    )
    add(
      `src/app/${f}/page.tsx`,
      `import { Card } from '@/components/ui'
import { ${F}Form, ${F}Search, list${F} } from '@/features/${f}'

export default async function ${F}Page() {
  const items = await list${F}()
  return (
    <Card title="${F}">
      <p>{items.length} items</p>
      <${F}Search />
      <${F}Form />
    </Card>
  )
}
`,
    )
    add(
      `src/app/${f}/[id]/page.tsx`,
      `import { Card } from '@/components/ui'
import { get${F} } from '@/features/${f}'

export default async function ${F}Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await get${F}(id)
  return <Card title={item.title}>{item.owner.name}</Card>
}
`,
    )
    add(
      `src/app/api/${f}/route.ts`,
      `import type { ${F}Summary } from '@/types/${f}'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? ''
  const res = await fetch(\`\${process.env.API_URL}/${f}/search?q=\${q}\`)
  const items = (await res.json()) as ${F}Summary[]
  return Response.json(items)
}
`,
    )
  }

  for (const [path, text] of files) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return files.size
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir, count] = process.argv.slice(2)
  if (!dir) {
    console.error('Usage: node scripts/perf/generate-app.mjs <dir> [features=200]')
    process.exit(1)
  }
  const n = generateApp(resolve(dir), Number(count ?? 200))
  console.log(`Wrote ${n} files to ${resolve(dir)}`)
}
