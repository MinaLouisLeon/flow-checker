// Plain-text rendering of navigation and inferred flows: `flow-checker scan --flows` and snapshot tests.
import { triggerText, urlText } from './format-requests'
import type { AppModel, FlowStep, Navigation } from './model'

export function formatFlows(model: AppModel): string {
  const components = new Map(model.components.map((c) => [c.id, c]))
  const routes = new Map(model.routes.map((r) => [r.id, r]))
  const sites = new Map(model.requests.map((s) => [s.id, s]))
  const navs = new Map(model.navigations.map((n) => [n.id, n]))
  const routePath = (id: string | undefined) => (id ? (routes.get(id)?.path ?? id) : '?')

  const out: string[] = ['# Navigation']
  if (model.navigations.length === 0) out.push('', '(none)')
  let group = ''
  for (const nav of model.navigations) {
    const owner =
      nav.origin === 'server-action'
        ? `server action ${nav.serverAction?.name ?? '?'}`
        : (components.get(nav.componentId ?? '')?.name ?? 'component')
    const label = `${owner}  ${nav.loc.file}`
    if (label !== group) {
      out.push('', `## ${label}`)
      group = label
    }
    out.push(navLine(nav))
  }

  out.push('', '# Flows')
  if (model.flows.length === 0) out.push('', '(none)')
  for (const flow of model.flows) {
    out.push('', `## ${flow.name}  (${flow.routeIds.map(routePath).join(' -> ') || 'no page'})`)
    flow.steps.forEach((step, i) => {
      out.push(`${i + 1}. ${stepText(step)}`)
      for (const branch of flow.branches.filter((b) => b.after === i)) {
        for (const s of branch.steps) out.push(`   on error: ${stepText(s)}`)
      }
    })
  }
  return `${out.join('\n')}\n`

  function navLine(nav: Navigation): string {
    const target = nav.targetRouteId ? ` -> ${routePath(nav.targetRouteId)}` : ''
    const extra = [
      nav.api === 'next-intl' ? 'next-intl' : '',
      nav.outcome ?? '',
      nav.conditional ? 'conditional' : '',
    ]
      .filter(Boolean)
      .join(' ')
    return `${nav.kind} ${urlText(nav.href)}${target}  ${triggerText(nav.trigger)}${extra ? `  ${extra}` : ''}`
  }

  function stepText(step: FlowStep): string {
    switch (step.kind) {
      case 'interaction': {
        const name = components.get(step.componentId)?.name ?? step.componentId
        return `${name} ${step.event}${step.routeId ? ` on ${routePath(step.routeId)}` : ''}`
      }
      case 'request': {
        const site = sites.get(step.siteId)
        const text = !site
          ? step.siteId
          : site.transport === 'server-action'
            ? `${site.method} server action ${site.serverAction?.name ?? '?'}`
            : `${site.method ?? '?'} ${site.url ? urlText(site.url) : '?'}`
        return `${step.onLoad ? 'load ' : ''}${text}`
      }
      case 'navigate': {
        const nav = navs.get(step.navigationId)
        return `${nav?.kind ?? 'navigate'} -> ${step.routeId ? routePath(step.routeId) : nav ? urlText(nav.href) : '?'}`
      }
    }
  }
}
