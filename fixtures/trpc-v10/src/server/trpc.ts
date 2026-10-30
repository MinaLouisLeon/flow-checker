import { initTRPC } from '@trpc/server'

export interface Context {
  /** Set by the route handler from the `x-user` header. */
  userId?: number
}

const t = initTRPC.context<Context>().create()

export const router = t.router
export const mergeRouters = t.mergeRouters
export const publicProcedure = t.procedure

const withUser = t.middleware(({ ctx, next }) => next({ ctx: { userId: ctx.userId ?? 1 } }))

/** Procedures that need a user: the middleware fills one in for the fixture. */
export const userProcedure = publicProcedure.use(withUser)
