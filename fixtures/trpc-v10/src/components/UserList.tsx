'use client'

import { trpc } from '@/utils/trpc'

export function UserList() {
  const { data: users } = trpc.user.list.useQuery()
  return (
    <ul>
      {users?.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}
