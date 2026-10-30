// The scan result written to `.flow-checker/model.json` (docs/PLAN.md section 5).
// M1 covers routes and components, M2 request sites, M3 types. Flows are added by a later milestone.
// All file paths are project-relative and use forward slashes.
import { z } from 'zod'
import { MODEL_VERSION } from './constants'

export const SourceLocSchema = z.object({
  file: z.string(),
  /** 1-based. */
  line: z.number().int().positive(),
  /** 1-based. */
  column: z.number().int().positive(),
})
export type SourceLoc = z.infer<typeof SourceLocSchema>

export const SegmentKindSchema = z.enum([
  'static',
  'dynamic',
  'catch-all',
  'optional-catch-all',
  'group',
  'slot',
])
export type SegmentKind = z.infer<typeof SegmentKindSchema>

export const SegmentSchema = z.object({
  /** Directory name as written, e.g. `[id]`, `(marketing)`, `@modal`, `(.)photo`. */
  raw: z.string(),
  kind: SegmentKindSchema,
  /** Param name for dynamic segments, group or slot name, or the static text. */
  name: z.string(),
  /** Interception marker (`(.)`, `(..)`, `(..)(..)`, `(...)`) when the folder intercepts a route. */
  intercept: z.string().optional(),
})
export type Segment = z.infer<typeof SegmentSchema>

export const SPECIAL_FILES = [
  'layout',
  'template',
  'page',
  'route',
  'loading',
  'error',
  'global-error',
  'not-found',
  'forbidden',
  'unauthorized',
  'default',
] as const
export const SpecialFileSchema = z.enum(SPECIAL_FILES)
export type SpecialFile = z.infer<typeof SpecialFileSchema>

export interface RouteTreeNode {
  segment: Segment
  /** Directory, relative to the project root. */
  dir: string
  /** Special files in this directory, by kind. */
  files: Partial<Record<SpecialFile, string>>
  children: RouteTreeNode[]
}
export const RouteTreeNodeSchema: z.ZodType<RouteTreeNode> = z.lazy(() =>
  z.object({
    segment: SegmentSchema,
    dir: z.string(),
    files: z.partialRecord(SpecialFileSchema, z.string()),
    children: z.array(RouteTreeNodeSchema),
  }),
)

export const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const
export const HttpMethodSchema = z.enum(HTTP_METHODS)
export type HttpMethod = z.infer<typeof HttpMethodSchema>

export const LayoutRefSchema = z.object({
  kind: z.enum(['layout', 'template']),
  file: z.string(),
  /** The file's default-export component, when it could be resolved. */
  componentId: z.string().optional(),
})
export type LayoutRef = z.infer<typeof LayoutRefSchema>

export const RouteSchema = z.object({
  id: z.string(),
  /** URL path in Next's bracket form, e.g. `/[locale]/users/[id]`. Groups and slots are left out. */
  path: z.string(),
  kind: z.enum(['page', 'route-handler']),
  /** The `page.*` or `route.*` file. */
  file: z.string(),
  /** Every directory segment from `app/` down, including groups and slots. */
  segments: z.array(SegmentSchema),
  /** Layouts and templates that wrap the page, outermost first. Empty for route handlers. */
  layoutChain: z.array(LayoutRefSchema),
  /** Page: the default-export component. */
  componentId: z.string().optional(),
  /** Route handler: exported HTTP methods. */
  methods: z.array(HttpMethodSchema).optional(),
  /** Set when the page lives inside a parallel route slot (`@name`). */
  slot: z.string().optional(),
  /** Set when the page is an intercepting route. `path` is the URL it intercepts. */
  intercepting: z.object({ marker: z.string(), from: z.string() }).optional(),
})
export type Route = z.infer<typeof RouteSchema>

// ---------------------------------------------------------------------------------------------
// Types (M3, docs/PLAN.md 6.5): TypeScript types resolved into a JSON-friendly IR.
// Named project types (interfaces, aliases, enums, classes declared in the scanned source) are
// stored once in `AppModel.types` and referenced from shapes with `{ kind: 'ref' }`, which also
// keeps recursive types finite. Anonymous types are inlined. Package and lib types (`Date`,
// `Promise<T>`, `ReactNode`, ...) are kept by name as `external`, with their type arguments.

