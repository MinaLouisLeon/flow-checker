// Plain wording (M34): one short explanation for every status, flag, trigger, transport and badge.
// The dashboard tooltips and Glossary screen, the Markdown export (GLOSSARY.md) and the CLI
// (`flow-checker explain`) all read this table, so a word means the same thing everywhere.
import type { EndpointStatus } from './endpoints'
import type { FlowStatus } from './flow-runs'
import type { CaptureMatch } from './match'
import type { Component, Flag, RequestSite, RequestUrl, RouteAccess, Trigger } from './model'
import type { TypeCheckStatus } from './type-check'

export interface GlossaryEntry {
  /** The word or badge as the dashboard shows it, e.g. `needs re-check`. */
  label: string
  /** What it means, in one or two short sentences. Code is written in backticks. */
  means: string
  /** What to do about it, when there is something to do. */
  todo?: string
}

export interface GlossaryGroup<K extends string = string> {
  id: GlossaryGroupId
  title: string
  /** One line about where these words appear. */
  intro: string
  entries: Record<K, GlossaryEntry>
}

export type GlossaryGroupId =
  | 'request-status'
  | 'flag'
  | 'trigger'
  | 'transport'
  | 'request'
  | 'url'
  | 'access'
  | 'flow-status'
  | 'endpoint-status'
  | 'endpoint-side'
  | 'capture'
  | 'type-check'
  | 'component'

const REQUEST_STATUS: GlossaryGroup<RequestSite['status']> = {
  id: 'request-status',
  title: 'Request status',
  intro: 'Whether live capture has seen a request the scan found in the code.',
  entries: {
    inferred: {
      label: 'not seen yet',
      means: 'Found in the code, but no captured request has matched it yet.',
      todo: 'Use the part of the app that sends it while `flow-checker dev` runs.',
    },
    verified: {
      label: '✓ verified',
      means: 'Live capture recorded this request and its data fits the types.',
    },
    'needs-recheck': {
      label: '↻ needs re-check',
      means: 'It was captured before, but the code that sends it changed since.',
      todo: 'Use the app again to capture it with the new code.',
    },
    mismatch: {
      label: '✗ type mismatch',
      means: "Live capture recorded this request, but its data doesn't fit the types in the code.",
      todo: 'Open the request to see which fields differ, then fix the type or the backend.',
    },
  },
}

const FLAG: GlossaryGroup<Flag['kind']> = {
  id: 'flag',
  title: 'Notes on a request',
  intro: 'Gaps the scan or a check found. They are shown as ⚠ (or ℹ for information) on the request.',
  entries: {
    'dynamic-url': {
      label: 'dynamic-url',
      means: 'The URL is built at runtime, so the scan could not tell which endpoint it calls.',
      todo: 'Use the page once with capture on, or add the function that builds it to `apiClients` in the config.',
    },
    'runtime-url': {
      label: 'runtime-url',
      means:
        'The URL comes from data at runtime (a field of an earlier response, a prop). This is information, not a gap.',
      todo: 'Nothing to fix. Capture shows the real URL once the app sends it.',
    },
    'unknown-method': {
      label: 'unknown-method',
      means: 'The HTTP method (GET, POST, …) could not be read from the code.',
      todo: 'Write the method as a literal (`method: "POST"`), or capture the request once.',
    },
    'unknown-response': {
      label: 'unknown-response',
      means: 'No type was found for the data that comes back, so it cannot be checked.',
      todo: 'Add a type: an annotation, a generic (`get<User>()`), a cast or a zod schema.',
    },
    'unknown-trigger': {
      label: 'unknown-trigger',
      means: 'The scan could not tell what starts this request (a page load, a click, …).',
      todo: 'Use the app with capture on to see when it is sent.',
    },
    'type-mismatch': {
      label: 'type-mismatch',
      means: "Captured data doesn't fit the request or response type in the code.",
      todo: 'Open the request to see which fields differ, then fix the type or the backend.',
    },
    stale: {
      label: 'stale',
      means: 'The code changed after the last capture, so older captures may not apply.',
      todo: 'Use the app again to capture the request with the new code.',
    },
    'not-in-collection': {
      label: 'not-in-collection',
      means: 'The imported Postman collection has no request for this call.',
      todo: 'Add the request to the collection, or check that the code calls the right URL.',
    },
    'contract-mismatch': {
      label: 'contract-mismatch',
      means: "The code's type doesn't fit the examples saved in the Postman collection.",
      todo: 'Update the type or the collection examples so they agree.',
    },
    'unused-endpoint': {
      label: 'unused-endpoint',
      means: 'A request in the Postman collection that no code calls.',
      todo: 'Remove it from the collection, or check whether the app should call it.',
    },
  },
}

