import { listUsers } from '@/lib/api'

export default async function Stats() {
  const users = await listUsers()
  return <p>{users.length} users</p>
}