export const PRIMITIVE_TYPES = [
  'string',
  'number',
  'boolean',
  'bigint',
  'symbol',
  'null',
  'undefined',
  'void',
  'never',
  'any',
  'unknown',
  'object',
] as const
export const PrimitiveTypeSchema = z.enum(PRIMITIVE_TYPES)
export type PrimitiveType = z.infer<typeof PrimitiveTypeSchema>

export interface TypeProperty {
  name: string
  type: TypeShape
  optional?: boolean
  readonly?: boolean
}

export interface TupleElement {
  type: TypeShape
  name?: string
  optional?: boolean
  rest?: boolean
}

export interface FunctionParam {
  name: string
  type: TypeShape
  optional?: boolean
  rest?: boolean
}

export type TypeShape =
  | { kind: 'primitive'; name: PrimitiveType }
  /** bigint literals keep their source text in `value`, e.g. `"10n"`. */
  | { kind: 'literal'; value: string | number | boolean; bigint?: boolean }
  | {
      kind: 'object'
      properties: TypeProperty[]
      /** `[key: string]: T` / `[key: number]: T`, e.g. from `Record<string, T>`. */
      indexSignatures?: { key: 'string' | 'number'; type: TypeShape }[]
      /** Some properties were left out because the object is very large. */
      truncated?: boolean
    }
  | { kind: 'array'; element: TypeShape; readonly?: boolean }
  | { kind: 'tuple'; elements: TupleElement[]; readonly?: boolean }
  /** `T | null` is a union with a `null` primitive. Optional properties do not add `undefined`. */
  | { kind: 'union'; types: TypeShape[]; truncated?: boolean }
  /** Only for intersections that are not plain objects, e.g. branded primitives. */
  | { kind: 'intersection'; types: TypeShape[] }
  | { kind: 'function'; params: FunctionParam[]; returns: TypeShape }
  /** A named project type, see `AppModel.types`. */
  | { kind: 'ref'; typeId: string; name: string }
  /** A package or built-in type kept by name, e.g. `Date`, `Promise<User>`, `ReactNode`. */
  | { kind: 'external'; name: string; module?: string; typeArguments?: TypeShape[] }
  /** A generic parameter that is not instantiated here, e.g. `T` inside a generic component. */
  | { kind: 'type-parameter'; name: string }
  /** Expansion stopped (depth limit) or the IR cannot express the type. `text` is the checker's rendering. */
  | { kind: 'unresolved'; text: string; reason: 'depth' | 'unsupported' }

export const TypeShapeSchema: z.ZodType<TypeShape> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('primitive'), name: PrimitiveTypeSchema }),
    z.object({
      kind: z.literal('literal'),
      value: z.union([z.string(), z.number(), z.boolean()]),
      bigint: z.boolean().optional(),
    }),
    z.object({
      kind: z.literal('object'),
      properties: z.array(TypePropertySchema),
      indexSignatures: z
        .array(z.object({ key: z.enum(['string', 'number']), type: TypeShapeSchema }))
        .optional(),
      truncated: z.boolean().optional(),
    }),
    z.object({ kind: z.literal('array'), element: TypeShapeSchema, readonly: z.boolean().optional() }),
    z.object({
      kind: z.literal('tuple'),
      elements: z.array(
        z.object({
          type: TypeShapeSchema,
          name: z.string().optional(),
          optional: z.boolean().optional(),
          rest: z.boolean().optional(),
        }),
      ),
      readonly: z.boolean().optional(),
    }),
    z.object({
      kind: z.literal('union'),
      types: z.array(TypeShapeSchema),
      truncated: z.boolean().optional(),
    }),
    z.object({ kind: z.literal('intersection'), types: z.array(TypeShapeSchema) }),
    z.object({
      kind: z.literal('function'),
      params: z.array(
        z.object({
          name: z.string(),
          type: TypeShapeSchema,
          optional: z.boolean().optional(),
          rest: z.boolean().optional(),
        }),
      ),
      returns: TypeShapeSchema,
    }),
    z.object({ kind: z.literal('ref'), typeId: z.string(), name: z.string() }),
    z.object({
      kind: z.literal('external'),
      name: z.string(),
      module: z.string().optional(),
      typeArguments: z.array(TypeShapeSchema).optional(),
    }),
    z.object({ kind: z.literal('type-parameter'), name: z.string() }),
    z.object({
      kind: z.literal('unresolved'),
      text: z.string(),
      reason: z.enum(['depth', 'unsupported']),
    }),
  ]),
)