const TRIGGER: GlossaryGroup<Trigger['kind']> = {
  id: 'trigger',
  title: 'What sends a request',
  intro: 'When a request is sent, as read from the code.',
  entries: {
    'server-render': {
      label: 'server render',
      means: 'Sent on the server while a server component renders, before the page reaches the browser.',
    },
    'page-load': {
      label: 'page load',
      means:
        'Sent when a client component renders: query hooks (`useQuery`, `useSWR`) and render-time calls.',
    },
    effect: {
      label: 'effect',
      means: 'Sent from `useEffect` / `useLayoutEffect`, right after the component appears.',
    },
    event: {
      label: 'event',
      means:
        'Sent when the user does something: a click, a form submit. The badge shows the event (`onClick`).',
    },
    'route-handler': {
      label: 'route handler',
      means: "Sent by one of the app's route handlers (`route.ts`) when something calls it.",
    },
    'server-action': {
      label: 'server action',
      means: 'Sent by a server action (`"use server"`) when a form or the code calls it.',
    },
    middleware: {
      label: 'middleware',
      means: 'Sent by `middleware.ts` / `proxy.ts` before a matching request is handled.',
    },
    unknown: {
      label: 'unknown trigger',
      means: 'The scan could not tell what starts this request.',
      todo: 'Use the app with capture on to see when it is sent.',
    },
  },
}

const TRANSPORT: GlossaryGroup<RequestSite['transport'] | 'http'> = {
  id: 'transport',
  title: 'How a request is sent',
  intro: 'The library or API that sends the request.',
  entries: {
    fetch: { label: 'fetch', means: 'The built-in `fetch()`, directly or through a helper in the project.' },
    axios: { label: 'axios', means: 'The axios HTTP library.' },
    'api-client': {
      label: 'API client',
      means: "A function or method listed in the config's `apiClients` (an SDK or the project's own client).",
    },
    'server-action': {
      label: 'server action',
      means:
        'A call to a server action: Next.js posts to the current page and runs the action on the server.',
    },
    trpc: { label: 'tRPC', means: 'A tRPC procedure call (hooks, `queryOptions()`, the vanilla client).' },
    graphql: { label: 'GraphQL', means: 'A GraphQL operation sent with Apollo, urql or Relay.' },
    sse: {
      label: 'sse',
      means: 'An event stream (server-sent events): `new EventSource()` or a streamed `fetch`.',
    },
    websocket: { label: 'websocket', means: "A WebSocket: `new WebSocket()` or socket.io's `io()`." },
    http: { label: 'HTTP', means: 'A plain HTTP endpoint, called with `fetch`, axios or an API client.' },
  },
}

const REQUEST: GlossaryGroup<'sometimes' | 'warnings' | 'grouped'> = {
  id: 'request',
  title: 'Other request badges',
  intro: 'Extra badges on a request row.',
  entries: {
    sometimes: {
      label: 'sometimes',
      means:
        'Sent only under a condition inside a shared helper (a token refresh before the real request), next to the main request.',
    },
    warnings: {
      label: '⚠ N',
      means: 'The number of notes on this request. Open it to read them.',
    },
    grouped: {
      label: '×N',
      means: 'The same request is sent from N places in the code. Open the row to see each one.',
    },
  },
}

const URL: GlossaryGroup<RequestUrl['confidence']> = {
  id: 'url',
  title: 'How sure the URL is',
  intro: 'How much of a request URL the scan could read.',
  entries: {
    exact: { label: 'exact', means: 'The whole URL was read from the code.' },
    pattern: {
      label: 'pattern',
      means: 'Read from the code, with `:name` placeholders for values only known at runtime (`/users/:id`).',
    },
    unknown: {
      label: 'unknown',
      means: 'The path could not be read from the code.',
      todo: 'Use the page once with capture on, or add the function that builds it to `apiClients` in the config.',
    },
    postman: {
      label: 'from Postman',
      means: "The code didn't say; the path comes from the matching request in the Postman collection.",
    },
  },
}

