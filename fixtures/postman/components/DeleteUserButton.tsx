'use client'

import { useRouter } from 'next/navigation'
import { deleteUser } from '@/lib/api'

// DELETE /users/:id is not in the collection.
export function DeleteUserButton({ id }: { id: number }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        await deleteUser(id)
        router.push('/')
      }}
    >
      Delete
    </button>
  )
}
