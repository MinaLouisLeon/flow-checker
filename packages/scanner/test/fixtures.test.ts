import { resolve } from 'node:path'
import {
  type AppModel,
  AppModelSchema,
  cacheKeyText,
  cacheOf,
  formatFlows,
  formatModel,
  formatRequests,
  formatTypes,
} from '@flow-checker/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import { scanProject } from '../src'

const FIXTURES = [
  'basic',
  'react-query',
  'react-query-v4',
  'server-actions',
  'bff',
  'next-intl',
  'mismatch',
  'middleware',
  'postman',
  'trpc-v10',
  'trpc',
  'graphql-apollo',
  'graphql-apollo-v3',
  'graphql-urql',
  'graphql-relay',
  'sse',
  'websocket',
  'caching',
  'caching-15',
  'boundaries',
  'client-boundaries',
  'leaks',
] as const
const fixturesDir = resolve(import.meta.dirname, '../../../fixtures')

const models = new Map<string, AppModel>()
function scan(fixture: string): AppModel {
  let model = models.get(fixture)
  if (!model) {
    model = scanProject({ root: resolve(fixturesDir, fixture) })
    models.set(fixture, model)
  }
  return model
}

describe.each(FIXTURES)('fixture %s', (fixture) => {
  // A cold scan takes a few seconds, more while every test file runs in parallel.
  beforeAll(() => {
    scan(fixture)
  }, 60_000)

  it('produces a valid model', () => {
    expect(() => AppModelSchema.parse(scan(fixture))).not.toThrow()
  })

  it('matches the route and component tree snapshot', async () => {
    await expect(formatModel(scan(fixture))).toMatchFileSnapshot(`__snapshots__/${fixture}.tree.txt`)
  })

  it('matches the resolved types snapshot', async () => {
    await expect(formatTypes(scan(fixture))).toMatchFileSnapshot(`__snapshots__/${fixture}.types.txt`)
  })

  it('matches the request sites snapshot', async () => {
    await expect(formatRequests(scan(fixture))).toMatchFileSnapshot(`__snapshots__/${fixture}.requests.txt`)
  })

  it('matches the navigation and flows snapshot', async () => {
    await expect(formatFlows(scan(fixture))).toMatchFileSnapshot(`__snapshots__/${fixture}.flows.txt`)
  })

  it('labels every page, and shows a condition for every guarded one (M31)', () => {
    for (const route of scan(fixture).routes) {
      if (route.kind !== 'page') {
        expect(route.access).toBeUndefined()
        continue
      }
      expect(route.access, route.path).toBeDefined()
      if (route.access?.status !== 'guarded') continue
      const shown = route.access.guards.filter((g) => !g.unclear && (g.condition || g.always))
      expect(shown.length, route.path).toBeGreaterThan(0)
    }
  })

  it('gives every page a render mode, with a reason unless it is static (M38)', () => {
    for (const route of scan(fixture).routes) {
      if (route.kind !== 'page') {
        expect(route.render).toBeUndefined()
        continue
      }
      const render = route.render
      expect(render, route.path).toBeDefined()
      if (!render || render.mode === 'static') continue
      const effect = render.mode === 'partial' ? 'dynamic' : render.mode
      expect(
        render.reasons.some((r) => r.effect === effect),
        route.path,
      ).toBe(true)
    }
  })

  it('has no duplicate sites', () => {
    // A twin is the same network call from the same origin, reached once through a path and
    // once through the tail of it (a local function walked in place and through its hook).
    const loc = (f: { file: string; line: number; column: number }) => `${f.file}:${f.line}:${f.column}`
    const origin = (s: AppModel['requests'][number]) =>
      `${s.origin} ${s.componentId ?? ''} ${s.routeId ?? ''} ${s.handlerMethod ?? ''} ${s.serverAction?.name ?? ''}`
    const twins: string[] = []
    const sites = scan(fixture).requests
    for (const a of sites) {
      for (const b of sites) {
        if (a === b || a.callStack.length >= b.callStack.length || origin(a) !== origin(b)) continue
        const tail = b.callStack.slice(b.callStack.length - a.callStack.length).map(loc)
        if (tail.join() === a.callStack.map(loc).join()) twins.push(`${a.id} / ${b.id}`)
      }
    }
    expect(twins).toEqual([])
  })

  it('matches the model snapshot', async () => {
    // The installed Next version changes with upgrades; it is not part of the contract.
    const model = scan(fixture)
    const stable = { ...model, project: { ...model.project, nextVersion: '<next-version>' } }
    await expect(`${JSON.stringify(stable, null, 2)}\n`).toMatchFileSnapshot(
      `__snapshots__/${fixture}.model.json`,
    )
  })
})

