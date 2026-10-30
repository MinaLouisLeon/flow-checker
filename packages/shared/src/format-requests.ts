// Plain-text rendering of request sites: used by `flow-checker scan --requests` and snapshot tests.
import type { AppModel, QueryLink, RequestSite, RequestUrl, Trigger } from './model'
import { formatQueryKey } from './query-keys'

export function formatRequests(model: AppModel): string {
  const components = new Map(model.components.map((c) => [c.id, c]))
  const routes = new Map(model.routes.map((r) => [r.id, r]))
  const sites = new Map(model.requests.map((s) => [s.id, s]))

  const groups = new Map<string, RequestSite[]>()
  for (const site of model.requests) {
    const key = originLabel(site)
    const list = groups.get(key)
    if (list) list.push(site)
    else groups.set(key, [site])
  }

  const out: string[] = ['# Requests']
  if (model.requests.length === 0) out.push('', '(none)')
  for (const [origin, list] of groups) {
    out.push('', `## ${origin}`)
    for (const site of list) {
      out.push(siteLine(site))
      if (site.queryKey) out.push(`  key: ${formatQueryKey(site.queryKey)}`)
      if (site.bodyType) out.push(`  body: ${site.bodyType.text}`)
      if (site.responseType) out.push(`  response: ${site.responseType.text}`)
      if (site.targetRouteId)
        out.push(`  handled by: ${routes.get(site.targetRouteId)?.file ?? site.targetRouteId}`)
      for (const id of site.chain ?? []) {
        const next = sites.get(id)
        out.push(`  then: ${next ? requestText(next) : id}`)
      }
      out.push(`  via: ${site.callStack.map((f) => `${f.callee} ${f.file}:${f.line}`).join(' > ')}`)
      for (const flag of site.flags) out.push(`  ⚠ ${flag.kind}: ${flag.message}`)
    }
  }

  if (model.queryLinks.length > 0) {
    out.push('', '# Query cache links')
    for (const link of model.queryLinks) {
      out.push('', linkLine(link))
      for (const id of link.fromSiteIds) {
        const from = sites.get(id)
        out.push(`  after: ${from ? requestText(from) : id}`)
      }
      for (const id of link.targetSiteIds) {
        const target = sites.get(id)
        const owner = target?.componentId ? components.get(target.componentId)?.name : undefined
        out.push(`  hits: ${target ? requestText(target) : id}${owner ? `  (${owner})` : ''}`)
      }
      if (link.targetSiteIds.length === 0) out.push('  hits: (no scanned query)')
    }
  }
  return `${out.join('\n')}\n`

  function linkLine(link: QueryLink): string {
    const owner = link.componentId ? (components.get(link.componentId)?.name ?? '?') : link.origin
    const key = link.key ? formatQueryKey(link.key) : '(all queries)'
    const extra = [link.exact ? 'exact' : '', link.outcome ?? ''].filter(Boolean).join(' ')
    return `${link.kind} ${key}  ${link.method}  ${owner}  ${triggerText(link.trigger)}${extra ? `  ${extra}` : ''}  ${link.loc.file}:${link.loc.line}`
  }

  function originLabel(site: RequestSite): string {
    if (site.origin === 'component') {
      const c = site.componentId ? components.get(site.componentId) : undefined
      return c ? `${c.name}  ${c.file}:${c.loc.line}` : `component ${site.componentId ?? '?'}`
    }
    if (site.origin === 'route-handler') {
      const r = site.routeId ? routes.get(site.routeId) : undefined
      return `route handler ${site.handlerMethod ?? '?'} ${r?.path ?? '?'}  ${r?.file ?? ''}`.trimEnd()
    }
    const a = site.serverAction
    return `server action ${a?.name ?? '?'}  ${a ? `${a.loc.file}:${a.loc.line}` : ''}`.trimEnd()
  }
}

function siteLine(site: RequestSite): string {
  const hook = site.hook ? ` ${site.hook.name}${site.hook.key ? `(${site.hook.key})` : ''}` : ''
  const client = site.client ? ` ${site.client.module}#${site.client.name}` : ''
  return `${requestText(site)}  ${site.transport}${client}${hook}  ${triggerText(site.trigger)}`
}

function requestText(site: RequestSite): string {
  const method = site.method ?? '?'
  if (site.transport === 'server-action') return `${method} server action ${site.serverAction?.name ?? '?'}`
  return `${method} ${site.url ? urlText(site.url) : '?'}`
}

/** `{NEXT_PUBLIC_API_URL ?? http://localhost:4010}/users/:id?x=:y`, or `? <expression>` when unknown. */
export function urlText(url: RequestUrl): string {
  if (url.confidence === 'unknown' && !url.path) return `? ${url.text}`
  const base = url.baseEnv
    ? `{${url.baseEnv}${url.base && url.base !== `{${url.baseEnv}}` ? ` ?? ${url.base}` : ''}}`
    : (url.base ?? '')
  return `${base}${url.path ?? ''}${url.query ? `?${url.query}` : ''}`
}

export function triggerText(trigger: Trigger): string {
  if (trigger.kind === 'event') return trigger.event ? `event ${trigger.event}` : 'event'
  return trigger.kind
}
