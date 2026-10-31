'use client'

import { useMutation } from '@apollo/client'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { ADD_TODO, GET_TODOS } from '@/graphql/todos'
import type { AddTodoData, AddTodoVars } from '@/types/todo'

export function AddTodoForm() {
  const [title, setTitle] = useState('')
  const router = useRouter()
  const [addTodo] = useMutation<AddTodoData, AddTodoVars>(ADD_TODO, {
    refetchQueries: [{ query: GET_TODOS }, 'Viewer'],
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const { data } = await addTodo({ variables: { input: { title } } })
    if (data) router.push(`/todos/${data.addTodo.id}`)
  }

  return (
    <form onSubmit={onSubmit}>
      <input placeholder="New todo" value={title} onChange={(e) => setTitle(e.target.value)} />
      <button type="submit">Add</button>
    </form>
  )
}
