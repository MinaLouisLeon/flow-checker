import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { UserList } from '@/components/UserList'
import { userQueries } from '@/services/users'

// Server prefetch handed to the client query with the same key.
export default async function UsersPage() {
  const queryClient = new QueryClient()
  await queryClient.prefetchQuery(userQueries())
  return (
    <main>
      <h1>Users</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <UserList />
      </HydrationBoundary>
    </main>
  )
}
