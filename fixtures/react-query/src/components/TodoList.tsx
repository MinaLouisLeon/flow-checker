'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { todoKeys, todoQueries, updateTodo } from '@/services/todos'
import type { Todo } from '@/types/todo'

// Page-load request (useQuery with queryOptions) plus an event-triggered mutation per row.
export function TodoList() {
  const queryClient = useQueryClient()
  const { data, isPending, error } = useQuery(todoQueries.list())

  const toggle = useMutation({
    mutationFn: (todo: Todo) => updateTodo(todo.id, { done: !todo.done }),
    onSuccess: (updated) => {
      queryClient.setQueryData(todoKeys.detail(updated.id), updated)
      return queryClient.invalidateQueries({ queryKey: todoKeys.lists() })
    },
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
