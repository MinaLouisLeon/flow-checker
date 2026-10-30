import { dehydrate, QueryClient } from '@tanstack/react-query'
import { HydrateClient } from '@/components/HydrateClient'
import { UserList } from '@/components/UserList'
import { fetchUsers } from '@/services/api'

// v4: prefetchQuery(key, fn) on the server, handed over with <Hydrate>.
export default async function UsersPage() {
  const queryClient = new QueryClient()
  await queryClient.prefetchQuery(['users'], fetchUsers)
  return (
    <main>
      <h1>Users</h1>
      <HydrateClient state={dehydrate(queryClient)}>
        <UserList />
      </HydrateClient>
    </main>
  )
}