const ACCESS: GlossaryGroup<RouteAccess['status']> = {
  id: 'access',
  title: 'Page access',
  intro: 'Whether a page can stop a visitor (redirect to a login, show not found), as read from the code.',
  entries: {
    guarded: {
      label: 'guarded',
      means:
        'Something can redirect or stop a visitor before the page shows: middleware, a layout or the page itself.',
      todo: 'Hover the badge or open the page to see the condition and where it sends the visitor.',
    },
    open: { label: 'open', means: 'Nothing in the code redirects or stops a visitor on this page.' },
    unknown: {
      label: 'access ?',
      means: 'The scan could not tell: a check is in code it could not follow (a package, an excluded file).',
      todo: 'Open the page to see what could not be read.',
    },
  },
}

const FLOW_STATUS: GlossaryGroup<FlowStatus['status']> = {
  id: 'flow-status',
  title: 'Flow status',
  intro: 'Whether a flow found in the code has been walked in the running app.',
  entries: {
    unconfirmed: {
      label: 'not walked yet',
      means: 'Found in the code, but nobody has gone through it with capture on.',
      todo: 'Walk it in the app while `flow-checker dev` runs.',
    },
    partial: {
      label: 'partial',
      means: 'Started in the app, but not walked to the end yet.',
      todo: 'Finish the flow in the app.',
    },
    confirmed: { label: '✓ confirmed', means: 'Walked end to end in the app with capture on.' },
  },
}

const ENDPOINT_STATUS: GlossaryGroup<EndpointStatus> = {
  id: 'endpoint-status',
  title: 'Endpoint status',
  intro: 'From the requests that call the endpoint.',
  entries: {
    verified: { label: '✓ verified', means: 'Live capture recorded a call to it.' },
    mismatch: {
      label: '✗ type mismatch',
      means: "Captured data doesn't fit the types of one of its callers.",
      todo: 'Open the endpoint and its calls to see which fields differ.',
    },
    'needs-recheck': {
      label: '↻ needs re-check',
      means: 'The code of a caller changed after the last capture.',
      todo: 'Use the app again to capture it with the new code.',
    },
    'not-captured': {
      label: 'not captured',
      means: 'No call to it has been captured yet.',
      todo: 'Use the part of the app that calls it while `flow-checker dev` runs.',
    },
  },
}

const ENDPOINT_SIDE: GlossaryGroup<'browser' | 'server' | 'both'> = {
  id: 'endpoint-side',
  title: 'Where an endpoint is called from',
  intro: 'Whether the browser can reach the endpoint, or only the server.',
  entries: {
    browser: {
      label: 'browser',
      means: 'Called by code that runs in the browser (client components, form actions).',
    },
    server: {
      label: 'server',
      means: 'Only called by server code: server components, route handlers, server actions, middleware.',
    },
    both: { label: 'browser + server', means: 'Called from the browser and from server code.' },
  },
}

const CAPTURE: GlossaryGroup<CaptureMatch['status'] | 'third-party' | 'stale'> = {
  id: 'capture',
  title: 'Captured requests',
  intro: 'How a request captured from the running app was matched to the code.',
  entries: {
    matched: { label: '✓ matched', means: 'One request in the code clearly fits this capture.' },
    ambiguous: {
      label: '? ambiguous',
      means: 'Several requests in the code fit about equally well.',
      todo: 'Open the capture and pick the right one.',
    },
    unmatched: {
      label: '✗ unmatched',
      means: 'No request in the code fits. Usually something the scan missed.',
      todo: 'Open the capture and pick the request it belongs to, if there is one.',
    },
    'third-party': {
      label: 'third-party',
      means: "Sent by another site's script (an SDK) to its own servers, not by your code.",
    },
    stale: {
      label: 'stale',
      means: 'Taken before the code that sends this request changed.',
      todo: 'Use the app again to capture it with the new code.',
    },
  },
}

const TYPE_CHECK: GlossaryGroup<TypeCheckStatus> = {
  id: 'type-check',
  title: 'Type check of captured data',
  intro: 'Captured data compared with the types in the code.',
  entries: {
    ok: { label: '✓ types', means: 'The captured data fits the types.' },
    mismatch: {
      label: '✗ types',
      means: "The captured data doesn't fit the types.",
      todo: 'Open the capture to see which fields differ.',
    },
    skipped: {
      label: 'types not checked',
      means: 'The data could not be compared: no type, or a body that is not JSON.',
    },
  },
}

const COMPONENT: GlossaryGroup<
  Component['kind'] | 'use-client' | 'conditional' | 'lazy' | 'excluded' | 'unresolved' | 'prop' | 'recursive'