// Server cache map (M39): every revalidate call in the caching fixtures links to the expected
// entries and pages, and each flag fires on its planted case only.
describe('server cache map (M39)', () => {
  function links(fixture: string): { entries: string[]; invalidations: string[] } {
    const model = scan(fixture)
    const map = cacheOf(model)
    const path = (id: string) => model.routes.find((r) => r.id === id)?.path ?? id
    const name = new Map(map.entries.map((e) => [e.id, e.name]))
    const flags = (list: { kind: string }[]) => (list.length ? ` !${list.map((f) => f.kind).join(' !')}` : '')
    return {
      entries: map.entries.map(
        (e) =>
          `${e.kind} ${e.name} [${e.tags.map(cacheKeyText).join(', ')}] -> ${[...e.pageIds, ...e.handlerIds]
            .map(path)
            .join(' ')}${flags(e.flags)}`,
      ),
      invalidations: map.invalidations.map(
        (i) =>
          `${i.origin} ${i.api}(${cacheKeyText(i.tag ?? i.path ?? { text: '', confidence: 'unknown' })}) -> ${i.entryIds
            .map((id) => name.get(id))
            .join(', ')} | ${[...i.pageIds, ...i.handlerIds].map(path).join(' ')}${flags(i.flags)}`,
      ),
    }
  }

  it('links the Next 16 fixture (Cache Components)', () => {
    const api = '{API_URL ?? http://localhost:4010}'
    expect(links('caching')).toEqual({
      entries: [
        // Answers 404, so it is never cached at runtime (M40).
        `fetch ${api}/products/featured [] -> /api/featured`,
        `fetch ${api}/todos [stats] -> /api/stats !tag-never-revalidated`,
        'use-cache SiteHeader [nav] -> / /products /settings /todos/[id] /users',
        `fetch ${api}/products [products] -> /products`,
        'use-cache getSettings [settings] -> /settings !tag-never-revalidated',
        'use-cache listTodos [todos] -> /',
        'use-cache getTodo [todo-{id}] -> /todos/[id]',
        'unstable-cache getUsers [users] -> /users',
      ],
      invalidations: [
        'server-action updateTag(todos) -> listTodos | /',
        'server-action revalidatePath(/) ->  | /',
        'server-action updateTag(todo-{id}) -> getTodo | /todos/[id]',
        'server-action revalidatePath(/todos/[id]) ->  | /todos/[id]',
        'server-action revalidateTag(users) -> getUsers | /users',
        'server-action revalidateTag(user) ->  |  !tag-never-set',
        'server-action revalidatePath(/user) ->  |  !path-no-route',
        `route-handler revalidateTag(products) -> ${api}/products | /products`,
        'route-handler revalidateTag(nav) -> SiteHeader | / /products /settings /todos/[id] /users',
        'route-handler revalidatePath(/products) ->  | /products',
        'route-handler updateTag(todos) -> listTodos | / !update-tag-outside-action',
      ],
    })
  })

  it('links the Next 15 fixture (no Cache Components)', () => {
    const api = '{API_URL ?? http://localhost:4010}'
    expect(links('caching-15')).toEqual({
      entries: [
        'unstable-cache listProducts [products] -> /products !tag-never-revalidated',
        `fetch ${api}/products/featured [] -> /products`,
        `fetch ${api}/todos [todos] -> /`,
        `fetch ${api}/todos/:id [todos, todo-{id}] -> /todos/[id]`,
        'unstable-cache getViewer [viewer] -> /profile',
      ],
      invalidations: [
        `server-action revalidateTag(todos) -> ${api}/todos, ${api}/todos/:id | / /todos/[id]`,
        'server-action revalidatePath(/) ->  | /',
        `server-action revalidateTag(todo-{id}) -> ${api}/todos/:id | /todos/[id]`,
        'server-action revalidateTag(product) ->  |  !tag-never-set',
        'server-action revalidatePath(/products) ->  | /products',
        'route-handler revalidateTag(viewer) -> getViewer | /profile',
        'route-handler revalidatePath(/profil) ->  |  !path-no-route',
      ],
    })
  })

  it('labels the caching pages like `next build` does', () => {
    const modes = (fixture: string) =>
      Object.fromEntries(
        scan(fixture)
          .routes.filter((r) => r.kind === 'page')
          .map((r) => [r.path, `${r.render?.mode}${r.render?.revalidate ? ` ${r.render.revalidate}` : ''}`]),
      )
    // Next 16.4 (○ 15m, ○ 5m, ○ 15m, ◐, ○ 1m): the cached header in the root layout is 15 minutes.
    expect(modes('caching')).toEqual({
      '/': 'isr 900',
      '/products': 'isr 300',
      '/settings': 'isr 900',
      '/todos/[id]': 'partial 900',
      '/users': 'isr 60',
    })
    // Next 15.5 (○, ○ 5m, ○ 1d, ƒ).
    expect(modes('caching-15')).toEqual({
      '/': 'static',
      '/products': 'isr 300',
      '/profile': 'isr 86400',
      '/todos/[id]': 'dynamic',
    })
  })
})

