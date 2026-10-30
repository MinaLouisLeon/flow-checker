'use client'

import Link from 'next/link'
import { gql, useQuery } from 'urql'

// No TypeScript types for operations here: they come from schema.graphql.
const TodosQuery = gql`
  query Todos($status: TodoStatus) {
    todos(status: $status) {
      id
      title
      done
    }
  }
`

export function TodoList() {
  const [{ data, fetching }] = useQuery({ query: TodosQuery, variables: { status: 'OPEN' } })
  if (fetching) return <p>Loading...</p>
  return (
    <ul>
      {data?.todos.map((todo: { id: string; title: string }) => (
        <li key={todo.id}>
          <Link href={`/todos/${todo.id}`}>{todo.title}</Link>
        </li>
      ))}
    </ul>
  )
}