> = {
  id: 'component',
  title: 'Component badges',
  intro: 'Where a component runs and how it is rendered.',
  entries: {
    server: {
      label: 'server',
      means: 'A server component: it runs on the server only, never in the browser.',
    },
    client: {
      label: 'client',
      means:
        "A client component: it runs in the browser. Its file, or one above it, starts with `'use client'`.",
    },
    shared: {
      label: 'shared',
      means: 'Rendered from both server and client components, so it runs in both.',
    },
    'use-client': {
      label: 'use client',
      means: "This file starts with `'use client'`: everything it renders runs in the browser.",
    },
    conditional: {
      label: 'conditional',
      means: 'Only rendered on some paths (behind an `if`, a `&&` or a ternary).',
    },
    lazy: { label: 'lazy', means: 'Loaded on demand with `next/dynamic` or `React.lazy`.' },
    excluded: {
      label: 'excluded',
      means: "In a file the config's `include` / `exclude` leaves out, so the scan didn't read it.",
    },
    unresolved: {
      label: '⚠ unresolved',
      means: 'The scan could not find where this component is defined.',
      todo: 'Check the import path and the `paths` in tsconfig.',
    },
    prop: { label: 'from props', means: 'Passed in by the parent (an `as` or `component` prop).' },
    recursive: { label: 'recursive', means: 'Renders itself (a tree or nested menu); the tree stops here.' },
  },
}

/** Every group, in the order the Glossary screen and GLOSSARY.md list them. */
export const GLOSSARY: readonly GlossaryGroup[] = [
  REQUEST_STATUS,
  FLAG,
  TRIGGER,
  TRANSPORT,
  REQUEST,
  URL,
  ACCESS,
  FLOW_STATUS,
  ENDPOINT_STATUS,
  ENDPOINT_SIDE,
  CAPTURE,
  TYPE_CHECK,
  COMPONENT,
]

const BY_ID = new Map(GLOSSARY.map((g) => [g.id, g]))

/** The entry for one word of a group, e.g. `explain('flag', 'dynamic-url')`. */
export function explain(group: GlossaryGroupId, key: string): GlossaryEntry | undefined {
  const entries = BY_ID.get(group)?.entries
  return entries && Object.hasOwn(entries, key) ? entries[key] : undefined
}

/** Tooltip text: what it means, then what to do, without backticks. */
export function explainTitle(group: GlossaryGroupId, key: string): string | undefined {
  const entry = explain(group, key)
  return entry ? entryText(entry).replaceAll('`', '') : undefined
}

/** What it means, then what to do. */
export function entryText(entry: GlossaryEntry): string {
  return entry.todo ? `${entry.means} ${entry.todo}` : entry.means
}

/** Id of an entry for links and anchors: `flag-dynamic-url`. */
export function termId(group: GlossaryGroupId, key: string): string {
  return `${group}-${key}`
}

export interface GlossaryTerm {
  group: GlossaryGroup
  key: string
  entry: GlossaryEntry
}

/** Every entry, in glossary order. */
export function glossaryTerms(): GlossaryTerm[] {
  return GLOSSARY.flatMap((group) =>
    Object.entries(group.entries).map(([key, entry]) => ({ group, key, entry })),
  )
}

/**
 * Entries whose key or label is the word asked for (`dynamic-url`, `needs re-check`, `verified`),
 * ignoring case, symbols and spaces vs. dashes. The same word can be in several groups.
 */
export function findTerms(word: string): GlossaryTerm[] {
  const q = plain(word)
  if (!q) return []
  const terms = glossaryTerms()
  const exact = terms.filter(
    (t) => plain(t.key) === q || plain(t.entry.label) === q || termId(t.group.id, t.key) === word,
  )
  if (exact.length > 0) return exact
  return terms.filter((t) => plain(t.key).includes(q) || plain(t.entry.label).includes(q))
}

function plain(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Plain text for the CLI: one group per block, or only the given terms. */
export function formatGlossary(terms?: GlossaryTerm[]): string {
  const list = terms ?? glossaryTerms()
  const out: string[] = []
  let group: GlossaryGroup | undefined
  for (const t of list) {
    if (t.group !== group) {
      if (group) out.push('')
      group = t.group
      out.push(`${t.group.title}`)
    }
    const name = t.entry.label === t.key ? t.key : `${t.entry.label} (${t.key})`
    out.push(`  ${name}`)
    out.push(`    ${t.entry.means.replaceAll('`', '')}`)
    if (t.entry.todo) out.push(`    What to do: ${t.entry.todo.replaceAll('`', '')}`)
  }
  return out.join('\n')
}
