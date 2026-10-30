import Link from 'next/link'
import { ProductPanel } from '@/components/ProductPanel'
import { TodoPanel } from '@/components/TodoPanel'
import { getUsers } from '@/lib/api'

export const dynamic = 'force-dynamic'

// GET /users: in the collection, and the code's `User[]` fits its example.
export default async function HomePage() {
  const users = await getUsers()
  return (
    <main>
      <h1>Users</h1>
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            <Link href={`/users/${user.id}`}>{user.name}</Link>
          </li>
        ))}
      </ul>
      <ProductPanel />
      <TodoPanel />
    </main>
  )
}
