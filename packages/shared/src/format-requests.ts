// Plain-text rendering of request sites: used by `flow-checker scan --requests` and snapshot tests.
import type { AppModel, QueryLink, RequestSite, RequestUrl, Trigger } from './model'
import { formatQueryKey, queryLinkTarget } from './query-keys'

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
      if (site.procedure) out.push(`  procedure: ${site.procedure.path} (${site.procedure.type})`)
      if (site.operation)
        out.push(`  operation: ${site.operation.name || '(anonymous)'} (${site.operation.type})`)
      if (site.queryKey) out.push(`  key: ${formatQueryKey(site.queryKey)}`)
      if (site.bodyType) out.push(`  body: ${site.bodyType.text}`)
      if (site.responseType) out.push(`  response: ${site.responseType.text}`)
      if (site.stream) {
        const credentials = site.stream.withCredentials ? ' (with credentials)' : ''
        out.push(`  stream: ${site.stream.api}${credentials}`)
        for (const e of site.stream.events) out.push(`  ${streamEventText(e)}`)
      }
      if (site.socket) {
        const extra = [
          site.socket.namespace ? `namespace ${site.socket.namespace}` : '',
          site.socket.protocols ? `protocols ${site.socket.protocols.join(', ')}` : '',
        ].filter(Boolean)
        out.push(`  socket: ${site.socket.api}${extra.length > 0 ? ` (${extra.join('; ')})` : ''}`)
        for (const m of site.socket.messages) {
          const type = m.dataType ? `: ${m.dataType.text}` : ''
          out.push(`  ${m.direction === 'out' ? 'sends' : 'receives'} ${m.name}${type}`)
        }
      }
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

  const trpc = model.trpc
  if (trpc) {
    const route = trpc.routeId ? routes.get(trpc.routeId) : undefined
    out.push('', '# tRPC', '', `endpoint: ${trpc.endpoint}${route ? `  ${route.file}` : ''}`)
    if (trpc.router) out.push(`router: ${trpc.router.name}  ${trpc.router.loc.file}:${trpc.router.loc.line}`)
    if (trpc.procedures.length === 0) out.push('procedures: (router not found)')
    for (const p of trpc.procedures) {
      const callers = p.siteIds.length === 0 ? 'not called' : `${p.siteIds.length} caller(s)`
      out.push('', `${p.type} ${p.path}  ${callers}  ${p.loc.file}:${p.loc.line}`)
      if (p.inputType) out.push(`  input: ${p.inputType.text}`)
      if (p.outputType) out.push(`  output: ${p.outputType.text}`)
    }
  }

  const streams = model.streams ?? []
  if (streams.length > 0) {
    out.push('', '# Event streams')
    for (const stream of streams) {
      const route = routes.get(stream.routeId)
      const callers = stream.siteIds.length === 0 ? 'not opened' : `${stream.siteIds.length} caller(s)`
      out.push(
        '',
        `${stream.method} ${route?.path ?? '?'}  ${callers}  ${stream.loc.file}:${stream.loc.line}`,
      )
      if (stream.events.length === 0) out.push('  events: (none found)')
      for (const e of stream.events) out.push(`  event ${e.name}${e.dataType ? `: ${e.dataType.text}` : ''}`)
    }
  }

  const graphql = model.graphql
  if (graphql) {
    out.push('', '# GraphQL', '')
    out.push(`endpoint: ${graphql.endpoint ? urlText(graphql.endpoint) : '(not found)'}`)
    for (const c of graphql.clients) {
      const features = [
        c.batching ? 'batching' : '',
        c.persisted ? 'persisted' : '',
        c.getForQueries ? 'GET queries' : '',
      ]
        .filter(Boolean)
        .join(', ')
      out.push(
        `client: ${c.library}${c.endpoint ? ` ${urlText(c.endpoint)}` : ''}${features ? ` (${features})` : ''}  ${c.loc.file}:${c.loc.line}`,
      )
    }
    const schema = graphql.schema
    if (schema) {
      const from = schema.source === 'file' ? schema.path : schema.url
      out.push(
        `schema: ${schema.source} ${from ?? ''}, ${schema.types} types${schema.error ? `  error: ${schema.error}` : ''}`,
      )
    }
    if (graphql.manifest)
      out.push(`manifest: ${graphql.manifest.path}, ${graphql.manifest.operations} operations`)
    for (const op of graphql.operations) {
      const callers = op.siteIds.length === 0 ? 'not sent' : `${op.siteIds.length} caller(s)`
      const from = op.typesFrom ? `  types: ${op.typesFrom}` : ''
      out.push(
        '',
        `${op.type} ${op.name || '(anonymous)'}  ${op.source}  ${callers}${from}  ${op.loc.file}:${op.loc.line}`,
      )
      if (op.fragments.length > 0) out.push(`  fragments: ${op.fragments.join(', ')}`)
      if (op.variablesType) out.push(`  variables: ${op.variablesType.text}`)
      if (op.resultType) out.push(`  data: ${op.resultType.text}`)
      for (const error of op.errors ?? []) out.push(`  error: ${error}`)
    }
    for (const f of graphql.fragments) {
      const users = f.componentIds.map((id) => components.get(id)?.name ?? id)
      out.push('', `fragment ${f.name} on ${f.on}  ${f.loc.file}:${f.loc.line}`)
      if (users.length > 0) out.push(`  read by: ${users.join(', ')}`)
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
    const key =
      link.key || link.procedure !== undefined || link.operation ? queryLinkTarget(link) : '(all queries)'
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
    if (site.origin === 'middleware') return `middleware  ${site.callStack[0]?.file ?? ''}`.trimEnd()
    const a = site.serverAction
    return `server action ${a?.name ?? '?'}  ${a ? `${a.loc.file}:${a.loc.line}` : ''}`.trimEnd()
  }
}

/** `event tick: Tick  (code)`, `event done  not listened to`. */
function streamEventText(e: NonNullable<RequestSite['stream']>['events'][number]): string {
  const type = e.dataType ? `: ${e.dataType.text}  (${e.typeFrom ?? 'code'})` : ''
  return `event ${e.name}${type}${e.listened ? '' : '  not listened to'}`
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
