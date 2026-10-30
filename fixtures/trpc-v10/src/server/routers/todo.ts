import { z } from 'zod'
import type { TodoPage } from '@/types/todo'
import { publicProcedure, router, userProcedure } from '../trpc'
import { createTodo, getTodo, listTodos, patchTodo } from '../upstream'

export const NewTodoSchema = z.object({
  title: z.string().min(1),
})
export type NewTodo = z.infer<typeof NewTodoSchema>

export const todoRouter = router({
  list: publicProcedure
    .input(z.object({ userId: z.number().optional() }).optional())
    .query(async ({ input }) =>
      (await listTodos()).filter((t) => !input?.userId || t.userId === input.userId),
    ),
  byId: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => getTodo(input.id)),
  add: userProcedure
    .input(NewTodoSchema)
    .mutation(({ input, ctx }) => createTodo({ ...input, userId: ctx.userId })),
  toggle: publicProcedure
    .input(z.object({ id: z.number(), done: z.boolean() }))
    .mutation(({ input }) => patchTodo(input.id, { done: input.done })),
  feed: publicProcedure
    .input(z.object({ cursor: z.number().nullish(), limit: z.number().int().min(1) }))
    .query(async ({ input }): Promise<TodoPage> => {
      const all = await listTodos()
      const start = input.cursor ?? 0
      const items = all.slice(start, start + input.limit)
      return { items, nextCursor: start + input.limit < all.length ? start + input.limit : null }
    }),
})
