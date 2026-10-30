// The normalized collection that `flow-checker postman import` caches in
// `.flow-checker/postman/collection.json`. Only what the contract check needs is kept: no
// headers, auth or scripts. Example bodies are redacted with the capture rules, and variables
// are kept only when a URL uses them and they don't look secret.
import { HttpMethodSchema, PostmanSourceSchema } from '@flow-checker/shared'
import { z } from 'zod'

export const IMPORT_VERSION = 1

export const VariableSchema = z.object({ key: z.string(), value: z.string() })
export type Variable = z.infer<typeof VariableSchema>

/** A JSON body, redacted. `redactedPaths` are the masked values (they only keep their JSON type). */
export const JsonBodySchema = z.object({
  value: z.unknown(),
  redactedPaths: z.array(z.string()),
})
export type JsonBody = z.infer<typeof JsonBodySchema>

export const ImportedExampleSchema = z.object({
  name: z.string(),
  status: z.number().int().optional(),
  /** Absent when the saved body is empty or not JSON. */
  body: JsonBodySchema.optional(),
})
export type ImportedExample = z.infer<typeof ImportedExampleSchema>

export const ImportedRequestSchema = z.object({
  name: z.string(),
  folder: z.array(z.string()),
  method: HttpMethodSchema,
  /** As written, e.g. `{{baseUrl}}/users/:id?active=true`. */
  url: z.string(),
  /** Variables set on the folders above it (v3 folder definitions), closest last. */
  variables: z.array(VariableSchema).optional(),
  body: JsonBodySchema.optional(),
  examples: z.array(ImportedExampleSchema),
})
export type ImportedRequest = z.infer<typeof ImportedRequestSchema>

export const PostmanImportSchema = z.object({
  version: z.literal(IMPORT_VERSION),
  importedAt: z.string(),
  collection: z.object({ name: z.string(), source: PostmanSourceSchema }),
  environment: z.object({ name: z.string(), source: PostmanSourceSchema }).optional(),
  /** Collection variables. */
  variables: z.array(VariableSchema),
  /** Environment values (they win over collection variables). */
  environmentValues: z.array(VariableSchema),
  requests: z.array(ImportedRequestSchema),
})
export type PostmanImport = z.infer<typeof PostmanImportSchema>
