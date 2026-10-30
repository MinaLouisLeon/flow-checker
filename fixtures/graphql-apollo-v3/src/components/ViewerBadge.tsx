'use client'

import { useQuery } from '@apollo/client'
import { GET_VIEWER } from '@/graphql/todos'
import type { ViewerData } from '@/types/todo'

export function ViewerBadge() {
  const { data } = useQuery<ViewerData>(GET_VIEWER)
  return <p>Signed in as {data?.viewer.name ?? '...'}</p>
}
