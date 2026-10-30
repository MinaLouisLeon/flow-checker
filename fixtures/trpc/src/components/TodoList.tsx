'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useTRPC } from '@/trpc/client'

export function TodoList() {
  const trpc = useTRPC()
  const { data: todos } = useQuery(trpc.todo.list.queryOptions())
  return (
    <ul>
      {todos?.map((todo) => (
        <li key={todo.id}>
          <Link href={`/todos/${todo.id}`}>{todo.title}</Link>
        </li>
      ))}
    </ul>
  )
}
