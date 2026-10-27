'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteUser } from '@/lib/api'

interface DeleteUserButtonProps {
  userId: number
}

// Event-triggered request through the axios wrapper, then navigation (a short flow).
export function DeleteUserButton({ userId }: DeleteUserButtonProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    try {
      await deleteUser(userId)
      router.push('/')
    } catch {
      setError('Could not delete user')
    }
  }

  return (
    <>
      <button type="button" onClick={handleClick}>
        Delete user
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  )
}
