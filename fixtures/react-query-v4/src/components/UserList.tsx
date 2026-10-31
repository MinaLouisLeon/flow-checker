'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteUser, fetchUsers } from '@/services/api'

// v4: useMutation(key, fn, options), removeQueries(key, filters).
export function UserList() {
  const queryClient = useQueryClient()
  const { data: users = [] } = useQuery(['users'], fetchUsers)

  const remove = useMutation(['deleteUser'], (id: number) => deleteUser(id), {
    onSuccess: (_user, id) => {
      queryClient.removeQueries(['users', id], { exact: true })
      return queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>
          {user.name}{' '}
          <button type="button" onClick={() => remove.mutate(user.id)}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}
