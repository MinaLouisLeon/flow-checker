import { Suspense } from 'react'
import { getUsers } from '@/lib/users'
import { refreshUsers } from '../actions'

async function UserList() {
  const users = await getUsers()
  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  )
}

export default function UsersPage() {
  return (
    <main>
      <h1>Users</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <UserList />
      </Suspense>
      <form action={refreshUsers}>
        <button type="submit">Refresh</button>
      </form>
    </main>
  )
}
