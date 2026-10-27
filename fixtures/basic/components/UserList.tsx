import Link from 'next/link'
import type { User } from '@/types/user'

interface UserListProps {
  users: User[]
}

// Server component with no requests; links to the dynamic route.
export function UserList({ users }: UserListProps) {
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>
          <Link href={`/users/${user.id}`}>{user.name}</Link> ({user.role})
        </li>
      ))}
    </ul>
  )
}
