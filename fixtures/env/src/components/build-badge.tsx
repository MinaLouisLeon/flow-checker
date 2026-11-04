'use client'

import { useState } from 'react'

// `next.config.ts` `env` names and NODE_ENV are inlined for the browser too.
export function BuildBadge() {
  const [open, setOpen] = useState(false)
  return (
    <button type="button" onClick={() => setOpen(!open)}>
      {open ? `${process.env.BUILD_LABEL} (${process.env.NODE_ENV})` : 'Build'}
    </button>
  )
}
