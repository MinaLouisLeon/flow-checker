import Link from 'next/link'
import { getUsers } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const users = await getUsers()
  return (
    <main>
      <h1>Dashboard</h1>
      <ul>
        {users.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
      <Link href="/dashboard/settings">Settings</Link>
    </main>
  )
}
