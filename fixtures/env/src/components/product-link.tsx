'use client'

import { useState } from 'react'
import { apiUrl } from '@/lib/config'

// Planted: config.ts reads API_URL, which has no NEXT_PUBLIC_ prefix, so it is undefined here in the browser.
export function ProductLink({ id, name }: { id: number; name: string }) {
  const [hover, setHover] = useState(false)
  return (
    <a href={`${apiUrl}/products/${id}`} onMouseEnter={() => setHover(true)}>
      {hover ? `${name} →` : name}
    </a>
  )
}
