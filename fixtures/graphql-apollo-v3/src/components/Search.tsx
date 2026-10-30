'use client'

import { useLazyQuery } from '@apollo/client'
import { type FormEvent, useState } from 'react'
import { SEARCH } from '@/graphql/todos'
import type { SearchData, SearchVars } from '@/types/search'

export function Search() {
  const [text, setText] = useState('')
  const [search, { data }] = useLazyQuery<SearchData, SearchVars>(SEARCH)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    search({ variables: { text } })
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
    </section>
  )
}
