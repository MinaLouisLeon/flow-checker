'use client'

import Link from 'next/link'
import { trpc } from '@/utils/trpc'

export function TodoList() {
  const todos = trpc.todo.list.useQuery()
  if (todos.isLoading) return <p>Loading...</p>
  return (
    <ul>
      {todos.data?.map((todo) => (
        <li key={todo.id}>
          <Link href={`/todos/${todo.id}`}>{todo.title}</Link>
        </li>
      ))}
    </ul>
  )
}