export const TypePropertySchema: z.ZodType<TypeProperty> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: TypeShapeSchema,
    optional: z.boolean().optional(),
    readonly: z.boolean().optional(),
  }),
)

export const NamedTypeSchema = z.object({
  id: z.string(),
  /** As written, with type arguments for generic instantiations, e.g. `Page<User>`. */
  name: z.string(),
  declarationKind: z.enum(['interface', 'type-alias', 'enum', 'class']),
  definedAt: SourceLocSchema,
  shape: TypeShapeSchema,
})
export type NamedType = z.infer<typeof NamedTypeSchema>

/** A type used somewhere in the app: the text as written plus its resolved shape. */
export const TypeRefSchema = z.object({
  /** Source text of the annotation, or the checker's rendering when the type was inferred. */
  text: z.string(),
  shape: TypeShapeSchema,
  /** `postman`: not in the code, taken from the Postman collection's saved examples (M15). */
  source: z.literal('postman').optional(),
})
export type TypeRef = z.infer<typeof TypeRefSchema>

export const ComponentRefSchema = z.object({
  /** Tag as written in JSX, e.g. `UserList` or `UI.Button`. */
  name: z.string(),
  /**
   * `project`: a component in the scanned source (see `componentId`).
   * `external`: from a package (see `module`).
   * `unresolved`: the scanner could not find a component declaration.
   * `excluded`: declared in a file the config's `include`/`exclude` leaves out.
   */
  resolution: z.enum(['project', 'external', 'unresolved', 'excluded']),
  componentId: z.string().optional(),
  /** Import specifier the tag came from, when it was imported. */
  module: z.string().optional(),
  /**
   * Package whose factory created the component in project code, e.g. `next-intl/navigation`
   * for `export const { Link } = createNavigation(routing)`. Resolution is then `external`.
   */
  factory: z.string().optional(),
  /** Only rendered on some paths (ternary, `&&`, `if`, early return). */
  conditional: z.boolean().optional(),
  /** Loaded with `next/dynamic` or `React.lazy`. */
  dynamic: z.boolean().optional(),
  /** First place it is rendered. */
  loc: SourceLocSchema,
})
export type ComponentRef = z.infer<typeof ComponentRefSchema>

export const ComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  file: z.string(),
  loc: SourceLocSchema,
  /**
   * `client`: declared in a `'use client'` file, or only ever rendered below one.
   * `server`: only rendered from server components.
   * `shared`: rendered from both sides.
   */
  kind: z.enum(['server', 'client', 'shared']),
  /** The file starts with `'use client'`. */
  clientBoundary: z.boolean(),
  /** Components rendered by this one, in source order, one entry per distinct target. */
  children: z.array(ComponentRefSchema),
  /** Type of the props parameter. Absent when the component takes no props. */
  propsType: TypeRefSchema.optional(),
  /** Ids of named project types referenced in the component's body (not counting `propsType`), in source order. */
  usedTypes: z.array(z.string()),
})
export type Component = z.infer<typeof ComponentSchema>

// ---------------------------------------------------------------------------------------------
// Request sites (M2, docs/PLAN.md 6.4): every place the app sends a request, traced back from
// the network call (fetch, axios, server action) through wrapper functions to the component,
// route handler or server action it runs in, and to what starts it.

export const CallFrameSchema = SourceLocSchema.extend({
  /** The callee as written, e.g. `getUsers`, `api.delete`, `fetch`. */
  callee: z.string(),
})
export type CallFrame = z.infer<typeof CallFrameSchema>

