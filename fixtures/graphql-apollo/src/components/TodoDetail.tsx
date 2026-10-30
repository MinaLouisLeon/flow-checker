'use client'

import { useMutation, useSuspenseQuery } from '@apollo/client/react'
import { Suspense } from 'react'
import { graphql } from '@/gql'
import { ClientOnly } from './ClientOnly'

const TodoQuery = graphql(`
  query Todo($id: ID!) {
    todo(id: $id) {
      id
      title
      done
      status
      owner {
        name
      }
    }
  }
`)

const ToggleTodoMutation = graphql(`
  mutation ToggleTodo($id: ID!) {
    toggleTodo(id: $id) {
      id
      done
      status
    }
  }
`)

function TodoView({ id }: { id: string }) {
  const { data } = useSuspenseQuery(TodoQuery, { variables: { id } })
  const [toggleTodo] = useMutation(ToggleTodoMutation)
  if (!data.todo) return <p>Not found</p>
  return (
    <article>
      <h1>{data.todo.title}</h1>
      <p>
        {data.todo.status} · {data.todo.owner.name}
      </p>
      <button type="button" onClick={() => toggleTodo({ variables: { id } })}>
        {data.todo.done ? 'Mark open' : 'Mark done'}
      </button>
    </article>
  )
}

export function TodoDetail({ id }: { id: string }) {
  return (
    <ClientOnly fallback={<p>Loading...</p>}>
      <Suspense fallback={<p>Loading...</p>}>
        <TodoView id={id} />
      </Suspense>
    </ClientOnly>
  )
}
