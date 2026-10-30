'use client'

import { useApolloClient, useLazyQuery } from '@apollo/client/react'
import { type FormEvent, useState } from 'react'
import { graphql } from '@/gql'
import type { UsersQuery as UsersResult } from '@/gql/graphql'

const SearchQuery = graphql(`
  query Search($text: String!) {
    search(text: $text) {
      __typename
      ... on Todo {
        id
        title
      }
      ... on User {
        id
        name
      }
    }
  }
`)

const UsersQuery = graphql(`
  query Users {
    users {
      id
      name
      email
    }
  }
`)

export function UserSearch() {
  const [text, setText] = useState('')
  const [users, setUsers] = useState<UsersResult['users']>([])
  const client = useApolloClient()
  const [search, { data }] = useLazyQuery(SearchQuery)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    search({ variables: { text } })
  }

  async function loadUsers() {
    const result = await client.query({ query: UsersQuery })
    setUsers(result.data?.users ?? [])
  }

  return (
    <section>
      <form onSubmit={onSubmit}>
        <input placeholder="Search" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit">Search</button>
      </form>
      <ul>
        {data?.search.map((item) =>
          item.__typename === 'Todo' ? (
            <li key={`todo-${item.id}`}>Todo: {item.title}</li>
          ) : (
            <li key={`user-${item.id}`}>User: {item.name}</li>
          ),
        )}
      </ul>
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
