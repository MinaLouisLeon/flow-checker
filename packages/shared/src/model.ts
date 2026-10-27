// The scan result written to `.flow-checker/model.json` (docs/PLAN.md section 5).
// M1 covers routes and components. Request sites, types and flows are added by later milestones.
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

export const ComponentRefSchema = z.object({
  /** Tag as written in JSX, e.g. `UserList` or `UI.Button`. */
  name: z.string(),
  /**
   * `project`: a component in the scanned source (see `componentId`).
   * `external`: from a package (see `module`).
   * `unresolved`: the scanner could not find a component declaration.
   */
  resolution: z.enum(['project', 'external', 'unresolved']),
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
})
export type Component = z.infer<typeof ComponentSchema>

export const ProjectInfoSchema = z.object({
  /** `app` or `src/app`. */
  appDir: z.string(),
  tsconfig: z.string().optional(),
  nextConfig: z.string().optional(),
  nextVersion: z.string().optional(),
})
export type ProjectInfo = z.infer<typeof ProjectInfoSchema>

export const AppModelSchema = z.object({
  version: z.literal(MODEL_VERSION),
  project: ProjectInfoSchema,
  routeTree: RouteTreeNodeSchema,
  routes: z.array(RouteSchema),
  components: z.array(ComponentSchema),
})
export type AppModel = z.infer<typeof AppModelSchema>
