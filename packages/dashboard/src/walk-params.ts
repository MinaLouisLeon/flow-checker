// Values for the dynamic segments of the walk-through's page links (M35): asked for once, remembered
// per project in localStorage. The screen still works when storage is blocked.
import { useCallback, useState } from 'react'

const PREFIX = 'flow-checker:walk-params:'

function read(project: string): Record<string, string> {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + project)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== 'object') return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === 'string'),
    )
  } catch {
    return {}
  }
}

function write(project: string, values: Record<string, string>) {
  try {
    globalThis.localStorage?.setItem(PREFIX + project, JSON.stringify(values))
  } catch {
    // Storage blocked: keep the values for this visit only.
  }
}

/** The saved values, with `suggested` ones filled in for names never set. */
export function useWalkParams(
  project: string,
  params: { name: string; suggested?: string }[],
): [Record<string, string>, (name: string, value: string) => void] {
  const [saved, setSaved] = useState(() => read(project))
  const set = useCallback(
    (name: string, value: string) => {
      setSaved((current) => {
        const next = { ...current, [name]: value }
        write(project, next)
        return next
      })
    },
    [project],
  )
  const values: Record<string, string> = {}
  for (const p of params) {
    const value = saved[p.name] ?? p.suggested
    if (value !== undefined) values[p.name] = value
  }
  return [values, set]
}