describe('special files and boundaries (M41)', () => {
  beforeAll(() => {
    scan('boundaries')
    scan('caching')
  }, 60_000)

  const key = (r: { path: string; slot?: string; intercepting?: unknown }) =>
    `${r.path}${r.slot ? ` @${r.slot}` : ''}${r.intercepting ? ' (intercepting)' : ''}`

  it('flags only the planted gap in the boundaries fixture, which `next build` accepts', () => {
    const gaps = scan('boundaries').routes.flatMap((r) =>
      (r.boundaries?.gaps ?? []).map((g) => `${key(r)}: ${g.kind} ${g.detail} ${g.loc?.file}`),
    )
    expect(gaps).toEqual(['/photos/[id]: no-fallback fetch src/lib/api.ts'])
  })

  it('finds the slots, the intercepting route and their parts', () => {
    const pages = scan('boundaries').routes.filter((r) => r.kind === 'page')
    expect(pages.filter((r) => r.slot || r.intercepting).map(key)).toEqual([
      '/dashboard @stats',
      '/dashboard @team',
      '/dashboard/members @team',
      '/photos/[id] @modal (intercepting)',
    ])
    const dashboard = pages.find((r) => key(r) === '/dashboard')
    expect(dashboard?.boundaries?.items.filter((i) => i.nearest).map((i) => i.kind)).toEqual([
      'not-found',
      'forbidden',
      'unauthorized',
      'loading',
      'error',
    ])
    const reports = pages.find((r) => r.path === '/reports')
    expect(reports?.boundaries?.items.filter((i) => i.in !== 'segment').map((i) => i.kind)).toEqual([
      'suspense',
      'suspense',
      'error-boundary',
    ])
  })

  it('resolves titles like the built pages show them', () => {
    // `<title>` of each page in `next build` / `next start` (16.4.3).
    const titles = Object.fromEntries(
      scan('boundaries')
        .routes.filter((r) => r.kind === 'page' && !r.slot && !r.intercepting)
        .map((r) => [r.path, r.metadata?.title]),
    )
    expect(titles).toEqual({
      '/': 'Boundaries',
      '/account': 'Boundaries',
      '/blog/[slug]': 'Post {slug} | Boundaries',
      '/dashboard': 'Dashboard | Boundaries',
      '/dashboard/settings': 'Settings',
      '/photos': 'Photos | Boundaries',
      '/photos/[id]': 'Photo {id} | Boundaries',
      '/reports': 'Reports',
    })
  })

  it('flags nothing that blocks the caching fixture, which builds with Cache Components', () => {
    const blocking = scan('caching').routes.flatMap((r) =>
      (r.boundaries?.gaps ?? []).filter((g) => g.kind === 'blocking-route').map(() => r.path),
    )
    expect(blocking).toEqual([])
  })
})

