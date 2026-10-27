'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { fetchTodos, todoKeys, updateTodo } from '@/services/todos'
import type { Todo } from '@/types/todo'

// Page-load request (useQuery) plus an event-triggered mutation per row.
export function TodoList() {
  const queryClient = useQueryClient()
  const { data, isPending, error } = useQuery({ queryKey: todoKeys.all, queryFn: fetchTodos })

  const toggle = useMutation({
    mutationFn: (todo: Todo) => updateTodo(todo.id, { done: !todo.done }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  })

  if (isPending) return <p>Loading…</p>
  if (error) return <p role="alert">{error.message}</p>

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
