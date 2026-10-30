import { healthRouter } from './routers/health'
import { todoRouter } from './routers/todo'
import { userRouter } from './routers/user'
import { mergeRouters, router } from './trpc'

export const appRouter = mergeRouters(router({ todo: todoRouter, user: userRouter }), healthRouter)

export type AppRouter = typeof appRouter
