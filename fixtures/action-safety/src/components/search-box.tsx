'use client'

import { useState } from 'react'
import { searchPosts } from '@/actions/posts'

export function SearchBox() {
  const [results, setResults] = useState<{ id: string; title: string }[]>([])
  return (
    <div>
      <input onChange={async (e) => setResults(await searchPosts(e.target.value))} />
      <ul>
        {results.map((r) => (
          <li key={r.id}>{r.title}</li>
        ))}
      </ul>
    </div>
  )
}
