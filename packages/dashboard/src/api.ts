import type { AppModel, Capture, CaptureSummary, VerificationSummary } from '@flow-checker/shared'
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
const VERIFICATION_KEY = ['verification']
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

export function useVerification(enabled: boolean) {
  return useQuery({
    queryKey: VERIFICATION_KEY,
    queryFn: () => getJson<VerificationSummary>('api/verification'),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** Captures matched to one request site, newest first. */
export function useSiteCaptures(siteId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['site-captures', siteId],
    queryFn: () => getJson<CaptureSummary[]>(`api/sites/${encodeURIComponent(siteId)}/captures`),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** Sets each site's status from the verification summary (the server does the same for /api/model). */
function applyVerification(model: AppModel, summary: VerificationSummary): AppModel {
  let changed = false
  const requests = model.requests.map((site) => {
    const verified = Boolean(summary.sites[site.id])
    if (site.status === 'inferred' && verified) {
      changed = true
      return { ...site, status: 'verified' as const }
    }
    if (site.status === 'verified' && !verified) {
      changed = true
      return { ...site, status: 'inferred' as const }
    }
    return site
  })
  return changed ? { ...model, requests } : model
}

function upsertCapture(client: ReturnType<typeof useQueryClient>, summary: CaptureSummary) {
  client.setQueryData<CaptureSummary[]>(CAPTURES_KEY, (list = []) => {
    const at = list.findIndex((c) => c.id === summary.id)
    if (at < 0) return [summary, ...list].slice(0, MAX_LIST)
    const next = [...list]
    next[at] = summary
    return next
  })
}

/** Manual match: a site id, `null` for "no site", or `undefined` to go back to automatic. */
export function useAssignMatch() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ captureId, siteId }: { captureId: string; siteId: string | null | undefined }) =>
      getJson<CaptureSummary>(
        `api/captures/${encodeURIComponent(captureId)}/match`,
        siteId === undefined
          ? { method: 'DELETE' }
          : {
              method: 'PUT',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ siteId }),
            },
      ),
    onSuccess: (summary) => {
      upsertCapture(client, summary)
      void client.invalidateQueries({ queryKey: ['capture'] })
      void client.invalidateQueries({ queryKey: ['site-captures'] })
      void client.invalidateQueries({ queryKey: VERIFICATION_KEY })
    },
  })
}

export type LiveStatus = 'connecting' | 'live' | 'offline'

/**
 * Subscribes to the live feed (server-sent events): new and re-matched captures, and site
 * verification changes, which also update the cached model's request statuses.
 */
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
      void client.invalidateQueries({ queryKey: VERIFICATION_KEY })
    })
    source.addEventListener('capture', (event) => {
      const summary = JSON.parse((event as MessageEvent<string>).data) as CaptureSummary
      upsertCapture(client, summary)
      // The open capture may have been re-matched, or a server hop may belong to it.
      void client.invalidateQueries({ queryKey: ['capture', summary.id] })
      if (summary.parentCaptureId) {
        void client.invalidateQueries({ queryKey: ['capture', summary.parentCaptureId] })
      }
    })
    source.addEventListener('verification', (event) => {
      const summary = JSON.parse((event as MessageEvent<string>).data) as VerificationSummary
      client.setQueryData(VERIFICATION_KEY, summary)
      client.setQueryData<AppModel>(['model'], (model) => model && applyVerification(model, summary))
      void client.invalidateQueries({ queryKey: ['site-captures'] })
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
      void client.invalidateQueries({ queryKey: VERIFICATION_KEY })
      void client.invalidateQueries({ queryKey: ['site-captures'] })
      void client.invalidateQueries({ queryKey: ['model'] })
    },
  })
}
