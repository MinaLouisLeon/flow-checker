'use client'

import { useMutation } from '@apollo/client/react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { graphql } from '@/gql'

const AddTodoMutation = graphql(`
  mutation AddTodo($input: AddTodoInput!) {
    addTodo(input: $input) {
      id
      title
    }
  }
`)

export function AddTodoForm() {
  const [title, setTitle] = useState('')
  const router = useRouter()
  const [addTodo] = useMutation(AddTodoMutation, {
    refetchQueries: ['Todos'],
    onCompleted: (data) => router.push(`/todos/${data.addTodo.id}`),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    addTodo({ variables: { input: { title } } })
  }

  return (
    <form onSubmit={onSubmit}>
      <input placeholder="New todo" value={title} onChange={(e) => setTitle(e.target.value)} />
      <button type="submit">Add</button>
    </form>
  )
}