export const RequestUrlSchema = z.object({
  /** The URL expression as written where the request is sent. */
  text: z.string(),
  /**
   * `exact`: fully resolved. `pattern`: resolved with `:param` placeholders for values only
   * known at runtime. `unknown`: the path could not be resolved. `postman`: the code didn't say,
   * the path comes from the matching Postman collection request (M15).
   */
  confidence: z.enum(['exact', 'pattern', 'unknown', 'postman']),
  /** Origin or base URL, e.g. `http://localhost:4010`. Absent for same-origin paths like `/api/x`. */
  base: z.string().optional(),
  /** Environment variable the base comes from, e.g. `NEXT_PUBLIC_API_URL`. `base` is then its fallback. */
  baseEnv: z.string().optional(),
  /** Path pattern, e.g. `/users/:id`. Absent when unknown. */
  path: z.string().optional(),
  /** Query string pattern without `?`, e.g. `userId=:userId`. */
  query: z.string().optional(),
})
export type RequestUrl = z.infer<typeof RequestUrlSchema>

export const TriggerSchema = z.object({
  /**
   * `server-render`: a server component fetching while it renders.
   * `page-load`: a client component on render (query hooks, render-time calls).
   * `effect`: inside `useEffect` / `useLayoutEffect`.
   * `event`: a user interaction, see `event`.
   * `route-handler` / `server-action`: runs when the handler or action is called (second hop).
   * `middleware`: runs in `middleware.ts` / `proxy.ts` before a matching request is handled (M14).
   */
  kind: z.enum([
    'server-render',
    'page-load',
    'effect',
    'event',
    'route-handler',
    'server-action',
    'middleware',
    'unknown',
  ]),
  /** Event prop, e.g. `onSubmit`, `onClick`, or `action` for `<form action={...}>`. */
  event: z.string().optional(),
  /** Where the trigger is: the JSX attribute, the effect call, ... */
  loc: SourceLocSchema.optional(),
})
export type Trigger = z.infer<typeof TriggerSchema>

export const FlagSchema = z.object({
  /**
   * Added by the tool server: `type-mismatch` when captured data doesn't fit the declared types
   * (M8), `stale` when the code changed after the last capture (M9).
   * From a Postman collection (M15): `not-in-collection` (a site the collection has no request
   * for), `contract-mismatch` (the code's type doesn't fit the saved examples) and, on collection
   * requests, `unused-endpoint` (no site calls it).
   */
  kind: z.enum([
    'dynamic-url',
    'unknown-method',
    'unknown-response',
    'unknown-trigger',
    'type-mismatch',
    'stale',
    'not-in-collection',
    'contract-mismatch',
    'unused-endpoint',
  ]),
  message: z.string(),
})
export type Flag = z.infer<typeof FlagSchema>

// ---------------------------------------------------------------------------------------------
// React Query keys and cache links (M13).

/**
 * One segment of a query key. `static`: a literal or constant. `param`: a value only known at
 * runtime (`:id`), matches any one segment. `object`: `{ status: 'open', page: :page }`.
 * `rest`: a spread the scanner could not resolve, matches any number of segments.
 */
export type QueryKeyPart =
  | { kind: 'static'; value: string | number | boolean | null }
  | { kind: 'param'; name: string }
  | { kind: 'object'; entries: { key: string; value: QueryKeyPart }[] }
  | { kind: 'rest'; text: string }

export const QueryKeyPartSchema: z.ZodType<QueryKeyPart> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('static'),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    }),
    z.object({ kind: z.literal('param'), name: z.string() }),
    z.object({
      kind: z.literal('object'),
      entries: z.array(z.object({ key: z.string(), value: QueryKeyPartSchema })),
    }),
    z.object({ kind: z.literal('rest'), text: z.string() }),
  ]),
)

export const ServerActionRefSchema = z.object({
  name: z.string(),
  loc: SourceLocSchema,
})
export type ServerActionRef = z.infer<typeof ServerActionRefSchema>

