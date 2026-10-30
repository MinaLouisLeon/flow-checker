'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { trpc } from '@/utils/trpc'

export function AddTodoForm() {
  const [title, setTitle] = useState('')
  const router = useRouter()
  const utils = trpc.useUtils()
  const add = trpc.todo.add.useMutation({
    onSuccess: (todo) => {
      utils.todo.list.invalidate()
      router.push(`/todos/${todo.id}`)
    },
  })

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
