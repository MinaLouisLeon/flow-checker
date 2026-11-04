import { z } from 'zod'

export const CartItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number().int(),
})

export type CartItem = z.infer<typeof CartItemSchema>
