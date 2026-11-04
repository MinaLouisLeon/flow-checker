'use client'

import { useState } from 'react'
import { formatSize } from '@/lib/format-size'

export function FileBadge({ name, bytes }: { name: string; bytes: number }) {
  const [shown, setShown] = useState(false)
  return (
    <button type="button" onClick={() => setShown(!shown)}>
      {name} {shown && formatSize(bytes)}
    </button>
  )
}
