'use client'

import { client, trpc } from '@/utils/trpc'

export function TodoDetail({ id }: { id: number }) {
  const utils = trpc.useUtils()
  const todo = trpc.todo.byId.useQuery({ id })

  async function toggle() {
    if (!todo.data) return
    await client.todo.toggle.mutate({ id, done: !todo.data.done })
    await utils.todo.byId.invalidate({ id })
  }

  if (!todo.data) return <p>Loading...</p>
  return (
    <article>
      <h1>{todo.data.title}</h1>
      <button type="button" onClick={toggle}>
        {todo.data.done ? 'Mark open' : 'Mark done'}
      </button>
    </article>
  )
}
