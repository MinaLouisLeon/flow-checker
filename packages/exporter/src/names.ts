// File names for the generated docs. Each page, component and flow gets one stable, readable
// name. Names that would collide get a numeric suffix, in model order (which is stable).
import type { AppModel, Component, Flow, Route } from '@flow-checker/shared'

export interface DocNames {
  route: (id: string) => string | undefined
  component: (id: string) => string | undefined
  flow: (id: string) => string | undefined
}

export const README = 'README.md'
export const TYPES = 'types.md'
export const ISSUES = 'issues.md'
export const RECORDED = 'flows/recorded.md'
export const MIDDLEWARE = 'middleware.md'

export function docNames(model: AppModel): DocNames {
  const routes = unique(model.routes, (r) => `pages/${routeSlug(r)}`)
  const counts = new Map<string, number>()
  for (const c of model.components) counts.set(c.name, (counts.get(c.name) ?? 0) + 1)
  const components = unique(model.components, (c) => `components/${componentSlug(c, counts)}`)
  const flows = unique(model.flows, (f) => `flows/${flowSlug(f)}`, [RECORDED])
  return {
    route: (id) => routes.get(id),
    component: (id) => components.get(id),
    flow: (id) => flows.get(id),
  }
}

/** `/` → `index`, `/users/[id]` → `users.[id]`, a slot page gets `.@slot`. */
function routeSlug(route: Route): string {
  const base = route.path === '/' ? 'index' : route.path.slice(1).split('/').join('.')
  const slot = route.slot ? `.@${route.slot}` : ''
  const intercept = route.intercepting ? '.intercepted' : ''
  return safe(`${base}${slot}${intercept}`)
}

/** The name, or the name plus its file when several components share it (`Page`). */
function componentSlug(component: Component, counts: Map<string, number>): string {
  if ((counts.get(component.name) ?? 0) <= 1) return safe(component.name)
  const file = component.file
    .replace(/\.[cm]?[jt]sx?$/, '')
    .split('/')
    .join('.')
  return safe(`${component.name}.${file}`)
}

function flowSlug(flow: Flow): string {
  const slug = flow.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'flow'
}

/** Keeps names valid on every OS. */
function safe(name: string): string {
  return name.replace(/[^\w.@()[\]+-]/g, '_')
}

function unique<T extends { id: string }>(
  items: T[],
  name: (item: T) => string,
  reserved: string[] = [],
): Map<string, string> {
  const out = new Map<string, string>()
  const taken = new Set(reserved.map((r) => r.replace(/\.md$/, '').toLowerCase()))
  for (const item of items) {
    const base = name(item)
    let candidate = base
    for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base}-${n}`
    taken.add(candidate.toLowerCase())
    out.set(item.id, `${candidate}.md`)
  }
  return out
}
