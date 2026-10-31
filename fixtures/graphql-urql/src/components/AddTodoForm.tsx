'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { gql, useMutation } from 'urql'

const AddTodoMutation = gql`
  mutation AddTodo($input: AddTodoInput!) {
    addTodo(input: $input) {
      id
      title
    }
  }
`

export function AddTodoForm() {
  const [title, setTitle] = useState('')
  const router = useRouter()
  const [, addTodo] = useMutation(AddTodoMutation)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    addTodo({ input: { title } }).then((result) => {
      if (!result.error) router.push(`/todos/${result.data.addTodo.id}`)
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <input placeholder="New todo" value={title} onChange={(e) => setTitle(e.target.value)} />
      <button type="submit">Add</button>
    </form>
  )
}
