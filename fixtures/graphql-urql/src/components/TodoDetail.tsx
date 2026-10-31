'use client'

import { gql, useMutation, useQuery } from 'urql'

const TodoQuery = gql`
  query Todo($id: ID!) {
    todo(id: $id) {
      id
      title
      done
      status
      owner {
        name
        email
      }
    }
  }
`

const ToggleTodoMutation = gql`
  mutation ToggleTodo($id: ID!) {
    toggleTodo(id: $id) {
      id
      done
      status
    }
  }
`

export function TodoDetail({ id }: { id: string }) {
  const [{ data, fetching }] = useQuery({ query: TodoQuery, variables: { id } })
  const [, toggleTodo] = useMutation(ToggleTodoMutation)
  if (fetching) return <p>Loading...</p>
  if (!data?.todo) return <p>Not found</p>
  return (
    <article>
      <h1>{data.todo.title}</h1>
      <p>
        {data.todo.status} · {data.todo.owner.name}
      </p>
      <button type="button" onClick={() => toggleTodo({ id })}>
        {data.todo.done ? 'Mark open' : 'Mark done'}
      </button>
    </article>
  )
}
