import { Suspense } from 'react'
import { UserList } from '@/components/UserList'

// The suspense query runs during server rendering, where the client's relative `/api/trpc` URL can't be
// fetched; render per request (it then retries in the browser) instead of prerendering at build time.
export const dynamic = 'force-dynamic'

export default function UsersPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <UserList />
    </Suspense>
  )
}
