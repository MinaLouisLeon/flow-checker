'use client'

import { useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { graphql } from '@/gql'
import { TodoItem } from './TodoItem'

const TodosQuery = graphql(`
  query Todos($status: TodoStatus) {
    todos(status: $status) {
      id
      ...TodoItem
    }
  }
`)

export function TodoList() {
  const [openOnly, setOpenOnly] = useState(false)
  const { data, loading } = useQuery(TodosQuery, {
    variables: { status: openOnly ? 'OPEN' : null },
  })
  return (
    <section>
      <label>
        <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Open only
      </label>
      {loading && <p>Loading...</p>}
      <ul>
        {data?.todos.map((todo) => (
          <TodoItem key={todo.id} todo={todo} />
        ))}
      </ul>
    </section>
  )
}
