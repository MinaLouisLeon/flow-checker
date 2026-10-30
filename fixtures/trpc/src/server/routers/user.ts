import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../trpc'
import { fetchUser, fetchUsers } from '../upstream'

export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'member']),
})
export type User = z.infer<typeof UserSchema>

export const userRouter = createTRPCRouter({
  list: publicProcedure.output(z.array(UserSchema)).query(() => fetchUsers() as Promise<User[]>),
  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .output(UserSchema)
    .query(({ input }) => fetchUser(input.id) as Promise<User>),
})
