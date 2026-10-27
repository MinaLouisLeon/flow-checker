'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { createTodo, todoKeys } from '@/services/todos'

// Flow: submit -> POST /todos -> onSuccess invalidate + navigate to the new todo (which loads via SWR).
export function AddTodoForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')

  const create = useMutation({
    mutationFn: createTodo,
    onSuccess: (todo) => {
      queryClient.invalidateQueries({ queryKey: todoKeys.all })
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
      <button type="submit" disabled={create.isPending}>
        Add
      </button>
      {create.error && <p role="alert">{create.error.message}</p>}
    </form>
  )
}
