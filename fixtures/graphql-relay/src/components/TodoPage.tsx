'use client'

import { Suspense, useEffect } from 'react'
import { useQueryLoader } from 'react-relay'
import type { TodoDetailQuery } from '@/__generated__/TodoDetailQuery.graphql'
import { TodoDetail, TodoDetailQueryNode } from './TodoDetail'

export function TodoPage({ id }: { id: string }) {
  const [queryRef, loadQuery] = useQueryLoader<TodoDetailQuery>(TodoDetailQueryNode)

  useEffect(() => loadQuery({ id }), [id, loadQuery])

  if (!queryRef) return <p>Loading...</p>
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <TodoDetail id={id} queryRef={queryRef} />
    </Suspense>
  )
}
