'use client'

import { useQueries } from '@tanstack/react-query'
import { fetchUserTodos, todoKeys } from '@/services/api'

const USER_IDS = [1, 2]

// v4: useQueries({ queries }) built with map.
export function TodoStats() {
  const results = useQueries({
    queries: USER_IDS.map((userId) => ({
      queryKey: todoKeys.list(userId),
      queryFn: () => fetchUserTodos(userId),
    })),
  })
  return <p>{results.map((r) => r.data?.length ?? 0).join(' / ')} todos per user</p>
}