export const RequestSiteSchema = z.object({
  id: z.string(),
  /** Where the code that sends the request runs. `middleware`: `middleware.ts` / `proxy.ts` (M14). */
  origin: z.enum(['component', 'route-handler', 'server-action', 'middleware']),
  /** Origin `component`: the component. */
  componentId: z.string().optional(),
  /** Origin `route-handler`: the handler's route and exported method. */
  routeId: z.string().optional(),
  handlerMethod: HttpMethodSchema.optional(),
  /** Transport `server-action`: the action called. Origin `server-action`: the action it runs in. */
  serverAction: ServerActionRefSchema.optional(),
  /** `api-client`: a call to a function listed in the config's `apiClients` (see `client`). */
  transport: z.enum(['fetch', 'axios', 'api-client', 'server-action']),
  /** Transport `api-client`: the configured module and the function or method called. */
  client: z.object({ module: z.string(), name: z.string() }).optional(),
  /**
   * Set when a data-fetching hook (or a `queryClient` method such as `prefetchQuery`) runs the
   * request. `key` is the query/SWR key as written.
   */
  hook: z
    .object({
      name: z.string(),
      module: z.string(),
      key: z.string().optional(),
    })
    .optional(),
  /** React Query: the query or mutation key, parsed into segments (M13). */
  queryKey: z.array(QueryKeyPartSchema).optional(),
  /** Absent when it could not be resolved. Server actions are always `POST`. */
  method: HttpMethodSchema.optional(),
  /** Absent for server actions, which post to the current page. */
  url: RequestUrlSchema.optional(),
  trigger: TriggerSchema,
  bodyType: TypeRefSchema.optional(),
  responseType: TypeRefSchema.optional(),
  /** From the call in the origin (outermost) down to the network call. */
  callStack: z.array(CallFrameSchema),
  /** The Postman collection request it calls (M15), see `AppModel.postman`. */
  contract: z
    .object({
      requestId: z.string(),
      /** The request's name in the collection. */
      name: z.string(),
      /** `url`: matched by method and URL. `code`: the URL was unknown and the call's names and method pointed to it. */
      by: z.enum(['url', 'code']),
    })
    .optional(),
  /** For a request to one of the app's route handlers: that route. */
  targetRouteId: z.string().optional(),
  /** Requests this one leads to on the server: route handler (BFF) hops or fetches in the server action. */
  chain: z.array(z.string()).optional(),
  /**
   * Hash of the code that sends the request: the functions on its call path, its URL, method and
   * trigger. Whitespace, comments and line numbers don't count, so moving code doesn't change it.
   * When it changes, captures taken before are stale and the site needs a re-check (M9).
   */
  hash: z.string().optional(),
  /**
   * `inferred` until live capture confirms it (M6). `mismatch`: confirmed, but the data doesn't
   * fit the types (M8). `needs-recheck`: confirmed, but the code changed since (M9).
   */
  status: z.enum(['inferred', 'verified', 'needs-recheck', 'mismatch']),
  flags: z.array(FlagSchema),
})
export type RequestSite = z.infer<typeof RequestSiteSchema>

export const QUERY_LINK_KINDS = ['invalidate', 'refetch', 'reset', 'remove', 'set-data', 'hydrate'] as const

/**
 * A React Query cache call and the queries it hits (M13): `invalidateQueries`, `refetchQueries`,
 * `resetQueries`, `removeQueries`, `setQueryData`, or a server-side prefetch that a
 * `HydrationBoundary` hands to the client queries with the same key (`hydrate`).
 */
export const QueryLinkSchema = z.object({
  id: z.string(),
  kind: z.enum(QUERY_LINK_KINDS),
  /** The method as called, e.g. `invalidateQueries`, or `prefetchQuery` for `hydrate`. */
  method: z.string(),
  origin: z.enum(['component', 'server-action']),
  componentId: z.string().optional(),
  /** The key or key prefix it targets. Absent: every query. */
  key: z.array(QueryKeyPartSchema).optional(),
  /** Only queries with exactly this key (`exact: true`, `setQueryData`). */
  exact: z.boolean().optional(),
  /** Requests it runs after: the mutation whose callback calls it, or the server prefetch (`hydrate`). */
  fromSiteIds: z.array(z.string()),
  /** Query request sites whose key it hits. */
  targetSiteIds: z.array(z.string()),
  trigger: TriggerSchema,
  /** Runs only after the mutation succeeded (`onSuccess`) or failed (`onError`). */
  outcome: z.enum(['success', 'error']).optional(),
  loc: SourceLocSchema,
  callStack: z.array(CallFrameSchema),
})
export type QueryLink = z.infer<typeof QueryLinkSchema>

