import { publicProcedure, router } from '../trpc'
import { listUsers } from '../upstream'

export const userRouter = router({
  list: publicProcedure.query(() => listUsers()),
})
