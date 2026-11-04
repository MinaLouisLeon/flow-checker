'use client'

import { useState } from 'react'

// Reading through a copy of process.env is inlined too (Next's docs say it isn't; `next build` 16.4 inlines it).
const env = process.env

export function ThemeName() {
  const [theme] = useState(env.NEXT_PUBLIC_THEME)
  return <p>{theme}</p>
}
