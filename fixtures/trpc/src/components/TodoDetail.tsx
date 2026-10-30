'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTRPC, useTRPCClient } from '@/trpc/client'

export function TodoDetail({ id }: { id: number }) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const queryClient = useQueryClient()
  const todo = useQuery(trpc.todo.byId.queryOptions({ id }))
  const owner = useQuery({
    ...trpc.user.byId.queryOptions({ id: todo.data?.userId ?? 0 }),
    enabled: !!todo.data,
  })

  async function toggle() {
    if (!todo.data) return
    await client.todo.toggle.mutate({ id, done: !todo.data.done })
    await queryClient.invalidateQueries({ queryKey: trpc.todo.byId.queryKey({ id }) })
  }

  if (!todo.data) return <p>Loading...</p>
  return (
    <article>
      <h1>{todo.data.title}</h1>
      <p>Owner: {owner.data?.name ?? '...'}</p>
      <button type="button" onClick={toggle}>
        {todo.data.done ? 'Mark open' : 'Mark done'}
      </button>
    </article>
  )
}
