'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { fetchTodos, todoKeys, updateTodo } from '@/services/api'
import type { Todo } from '@/types/todo'

// v4: useQuery(key, fn), useMutation(fn, options) with invalidation by a key factory.
export function TodoList() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery(todoKeys.lists(), fetchTodos)

  const toggle = useMutation((todo: Todo) => updateTodo(todo.id, { done: !todo.done }), {
    onSuccess: (todo) => {
      queryClient.setQueryData(todoKeys.detail(todo.id), todo)
      queryClient.invalidateQueries(todoKeys.lists(), { exact: true })
    },
  })

  if (isLoading || !data) return <p>Loading…</p>

  return (
    <ul>
      {data.map((todo) => (
        <li key={todo.id}>
          <input type="checkbox" checked={todo.done} onChange={() => toggle.mutate(todo)} />
          <Link href={`/todos/${todo.id}`}>{todo.title}</Link>
        </li>
      ))}
    </ul>
  )
}
