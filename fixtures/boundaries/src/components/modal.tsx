'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

export function Modal({ children }: { children: ReactNode }) {
  const router = useRouter()
  return (
    <dialog open>
      {children}
      <button type="button" onClick={() => router.back()}>
        Close
      </button>
    </dialog>
  )
}
