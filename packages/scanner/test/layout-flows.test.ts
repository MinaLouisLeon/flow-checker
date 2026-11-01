// M25: a flow that starts in a component a layout renders belongs to every page under the layout.
import { type AppModel, buildIndex } from '@flow-checker/shared'
import { InMemoryFileSystemHost } from 'ts-morph'
import { beforeAll, describe, expect, it } from 'vitest'
import { scanProject } from '../src'

const lines = (...l: string[]) => `${l.join('\n')}\n`

const FILES: Record<string, string> = {
  'package.json': JSON.stringify({ dependencies: { next: '^16.0.0' } }),
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      jsx: 'preserve',
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: true,
      lib: ['dom', 'esnext'],
      paths: { '@/*': ['./src/*'] },
    },
  }),
  'node_modules/next/package.json': JSON.stringify({ name: 'next' }),
  'node_modules/next/navigation.d.ts': lines(
    'export interface Router { push(href: string): void }',
    'export function useRouter(): Router',
  ),
  'src/components/SearchBar.tsx': lines(
    `'use client'`,
    `import { useRouter } from 'next/navigation'`,
    `export function SearchBar() {`,
    `  const router = useRouter()`,
    `  async function search() {`,
    `    await fetch('/api/search', { method: 'POST' })`,
    `    router.push('/dashboard/results')`,
    `  }`,
    `  return <form onSubmit={search} />`,
    `}`,
  ),
  'src/components/Feedback.tsx': lines(
    `'use client'`,
    `export const Feedback = () => <button onClick={() => fetch('/api/feedback', { method: 'POST' })} />`,
  ),
  'src/app/layout.tsx': lines(
    `export default function RootLayout({ children }: { children: unknown }) {`,
    `  return <html><body>{children as never}</body></html>`,
    `}`,
  ),
  'src/app/page.tsx': lines(`export default function Home() { return null }`),
  'src/app/dashboard/layout.tsx': lines(
    `import { SearchBar } from '@/components/SearchBar'`,
    `export default function DashboardLayout({ children }: { children: unknown }) {`,
    `  return <section><SearchBar />{children as never}</section>`,
    `}`,
  ),
  'src/app/dashboard/page.tsx': lines(`export default function Dashboard() { return null }`),
  'src/app/dashboard/settings/page.tsx': lines(
    `import { Feedback } from '@/components/Feedback'`,
    `export default function Settings() { return <Feedback /> }`,
  ),
  'src/app/dashboard/results/page.tsx': lines(`export default function Results() { return null }`),
}

function memoryProject(files: Record<string, string>): InMemoryFileSystemHost {
  const fs = new InMemoryFileSystemHost()
  for (const [path, text] of Object.entries(files)) fs.writeFileSync(`/proj/${path}`, text)
  return fs
}

let model: AppModel
const path = (id: string | undefined) => model.routes.find((r) => r.id === id)?.path

beforeAll(() => {
  model = scanProject({ root: '/proj', fileSystem: memoryProject(FILES) })
})

describe('flows from layout components', () => {
  it("starts at the layout's segment and lists every page under it", () => {
    const flow = model.flows.find((f) => f.name === 'SearchBar submit')
    expect(path(flow?.routeId)).toBe('/dashboard')
    expect(flow?.startRouteIds?.map(path)).toEqual([
      '/dashboard',
      '/dashboard/results',
      '/dashboard/settings',
    ])
  })

  it('shows on every page under the layout', () => {
    const index = buildIndex(model)
    for (const page of ['/dashboard', '/dashboard/settings', '/dashboard/results']) {
      const route = model.routes.find((r) => r.path === page)
      const names = (index.flowsByRoute.get(route?.id ?? '') ?? []).map((f) => f.name)
      expect(names, page).toContain('SearchBar submit')
    }
    const home = model.routes.find((r) => r.path === '/')
    expect((index.flowsByRoute.get(home?.id ?? '') ?? []).map((f) => f.name)).not.toContain(
      'SearchBar submit',
    )
  })

  it("keeps a page's own flow on that page only", () => {
    const flow = model.flows.find((f) => f.name === 'Feedback click')
    expect(path(flow?.routeId)).toBe('/dashboard/settings')
    expect(flow?.startRouteIds).toBeUndefined()
  })
})
