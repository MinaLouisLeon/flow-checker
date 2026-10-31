'use client'

import { useMutation, useQuery } from '@apollo/client'
import { useRouter } from 'next/navigation'
import { DELETE_TODO, GET_TODO } from '@/graphql/todos'
import type { DeleteTodoData, TodoData, TodoVars } from '@/types/todo'

export function TodoDetail({ id }: { id: string }) {
  const router = useRouter()
  const { data, loading } = useQuery<TodoData, TodoVars>(GET_TODO, { variables: { id } })
  const [deleteTodo] = useMutation<DeleteTodoData, TodoVars>(DELETE_TODO, {
    onCompleted: () => router.push('/'),
  })
  if (loading) return <p>Loading...</p>
  if (!data?.todo) return <p>Not found</p>
  return (
    <article>
      <h1>{data.todo.title}</h1>
      <p>
        {data.todo.status} · {data.todo.owner.name}
      </p>
      <button type="button" onClick={() => deleteTodo({ variables: { id } })}>
        Delete
      </button>
    </article>
  )
}
