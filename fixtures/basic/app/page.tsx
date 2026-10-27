import { UserList } from '@/components/UserList'
import { getUsers } from '@/lib/api'

export const dynamic = 'force-dynamic'

// Server component: page-load request via a fetch helper.
export default async function HomePage() {
  const users = await getUsers()
  return (
    <main>
      <h1>Users</h1>
      <UserList users={users} />
    </main>
  )
}
