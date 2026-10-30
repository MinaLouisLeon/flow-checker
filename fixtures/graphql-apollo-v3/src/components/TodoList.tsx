'use client'

import { useQuery } from '@apollo/client'
import Link from 'next/link'
import { GET_TODOS } from '@/graphql/todos'
import type { TodosData } from '@/types/todo'

export function TodoList() {
  const { data, loading } = useQuery<TodosData>(GET_TODOS)
  if (loading) return <p>Loading...</p>
  return (
    <ul>
      {data?.todos.map((todo) => (
        <li key={todo.id}>
          <Link href={`/todos/${todo.id}`}>{todo.title}</Link> {todo.done ? '(done)' : ''}
        </li>
      ))}
    </ul>
  )
}
