'use client'

import { useState } from 'react'
import type { Money } from '@/lib/amount'

export function ReceiptTotal({ total }: { total: Money }) {
  const [open, setOpen] = useState(false)
  return (
    <button type="button" onClick={() => setOpen(!open)}>
      {open ? total.format() : 'Show total'}
    </button>
  )
}
