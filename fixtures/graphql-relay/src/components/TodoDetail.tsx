'use client'

import {
  commitMutation,
  graphql,
  type PreloadedQuery,
  usePreloadedQuery,
  useRelayEnvironment,
} from 'react-relay'
import type { TodoDetailQuery } from '@/__generated__/TodoDetailQuery.graphql'
import type { TodoDetailToggleMutation } from '@/__generated__/TodoDetailToggleMutation.graphql'

export const TodoDetailQueryNode = graphql`
  query TodoDetailQuery($id: ID!) {
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
`

export function TodoDetail({ id, queryRef }: { id: string; queryRef: PreloadedQuery<TodoDetailQuery> }) {
  const environment = useRelayEnvironment()
  const data = usePreloadedQuery<TodoDetailQuery>(TodoDetailQueryNode, queryRef)

  function markDone() {
    commitMutation<TodoDetailToggleMutation>(environment, {
      mutation: graphql`
        mutation TodoDetailToggleMutation($id: ID!) {
          toggleTodo(id: $id) {
            id
            done
          }
        }
      `,
      variables: { id },
    })
  }

  if (!data.todo) return <p>Not found</p>
  return (
    <article>
      <h1>{data.todo.title}</h1>
      <p>
        {data.todo.status} · {data.todo.owner.name}
      </p>
      <button type="button" onClick={markDone}>
        {data.todo.done ? 'Mark open' : 'Mark done'}
      </button>
    </article>
  )
}
