import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/root'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({ userId: Number(req.headers.get('x-user')) || undefined }),
  })

export { handler as GET, handler as POST }
