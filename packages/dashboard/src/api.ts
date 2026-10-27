import type { AppModel, Capture, CaptureSummary } from '@flow-checker/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

/** Mirrors `ServerMeta` in @flow-checker/server. */
export interface Meta {
  root?: string
  appPort?: number
  version?: string
  scannedAt?: string
  canRescan: boolean
  /** Present when live capture is on. */
  capture?: { storeRaw: boolean }
}

interface Embedded {
  model: AppModel
  meta?: Partial<Meta>
}

declare global {
  interface Window {
    /** Set by the static HTML export, which has no server to ask. */
    __FLOW_CHECKER__?: Embedded
  }
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  // Relative URL, so the dashboard also works when served below a path.
  const res = await fetch(path, init)
  const body = await res.json().catch(() => undefined)
  if (!res.ok) {
    const message = (body as { error?: string } | undefined)?.error ?? `${res.status} ${res.statusText}`
    throw new Error(message)
  }
  return body as T
}

export function useModel() {
  return useQuery({
    queryKey: ['model'],
    queryFn: () => {
      const embedded = window.__FLOW_CHECKER__
      return embedded ? embedded.model : getJson<AppModel>('api/model')
    },
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: (): Promise<Meta> | Meta => {
      const embedded = window.__FLOW_CHECKER__
      return embedded ? { canRescan: false, ...embedded.meta } : getJson<Meta>('api/meta')
    },
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useRescan() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => getJson<AppModel>('api/scan', { method: 'POST' }),
    onSuccess: (model) => {
      client.setQueryData(['model'], model)
      void client.invalidateQueries({ queryKey: ['meta'] })
    },
  })
}

// --- Live capture ---------------------------------------------------------------------------

const CAPTURES_KEY = ['captures']
/** Keep the newest captures in the list. */
const MAX_LIST = 1000

export interface CaptureDetail {
  capture: Capture
  /** Server captures made while handling this request (BFF hops, server action fetches). */
  children: CaptureSummary[]
}

export function useCaptures(enabled: boolean) {
  return useQuery({
    queryKey: CAPTURES_KEY,
    queryFn: () => getJson<CaptureSummary[]>('api/captures?limit=1000'),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useCapture(id: string | undefined) {
  return useQuery({
    queryKey: ['capture', id],
    queryFn: () => getJson<CaptureDetail>(`api/captures/${encodeURIComponent(id ?? '')}`),
    enabled: Boolean(id),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
}

export type LiveStatus = 'connecting' | 'live' | 'offline'

/** Subscribes to new captures (server-sent events) and adds them to the list. */
export function useLiveFeed(enabled: boolean): LiveStatus {
  const client = useQueryClient()
  const [status, setStatus] = useState<LiveStatus>('connecting')
  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return
    const source = new EventSource('api/live')
    source.addEventListener('ready', () => {
      setStatus('live')
      // Catch up on anything that arrived while disconnected.
      void client.invalidateQueries({ queryKey: CAPTURES_KEY })
    })
    source.addEventListener('capture', (event) => {
      const summary = JSON.parse((event as MessageEvent<string>).data) as CaptureSummary
      client.setQueryData<CaptureSummary[]>(CAPTURES_KEY, (list = []) =>
        [summary, ...list.filter((c) => c.id !== summary.id)].slice(0, MAX_LIST),
      )
      // A server hop may belong to a capture that is open.
      if (summary.parentCaptureId) {
        void client.invalidateQueries({ queryKey: ['capture', summary.parentCaptureId] })
      }
    })
    source.onerror = () => setStatus(source.readyState === EventSource.CLOSED ? 'offline' : 'connecting')
    return () => source.close()
  }, [enabled, client])
  return status
}

export function useClearCaptures() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('api/captures', { method: 'DELETE' })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    },
    onSuccess: () => {
      client.setQueryData(CAPTURES_KEY, [])
      client.removeQueries({ queryKey: ['capture'] })
    },
  })
}
