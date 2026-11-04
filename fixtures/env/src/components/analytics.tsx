'use client'

import { useEffect } from 'react'

// A NEXT_PUBLIC_ name read directly: inlined into the browser bundle.
export function Analytics() {
  useEffect(() => {
    document.body.dataset.analytics = process.env.NEXT_PUBLIC_ANALYTICS_ID
  }, [])
  return null
}
