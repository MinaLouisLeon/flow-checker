'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { fetchTodo } from '@/services/api'

// v4: useQuery(key, fn, options) with an inline array key.
export function TodoDetail({ id }: { id: number }) {
  const { data, isLoading } = useQuery(['todos', 'detail', id], () => fetchTodo(id), { enabled: id > 0 })

  if (isLoading) return <p>Loading…</p>
  if (!data) return <p role="alert">Todo not found</p>

  return (
    <article>
      <h1>{data.title}</h1>
      <Link href="/">Back</Link>
    </article>
  )
}
