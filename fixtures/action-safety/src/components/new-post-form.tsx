'use client'

import { useActionState } from 'react'
import { createPost, type FormState } from '@/actions/posts'

const initial: FormState = {}

export function NewPostForm() {
  const [state, formAction, pending] = useActionState(createPost, initial)
  return (
    <form action={formAction}>
      <input name="title" />
      <textarea name="body" />
      <button type="submit" disabled={pending}>
        Publish
      </button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  )
}
