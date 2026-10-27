'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { fetchTodo } from '@/services/todos'
import type { Todo } from '@/types/todo'

interface TodoDetailProps {
  id: number
}

// SWR page-load request with a typed key -> fetcher.
export function TodoDetail({ id }: TodoDetailProps) {
  const { data, error, isLoading } = useSWR<Todo>(['todo', id], () => fetchTodo(id))

  if (isLoading) return <p>Loading…</p>
  if (error || !data) return <p role="alert">Todo not found</p>

  return (
    <article>
      <h1>{data.title}</h1>
      <p>Status: {data.done ? 'done' : 'open'}</p>
      <Link href="/">Back</Link>
    </article>
  )
}
