import { z } from 'zod'
import { publicProcedure } from '../trpc'
import { createTodo, getTodo, listTodos, patchTodo } from '../upstream'

/** v11 routers can be plain objects: no `router()` call needed. */
export const todoRouter = {
  list: publicProcedure.query(() => listTodos()),
  byId: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => getTodo(input.id)),
  add: publicProcedure
    .input(z.object({ title: z.string().min(1) }))
    .mutation(({ input }) => createTodo(input.title)),
  toggle: publicProcedure
    .input(z.object({ id: z.number(), done: z.boolean() }))
    .mutation(({ input }) => patchTodo(input.id, input.done)),
}
