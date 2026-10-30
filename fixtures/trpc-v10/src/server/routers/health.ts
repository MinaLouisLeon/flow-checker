import { publicProcedure, router } from '../trpc'

/** Merged into the root, so its procedure is `ping`, not `health.ping`. */
export const healthRouter = router({
  ping: publicProcedure.query(() => ({ ok: true as const, at: new Date().toISOString() })),
})