// ---------------------------------------------------------------------------------------------
// Navigation and flows (M7, docs/PLAN.md 6.6): where the app moves between pages, and the user
// flows inferred from event handlers (event -> requests -> navigation -> next page -> ...).

/** A request path check in middleware: `pathname === '/x'` (`exact`) or `pathname.startsWith('/x')`. */
export const PathCheckSchema = z.object({
  kind: z.enum(['prefix', 'exact']),
  path: z.string(),
})
export type PathCheck = z.infer<typeof PathCheckSchema>

export const NavigationSchema = z.object({
  id: z.string(),
  /** Where the code that navigates runs. `middleware`: a `NextResponse.redirect()` in middleware (M14). */
  origin: z.enum(['component', 'server-action', 'middleware']),
  componentId: z.string().optional(),
  /** Origin `server-action`: the action that redirects. */
  serverAction: ServerActionRefSchema.optional(),
  /**
   * `link`: a `<Link href>` the user can click. `push` / `replace`: `router.push()` / `.replace()`.
   * `redirect` / `permanent-redirect`: `redirect()` / `permanentRedirect()` (server side).
   */
  kind: z.enum(['link', 'push', 'replace', 'redirect', 'permanent-redirect']),
  /** `next` for next/link and next/navigation, `next-intl` for `createNavigation()` wrappers (locale prefix added). */
  api: z.enum(['next', 'next-intl']),
  /** The target as written, resolved like request URLs (`/users/:id`). */
  href: RequestUrlSchema,
  /** The page it goes to, when the href resolves to one. */
  targetRouteId: z.string().optional(),
  /** What makes it happen. A link is `event` `onClick` on the link element. */
  trigger: TriggerSchema,
  /**
   * Set when it only happens after a request: `success` in a `try` block, `onSuccess`, `.then`,
   * or an `if` on the response; `error` in `catch`, `onError`, `.catch` or the `else` branch.
   */
  outcome: z.enum(['success', 'error']).optional(),
  /** Only rendered or reached on some paths. */
  conditional: z.boolean().optional(),
  /**
   * Origin `middleware`: the other conditions it is under, as written (`!token`). Checks of the
   * request path are left out: they are in `from` and `sourceRouteIds`.
   */
  condition: z.string().optional(),
  /** Origin `middleware`: the request path check it is under, e.g. `pathname === '/old-home'`. */
  from: PathCheckSchema.optional(),
  /**
   * Origin `middleware`: the pages it can redirect away from. Those the middleware runs on, narrowed
   * by the path checks around it.
   */
  sourceRouteIds: z.array(z.string()).optional(),
  loc: SourceLocSchema,
  /** From the origin down to the navigation call. */
  callStack: z.array(CallFrameSchema),
})
export type Navigation = z.infer<typeof NavigationSchema>

export const FlowStepSchema = z.discriminatedUnion('kind', [
  /** The user does something on a page: the first step, or a later one on another page. */
  z.object({
    kind: z.literal('interaction'),
    routeId: z.string().optional(),
    componentId: z.string(),
    /** Event prop, e.g. `onSubmit`. */
    event: z.string(),
    loc: SourceLocSchema,
  }),
  /** A request the previous interaction (or the page) sends. */
  z.object({
    kind: z.literal('request'),
    siteId: z.string(),
    /** Sent when the page loads, not by the interaction. */
    onLoad: z.boolean().optional(),
  }),
  /** The app moves to another page. */
  z.object({
    kind: z.literal('navigate'),
    navigationId: z.string(),
    routeId: z.string().optional(),
  }),
  /** A React Query cache update after the previous request, e.g. invalidating the list it changed (M13). */
  z.object({
    kind: z.literal('query-update'),
    linkId: z.string(),
  }),
])
export type FlowStep = z.infer<typeof FlowStepSchema>

