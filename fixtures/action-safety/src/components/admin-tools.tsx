'use client'

import { useTransition } from 'react'
import { banUser, resetLikes } from '@/actions/admin'

export function AdminTools({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => startTransition(() => banUser(userId))}>
        Ban
      </button>
      <button type="button" disabled={pending} onClick={() => startTransition(() => resetLikes())}>
        Reset likes
      </button>
    </div>
  )
}
