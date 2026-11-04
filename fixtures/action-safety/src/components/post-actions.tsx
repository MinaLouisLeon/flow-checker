'use client'

import { useState, useTransition } from 'react'
import { deletePost, likePost, renamePost } from '@/actions/posts'

export function PostActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  return (
    <div>
      <form action={likePost}>
        <input type="hidden" name="id" value={id} />
        <button type="submit">Like</button>
      </form>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <button type="button" disabled={pending} onClick={() => startTransition(() => renamePost(id, title))}>
        Rename
      </button>
      <button type="button" disabled={pending} onClick={() => startTransition(() => deletePost(id))}>
        Delete
      </button>
    </div>
  )
}
