// Scroll position between screens (M23). The window keeps its offset when the hash changes, so a
// new screen opened from a scrolled list started mid-page. A new screen now opens at the top; back
// and forward return to where that entry was, and replaceScreen() (search boxes, toggles) stays.
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Screen } from './router'

/**
 * What makes a screen "another screen". Choosing a row on a list screen (a component, a request,
 * a flow) or a component in the page view keeps the list where it was.
 */
export function screenIdentity(screen: Screen): string {
  switch (screen.name) {
    case 'page':
      return `page:${screen.routeId}`
    case 'component':
      return `component:${screen.componentId}`
    default:
      return screen.name
  }
}

/**
 * Where to scroll after the hash changed: a number, or undefined to leave it. `newEntry`: a link
 * or `location.hash` added a history entry (back/forward and replaceScreen() reuse one).
 */
export function scrollTarget(
  previous: string | undefined,
  next: string,
  newEntry: boolean,
  saved: number | undefined,
): number | undefined {
  if (!newEntry) return saved
  return previous === next ? undefined : 0
}

const STATE_KEY = 'flowCheckerEntry'
const positions = new Map<string, number>()
let entries = 0

/** The id this app gave the current history entry, if any. */
function entryId(): string | undefined {
  const state: unknown = window.history.state
  if (!state || typeof state !== 'object') return undefined
  const id = (state as Record<string, unknown>)[STATE_KEY]
  return typeof id === 'string' ? id : undefined
}

/** Remembers each history entry's scroll position and applies `scrollTarget()` on every change. */
export function useScrollMemory(screen: Screen) {
  const shown = useRef<string | undefined>(undefined)

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    const onScroll = () => {
      const id = entryId()
      if (id) positions.set(id, window.scrollY)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Runs for each new screen object, i.e. on every hash change.
  useLayoutEffect(() => {
    let id = entryId()
    const newEntry = id === undefined
    if (id === undefined) {
      id = `e${Date.now().toString(36)}-${entries++}`
      const state: unknown = window.history.state
      window.history.replaceState(
        { ...(state && typeof state === 'object' ? state : {}), [STATE_KEY]: id },
        '',
      )
    }
    const identity = screenIdentity(screen)
    const y = scrollTarget(shown.current, identity, newEntry, positions.get(id))
    shown.current = identity
    if (y !== undefined) window.scrollTo(0, y)
  }, [screen])
}
