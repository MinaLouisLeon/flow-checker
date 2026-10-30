'use client'

import { type ReactNode, useSyncExternalStore } from 'react'

const subscribe = () => () => {}

// Suspense queries fetch while rendering, and the relative /api/graphql URL only works in the browser.
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  return isClient ? children : fallback
}
