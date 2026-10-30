'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { graphql, useMutation } from 'react-relay'
import type { AddTodoFormMutation } from '@/__generated__/AddTodoFormMutation.graphql'

export function AddTodoForm() {
  const [title, setTitle] = useState('')
  const router = useRouter()
  const [commit] = useMutation<AddTodoFormMutation>(graphql`
    mutation AddTodoFormMutation($input: AddTodoInput!) {
      addTodo(input: $input) {
        id
        title
      }
    }
  `)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    commit({
      variables: { input: { title } },
      onCompleted: (response) => router.push(`/todos/${response.addTodo.id}`),
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <input placeholder="New todo" value={title} onChange={(e) => setTitle(e.target.value)} />
      <button type="submit">Add</button>
    </form>
  )
}
