import { todoRouter } from './routers/todo'
import { userRouter } from './routers/user'
import { createTRPCRouter, publicProcedure } from './trpc'

export const appRouter = createTRPCRouter({
  todo: todoRouter,
  user: userRouter,
  health: {
    ping: publicProcedure.query(() => ({ ok: true })),
  },
})

export type AppRouter = typeof appRouter
