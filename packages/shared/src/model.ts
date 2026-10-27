// The scan result written to `.flow-checker/model.json` (docs/PLAN.md section 5).
// M1 covers routes and components, M3 types. Request sites and flows are added by later milestones.
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
})
export type TypeRef = z.infer<typeof TypeRefSchema>

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
  /** Type of the props parameter. Absent when the component takes no props. */
  propsType: TypeRefSchema.optional(),
  /** Ids of named project types referenced in the component's body (not counting `propsType`), in source order. */
  usedTypes: z.array(z.string()),
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
  /** Named project types referenced from components (and, later, request sites). Sorted by file. */
  types: z.array(NamedTypeSchema),
})
export type AppModel = z.infer<typeof AppModelSchema>