describe('client boundaries (M43)', () => {
  beforeAll(() => {
    for (const fixture of FIXTURES) scan(fixture)
  }, 120_000)

  const nameOf = (model: AppModel) => (id: string) => model.components.find((c) => c.id === id)?.name ?? id

  it("finds the boundaries `next build` lists in each page's client reference manifest", () => {
    // `clientModules` of `.next/server/app/<page>_client-reference-manifest.js` (16.4.3).
    const model = scan('client-boundaries')
    const files = Object.fromEntries(
      model.routes
        .filter((r) => r.kind === 'page')
        .map((r) => [
          r.path,
          (r.client?.boundaries ?? []).map((e) => model.components.find((c) => c.id === e.componentId)?.file),
        ]),
    )
    const nav = 'src/components/nav.tsx'
    expect(files).toEqual({
      '/': [
        nav,
        'src/components/counter.tsx',
        'src/components/like-button.tsx',
        'src/components/shell.tsx',
        'src/components/toolbar.tsx',
        'src/components/chart.tsx',
      ],
      '/about': [nav],
      '/cart': [nav, 'src/components/cart.tsx'],
      '/settings': [nav, 'src/app/settings/page.tsx'],
    })
  })

  it('suggests moving only the planted boundary, the way the build accepted it', () => {
    const suggestions = FIXTURES.flatMap((fixture) => {
      const model = scan(fixture)
      const name = nameOf(model)
      return (model.clientBoundaries ?? []).flatMap((b) =>
        b.lower ? [`${fixture}: ${name(b.componentId)} -> ${b.lower.into.map(name).join(', ')}`] : [],
      )
    })
    // Moving `'use client'` from shell.tsx to menu.tsx builds, and Menu becomes the boundary.
    expect(suggestions).toEqual(['client-boundaries: Shell -> Menu'])
  })

  it('brings what the built client chunks hold', () => {
    const model = scan('client-boundaries')
    const cart = model.clientBoundaries?.find((b) => b.file === 'src/components/cart.tsx')
    // The cart chunk holds the row, the price formatter and zod; the home chunk has no price.
    expect(cart?.modules).toEqual([
      'src/components/cart.tsx',
      'src/components/cart-row.tsx',
      'src/components/price.tsx',
      'src/lib/cart-item.ts',
      'src/lib/format.ts',
    ])
    expect(cart?.packages).toEqual(['zod'])
    const home = model.routes.find((r) => r.path === '/')
    expect(home?.client?.packages).toEqual([])
    const price = model.components.find((c) => c.name === 'Price')
    expect(price?.kind).toBe('shared')
  })

  it('gives every page a client part, and every boundary is rendered by a server component', () => {
    for (const fixture of FIXTURES) {
      const model = scan(fixture)
      const byId = new Map(model.components.map((c) => [c.id, c]))
      for (const route of model.routes) {
        if (route.kind !== 'page') {
          expect(route.client).toBeUndefined()
          continue
        }
        expect(route.client, `${fixture} ${route.path}`).toBeDefined()
        for (const edge of route.client?.boundaries ?? []) {
          expect(byId.get(edge.componentId)?.clientBoundary).toBe(true)
          if (edge.parentId) expect(byId.get(edge.parentId)?.kind).not.toBe('client')
        }
      }
    }
  })
})

describe('server/client leaks (M44)', () => {
  beforeAll(() => {
    for (const fixture of FIXTURES) scan(fixture)
  }, 120_000)

  it('flags exactly the pages `next dev` rejects in the leaks fixture, and nothing on the others', () => {
    const found = FIXTURES.flatMap((fixture) => {
      const model = scan(fixture)
      const name = (id: string) => model.components.find((c) => c.id === id)?.name ?? id
      const path = (id: string) => model.routes.find((r) => r.id === id)?.path ?? id
      return (model.leaks ?? []).map((l) =>
        l.kind === 'module'
          ? `${fixture} ${l.routeIds.map(path).join(',')}: ${l.module} in ${l.file} (${l.category})`
          : `${fixture} ${l.routeIds.map(path).join(',')}: ${name(l.parentId)} -> ${l.name}.${l.prop} (${l.value})`,
      )
    })
    // `next dev` (16.4.3) on the fixture: `/` renders; each of these pages fails with the error noted.
    expect(found).toEqual([
      // "You're importing a module that depends on \"revalidatePath\""
      'leaks /admin: next/cache in src/components/refresh-button.tsx (next-server)',
      // "Module not found: Can't resolve 'fs'"
      'leaks /files: fs in src/lib/disk.ts (node)',
      // "You're importing a module that depends on \"server-only\""
      'leaks /keys: server-only in src/lib/keys.ts (server-only)',
      // "You're importing a module that depends on \"next/headers\""
      'leaks /account: next/headers in src/lib/session.ts (next-server)',
      // "Module not found: Can't resolve 'dns'"
      'leaks /stats: pg in src/lib/stats.ts (database)',
      // "Event handlers cannot be passed to Client Component props"
      'leaks /filters: FiltersPage -> FilterBar.config.onChange (function)',
      'leaks /help: HelpPage -> Link.onClick (function)',
      'leaks /products: ProductsPage -> ProductPicker.onSelect (function)',
      // "Only plain objects, and a few built-ins, can be passed to Client Components"
      'leaks /receipt: ReceiptPage -> ReceiptTotal.total (class-instance)',
    ])
  })

  it('gives each module leak the import chain from the boundary', () => {
    const model = scan('leaks')
    const files = (model.leaks ?? []).find((l) => l.kind === 'module' && l.module === 'fs')
    expect(files?.kind === 'module' && files.chain).toEqual([
      'src/components/file-badge.tsx',
      'src/lib/format-size.ts',
      'src/lib/disk.ts',
    ])
  })
})