export const FlowBranchSchema = z.object({
  /** Index in `steps` of the request whose failure leads here. */
  after: z.number().int().nonnegative(),
  outcome: z.literal('error'),
  steps: z.array(FlowStepSchema),
})
export type FlowBranch = z.infer<typeof FlowBranchSchema>

export const FlowSchema = z.object({
  id: z.string(),
  /** From the starting component and event, e.g. `LoginForm submit`. Rename in the dashboard. */
  name: z.string(),
  /** Where it starts. */
  routeId: z.string().optional(),
  componentId: z.string(),
  /** The success path, in order. */
  steps: z.array(FlowStepSchema),
  /** Error paths that go somewhere else (navigate or send other requests). */
  branches: z.array(FlowBranchSchema),
  /** Routes it passes through, in order. */
  routeIds: z.array(z.string()),
})
export type Flow = z.infer<typeof FlowSchema>

// ---------------------------------------------------------------------------------------------
// Middleware (M14, docs/PLAN.md): `middleware.ts` (Next <= 15) or `proxy.ts` (Next 16), which runs
// before the requests its `config.matcher` selects.

export const MatcherConditionSchema = z.object({
  type: z.enum(['header', 'query', 'cookie', 'host']),
  key: z.string(),
  value: z.string().optional(),
})
export type MatcherCondition = z.infer<typeof MatcherConditionSchema>

export const MiddlewareMatcherSchema = z.object({
  /** The path pattern as written, e.g. `/dashboard/:path*`. */
  source: z.string(),
  /** Runs only when these are present (`has`) or absent (`missing`). */
  has: z.array(MatcherConditionSchema).optional(),
  missing: z.array(MatcherConditionSchema).optional(),
  /** `locale: false`: the pattern ignores the i18n locale prefix (Pages Router i18n only). */
  locale: z.literal(false).optional(),
})
export type MiddlewareMatcher = z.infer<typeof MiddlewareMatcherSchema>

export const MiddlewareRouteSchema = z.object({
  routeId: z.string(),
  /**
   * Runs only for some requests to the route: a matcher with `has` / `missing`, or one that only
   * fits some values of a dynamic segment (`/(en|de)/:path*` on `/[locale]`).
   */
  conditional: z.boolean().optional(),
})
export type MiddlewareRoute = z.infer<typeof MiddlewareRouteSchema>

/** `NextResponse.rewrite(url)`: the URL stays, another route answers. */
export const MiddlewareRewriteSchema = z.object({
  id: z.string(),
  /** The route that answers, as written and resolved like request URLs. */
  href: RequestUrlSchema,
  targetRouteId: z.string().optional(),
  /** Where it applies, read from the check around it. Absent: wherever the middleware runs. */
  from: PathCheckSchema.optional(),
  /** The `if` conditions it is under, as written. */
  condition: z.string().optional(),
  loc: SourceLocSchema,
})
export type MiddlewareRewrite = z.infer<typeof MiddlewareRewriteSchema>

export const MiddlewareSchema = z.object({
  /** `middleware.ts` or `proxy.ts`, project-relative. */
  file: z.string(),
  /** `proxy` from Next 16 on, `middleware` before (deprecated in 16). */
  convention: z.enum(['middleware', 'proxy']),
  /** How the function is exported: `default`, or the named `proxy` / `middleware` export. */
  exportName: z.string().optional(),
  /** The function, or the factory call it is made with. */
  loc: SourceLocSchema,
  /** Created by a package factory, e.g. next-intl's `createMiddleware(routing)`. */
  factory: z.object({ module: z.string(), name: z.string() }).optional(),
  /** `config.matcher`. Empty: it runs on every request. */
  matchers: z.array(MiddlewareMatcherSchema),
  /** Set when `config.matcher` could not be read statically (the routes are then all conditional). */
  matcherText: z.string().optional(),
  /** Routes (pages and route handlers) it runs on. */
  routes: z.array(MiddlewareRouteSchema),
  rewrites: z.array(MiddlewareRewriteSchema),
  /**
   * next-intl `createMiddleware(routing)`: the locales from `defineRouting()`. Paths without a
   * locale prefix are rewritten to the default locale.
   */
  i18n: z
    .object({
      locales: z.array(z.string()),
      defaultLocale: z.string().optional(),
      localePrefix: z.string().optional(),
    })
    .optional(),
})
export type Middleware = z.infer<typeof MiddlewareSchema>

