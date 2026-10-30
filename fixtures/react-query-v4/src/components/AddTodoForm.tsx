'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { createTodo } from '@/services/api'

// v4: useMutation(fn, options), invalidateQueries(key).
export function AddTodoForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')

  const create = useMutation(createTodo, {
    onSuccess: (todo) => {
      queryClient.invalidateQueries(['todos'])
      router.push(`/todos/${todo.id}`)
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    create.mutate({ title })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New todo" />
      <button type="submit" disabled={create.isLoading}>
        Add
      </button>
    </form>
  )
}
