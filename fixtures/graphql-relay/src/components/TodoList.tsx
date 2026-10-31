'use client'

import { graphql, useLazyLoadQuery } from 'react-relay'
import type { TodoListQuery } from '@/__generated__/TodoListQuery.graphql'
import { TodoItem } from './TodoItem'

export function TodoList() {
  const data = useLazyLoadQuery<TodoListQuery>(
    graphql`
      query TodoListQuery {
        todos {
          id
          ...TodoItem_todo
        }
      }
    `,
    {},
  )
  return (
    <ul>
      {data.todos.map((todo) => (
        <TodoItem key={todo.id} id={todo.id} todo={todo} />
      ))}
    </ul>
  )
}
