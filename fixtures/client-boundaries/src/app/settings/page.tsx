'use client'

import { useState } from 'react'

// The page itself is a client component: the boundary is the page.
export default function SettingsPage() {
  const [dark, setDark] = useState(false)
  return (
    <main>
      <h1>Settings</h1>
      <label>
        <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> Dark mode
      </label>
    </main>
  )
}
