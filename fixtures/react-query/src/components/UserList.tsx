'use client'

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchUserTodos, userKeys, userQueries, userQuery } from '@/services/users'

// Hydrated list, parallel queries per user, and queryClient methods on interaction.
export function UserList() {
  const queryClient = useQueryClient()
  const { data: users = [] } = useQuery(userQueries())
  const todoCounts = useQueries({
    queries: users.map((user) => ({
      queryKey: userKeys.todos(user.id),
      queryFn: () => fetchUserTodos(user.id),
    })),
  })

  async function showEmail(id: number) {
    const user = await queryClient.ensureQueryData(userQuery(id))
    console.info(user.email)
  }

  return (
    <>
      <ul>
        {users.map((user, i) => (
          <li key={user.id}>
            <button
              type="button"
              onMouseEnter={() => queryClient.prefetchQuery(userQuery(user.id))}
              onClick={() => showEmail(user.id)}
            >
              {user.name}
            </button>{' '}
            ({todoCounts[i]?.data?.length ?? '…'} todos)
            <button
              type="button"
              onClick={() => queryClient.removeQueries({ queryKey: userKeys.detail(user.id), exact: true })}
            >
              Forget
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => queryClient.refetchQueries({ queryKey: userKeys.all })}>
        Refresh
      </button>
      <button type="button" onClick={() => queryClient.resetQueries()}>
        Reset cache
      </button>
    </>
  )
}
