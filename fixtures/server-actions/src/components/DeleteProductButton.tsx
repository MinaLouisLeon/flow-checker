'use client'

import { useTransition } from 'react'
import { deleteProduct } from '@/actions/products'

// Server action called directly from an event handler.
export function DeleteProductButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition()

  return (
    <button type="button" disabled={pending} onClick={() => startTransition(() => deleteProduct(id))}>
      Delete
    </button>
  )
}