// ---------------------------------------------------------------------------------------------
// Postman collection (M15, docs/PLAN.md): an imported collection used as the API contract.

export const PostmanSourceSchema = z.object({
  /** `file`: v2.1 JSON export. `folder`: git-native v3 YAML folder. `cloud`: fetched by id. */
  kind: z.enum(['file', 'folder', 'cloud']),
  /** Project-relative path (`file`, `folder`). */
  path: z.string().optional(),
  /** Collection or environment id (`cloud`). */
  id: z.string().optional(),
})
export type PostmanSource = z.infer<typeof PostmanSourceSchema>

export const PostmanExampleSchema = z.object({
  name: z.string(),
  /** HTTP status of the saved response. */
  status: z.number().int().optional(),
})
export type PostmanExample = z.infer<typeof PostmanExampleSchema>

export const PostmanRequestSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Folder names from the collection root down. */
  folder: z.array(z.string()),
  method: HttpMethodSchema,
  /**
   * The URL with collection and environment variables filled in. `text` is the URL as written
   * (`{{baseUrl}}/users/:id`). Unresolved variables in the path become `:name`.
   */
  url: RequestUrlSchema,
  /** Variables the URL uses that neither the collection nor the environment sets. */
  unresolved: z.array(z.string()).optional(),
  /** From the saved examples with a 2xx JSON body (`source: 'postman'`). */
  responseType: TypeRefSchema.optional(),
  /** From the request's JSON body. */
  bodyType: TypeRefSchema.optional(),
  examples: z.array(PostmanExampleSchema),
  /** Request sites that call it. */
  siteIds: z.array(z.string()),
  flags: z.array(FlagSchema),
})
export type PostmanRequest = z.infer<typeof PostmanRequestSchema>

export const PostmanContractSchema = z.object({
  collection: z.object({ name: z.string(), source: PostmanSourceSchema }),
  environment: z.object({ name: z.string(), source: PostmanSourceSchema }).optional(),
  /** When it was imported (ISO time). */
  importedAt: z.string(),
  requests: z.array(PostmanRequestSchema),
})
export type PostmanContract = z.infer<typeof PostmanContractSchema>

export const ProjectInfoSchema = z.object({
  /** `app` or `src/app`. */
  appDir: z.string(),
  tsconfig: z.string().optional(),
  nextConfig: z.string().optional(),
  nextVersion: z.string().optional(),
})
export type ProjectInfo = z.infer<typeof ProjectInfoSchema>

export const AppModelSchema = z.object({
  /**
   * Older files read as the current version: version 1 (before M13) has no query keys or links,
   * version 2 (before M14) no middleware, version 3 (before M15) no Postman contract.
   */
  version: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(MODEL_VERSION)])
    .transform(() => MODEL_VERSION),
  project: ProjectInfoSchema,
  routeTree: RouteTreeNodeSchema,
  routes: z.array(RouteSchema),
  components: z.array(ComponentSchema),
  /** Named project types referenced from components and request sites. Sorted by file. */
  types: z.array(NamedTypeSchema),
  /** Request sites, sorted by where they start. Defaults to empty for models written before M2. */
  requests: z.array(RequestSiteSchema).default([]),
  /** Navigation between pages (M7). */
  navigations: z.array(NavigationSchema).default([]),
  /** User flows inferred from the code (M7). Recording confirms them at runtime. */
  flows: z.array(FlowSchema).default([]),
  /** React Query cache calls and the queries they hit (M13). */
  queryLinks: z.array(QueryLinkSchema).default([]),
  /** `middleware.ts` / `proxy.ts`, when the project has one (M14). */
  middleware: MiddlewareSchema.optional(),
  /** The imported Postman collection and how the code lines up with it (M15). */
  postman: PostmanContractSchema.optional(),
})
export type AppModel = z.infer<typeof AppModelSchema>
