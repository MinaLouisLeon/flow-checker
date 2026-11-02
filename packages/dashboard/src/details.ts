// "Details" toggle (M34): lists and the page view show only the main badge (the status) unless it is
// on. Remembered per viewer in localStorage; the page still works when storage is blocked.
import { useSyncExternalStore } from 'react'

const KEY = 'flow-checker:details'
const listeners = new Set<() => void>()
let current = read()

function read(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setShowDetails(on: boolean) {
  current = on
  try {
    globalThis.localStorage?.setItem(KEY, on ? '1' : '0')
  } catch {
    // Storage blocked (private window, file:// in some browsers): keep it for this visit only.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab changed it.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    current = read()
    listener()
  }
  globalThis.addEventListener?.('storage', onStorage)
  return () => {
    listeners.delete(listener)
    globalThis.removeEventListener?.('storage', onStorage)
  }
}

export function useShowDetails(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  )
}
