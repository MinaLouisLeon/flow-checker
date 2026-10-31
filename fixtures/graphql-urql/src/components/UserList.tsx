'use client'

import { useState } from 'react'
import { gql, useClient } from 'urql'

const UsersQuery = gql`
  query Users {
    users {
      id
      name
      email
    }
  }
`

export function UserList() {
  const client = useClient()
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([])

  async function loadUsers() {
    const result = await client.query(UsersQuery, {}).toPromise()
    setUsers(result.data?.users ?? [])
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
