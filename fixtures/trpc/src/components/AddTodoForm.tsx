'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { useTRPC } from '@/trpc/client'

export function AddTodoForm() {
  const [title, setTitle] = useState('')
  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const add = useMutation(
    trpc.todo.add.mutationOptions({
      onSuccess: async (todo) => {
        await queryClient.invalidateQueries(trpc.todo.list.pathFilter())
        router.push(`/todos/${todo.id}`)
      },
    }),
  )

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    add.mutate({ title })
  }

  return (
    <form onSubmit={onSubmit}>
      <input placeholder="New todo" value={title} onChange={(e) => setTitle(e.target.value)} />
      <button type="submit">Add</button>
    </form>
  )
}
