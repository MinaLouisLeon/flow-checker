'use client'

import { useEffect, useState } from 'react'
import { getSettings } from '@/lib/api'
import type { Settings } from '@/types'

// Effect request whose response has `null` where `Settings` doesn't allow it.
export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  if (!settings) return <p>Loading settings…</p>
  return (
    <section>
      <h2>Settings</h2>
      <p>
        Theme: {settings.theme}, locale: {settings.locale}
      </p>
    </section>
  )
}
