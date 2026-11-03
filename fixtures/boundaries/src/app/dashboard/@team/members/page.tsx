import { listUsers } from '@/lib/api'

export default async function Members() {
  const users = await listUsers()
  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  )
}
