'use client'

import { useState } from 'react'
import { fetchQuery, graphql, useRelayEnvironment } from 'react-relay'
import type { UserListQuery, UserListQuery$data } from '@/__generated__/UserListQuery.graphql'

export function UserList() {
  const environment = useRelayEnvironment()
  const [users, setUsers] = useState<UserListQuery$data['users']>([])

  async function loadUsers() {
    const data = await fetchQuery<UserListQuery>(
      environment,
      graphql`
        query UserListQuery {
          users {
            id
            name
            email
          }
        }
      `,
      {},
    ).toPromise()
    setUsers(data?.users ?? [])
  }

  return (
    <section>
      <button type="button" onClick={loadUsers}>
        Load users
      </button>
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            {user.name} ({user.email})
          </li>
        ))}
      </ul>
    </section>
  )
}
