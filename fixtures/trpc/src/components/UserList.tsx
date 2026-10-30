'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/client'

export function UserList() {
  const trpc = useTRPC()
  const { data: users } = useSuspenseQuery(trpc.user.list.queryOptions())
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>
          {user.name} ({user.role})
        </li>
      ))}
    </ul>
  )
}
