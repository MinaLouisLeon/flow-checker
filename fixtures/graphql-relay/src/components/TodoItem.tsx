'use client'

import Link from 'next/link'
import { graphql, useFragment } from 'react-relay'
import type { TodoItem_todo$key } from '@/__generated__/TodoItem_todo.graphql'

export function TodoItem({ id, todo }: { id: string; todo: TodoItem_todo$key }) {
  const data = useFragment(
    graphql`
      fragment TodoItem_todo on Todo {
        title
        done
      }
    `,
    todo,
  )
  return (
    <li>
      <Link href={`/todos/${id}`}>{data.title}</Link> {data.done ? '(done)' : ''}
    </li>
  )
}
