import { z } from 'zod'

// Types derived from zod schemas: the scanner must resolve z.infer<...>.
export const ProductSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  price: z.number(),
  stock: z.number().int(),
})

export const CreateProductSchema = ProductSchema.omit({ id: true }).extend({
  stock: z.number().int().min(0).default(0),
})

export type Product = z.infer<typeof ProductSchema>
export type CreateProductInput = z.input<typeof CreateProductSchema>

export interface ApiError {
  error: string
  issues?: { path: string; message: string }[]
}
