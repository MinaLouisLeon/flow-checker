import {
  type AppModel,
  applyVerification,
  type Capture,
  type CaptureSummary,
  type ExportCapture,
  type ExportData,
  type FlowsSummary,
  matchedSiteIds,
  type RecordedFlow,
  type ScanEvent,
  type ServerCaptureStatus,
  summarizeCapture,
  type VerificationSummary,
} from '@flow-checker/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

export type ExportFormat = 'md' | 'html'

/** `POST /api/export`. Mirrors the tool server's response. */
export interface ExportResult {
  /** Folder written, relative to the project root when inside it. */
  dir: string
  files: number
  redacted: boolean
  captures: ExportData['captureCounts']
}

/** Mirrors `ServerMeta` in @flow-checker/server. */
export interface Meta {
  root?: string
  appPort?: number
  version?: string
  scannedAt?: string
  canRescan: boolean
  /** Present when live capture is on. */
  capture?: { storeRaw: boolean }
  /** Files are watched and re-scanned on change. */
  watching?: boolean
  /** Present when the dashboard can export (M10): the folder each format is written to. */
  export?: Record<ExportFormat, string>
  /** Started by `flow-checker explore` (M28): the app isn't run from here. */
  explore?: {
    /** The project has a flow-checker setup, so its captures are shown. */
    setup: boolean
    /** Without a setup: the folder outside the project that holds the scan and exports. */
    dataDir?: string
    /** Commands that turn capture on, in order. */
    enableCapture: string[]
  }
  /** A static HTML export (M10): data is embedded, nothing can be changed. */
  exported?: {
    projectName: string
    generatedAt: string
    redacted: boolean
    captureCounts: ExportData['captureCounts']
  }
}

declare global {
  interface Window {
    /** Set by the static HTML export (`data.js`), which has no server to ask. */
    __FLOW_CHECKER__?: ExportData
  }
}

function embedded(): ExportData | undefined {
  return typeof window === 'undefined' ? undefined : window.__FLOW_CHECKER__
}

/** In an export: a capture for lists, newest first. */
function embeddedSummary(capture: ExportCapture): CaptureSummary {
  const summary = summarizeCapture(capture)
  return capture.stale ? { ...summary, stale: true } : summary
}

function embeddedCaptures(
  data: ExportData,
  keep: (c: ExportCapture) => boolean = () => true,
): CaptureSummary[] {
  return data.captures.filter(keep).map(embeddedSummary).reverse()
}

/** Meta for an export: what the dashboard shows instead of asking the server. */
function exportMeta(data: ExportData): Meta {
  const hasCaptures = data.captureCounts.total > 0
  return {
    canRescan: false,
    version: data.toolVersion,
    scannedAt: data.generatedAt,
    ...(hasCaptures ? { capture: { storeRaw: !data.redacted } } : {}),
    exported: {
      projectName: data.projectName,
      generatedAt: data.generatedAt,
      redacted: data.redacted,
      captureCounts: data.captureCounts,
    },
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
      const data = embedded()
      return data ? data.model : getJson<AppModel>('api/model')
    },
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: (): Promise<Meta> | Meta => {
      const data = embedded()
      return data ? exportMeta(data) : getJson<Meta>('api/meta')
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
const FLOWS_KEY = ['flows']
const LAST_SCAN_KEY = ['last-scan']
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
    queryFn: () => {
      const data = embedded()
      return data ? embeddedCaptures(data) : getJson<CaptureSummary[]>('api/captures?limit=1000')
    },
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useCapture(id: string | undefined) {
  return useQuery({
    queryKey: ['capture', id],
    queryFn: () => {
      const data = embedded()
      if (!data) return getJson<CaptureDetail>(`api/captures/${encodeURIComponent(id ?? '')}`)
      const capture = data.captures.find((c) => c.id === id)
      if (!capture) throw new Error('This capture is not in the export.')
      return { capture, children: embeddedCaptures(data, (c) => c.parent?.captureId === id) }
    },
    enabled: Boolean(id),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
}

export function useVerification(enabled: boolean) {
  return useQuery({
    queryKey: VERIFICATION_KEY,
    queryFn: () => {
      const data = embedded()
      if (!data) return getJson<VerificationSummary>('api/verification')
      return data.verification ?? { sites: {}, counts: { matched: 0, ambiguous: 0, unmatched: 0, manual: 0 } }
    },
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

const SERVER_CAPTURE_KEY = ['server-capture']

/** Whether server capture runs (M22). Updated by the live feed. Not part of an export. */
export function useServerCapture(enabled: boolean) {
  return useQuery({
    queryKey: SERVER_CAPTURE_KEY,
    queryFn: (): Promise<ServerCaptureStatus> | ServerCaptureStatus =>
      embedded() ? { state: 'waiting' } : getJson<ServerCaptureStatus>('api/server-capture'),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** Captures matched to one request site, newest first. */
export function useSiteCaptures(siteId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['site-captures', siteId],
    queryFn: () => {
      const data = embedded()
      if (!data) return getJson<CaptureSummary[]>(`api/sites/${encodeURIComponent(siteId)}/captures`)
      return embeddedCaptures(data, (c) => matchedSiteIds(c.match).includes(siteId))
    },
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })
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

// --- Flows ---------------------------------------------------------------------------------

/** Which inferred flows were walked, recorded variants, and the named recording in progress. */
export function useFlows(enabled: boolean) {
  return useQuery({
    queryKey: FLOWS_KEY,
    queryFn: () => {
      const data = embedded()
      return data ? (data.flows ?? { flows: {}, recorded: [] }) : getJson<FlowsSummary>('api/flows')
    },
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useRenameFlow() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ flowId, name }: { flowId: string; name: string }) => {
      const res = await fetch(`api/flows/${encodeURIComponent(flowId)}/name`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['model'] })
      void client.invalidateQueries({ queryKey: FLOWS_KEY })
    },
  })
}

/** Start (`name`) or stop (`undefined`) recording a named flow. */
export function useRecording() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (name: string | undefined) =>
      name === undefined
        ? getJson<RecordedFlow>('api/recordings/stop', { method: 'POST' })
        : getJson<{ id: string }>('api/recordings', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name }),
          }),
    onSuccess: () => void client.invalidateQueries({ queryKey: FLOWS_KEY }),
  })
}

export function useDeleteRecording() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`api/recordings/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: FLOWS_KEY }),
  })
}

export type LiveStatus = 'connecting' | 'live' | 'offline'

/** The latest re-scan the live feed announced (a file changed, or a manual re-scan). */
export function useLastScan(): ScanEvent | undefined {
  return (
    useQuery<ScanEvent | null>({
      queryKey: LAST_SCAN_KEY,
      queryFn: () => null,
      staleTime: Number.POSITIVE_INFINITY,
      enabled: false,
    }).data ?? undefined
  )
}

/**
 * Subscribes to the live feed (server-sent events): re-scans after a file change, new and
 * re-matched captures, and site verification changes, which also update the cached model's
 * request statuses.
 */
export function useLiveFeed(enabled: boolean): LiveStatus {
  const client = useQueryClient()
  const [status, setStatus] = useState<LiveStatus>('connecting')
  useEffect(() => {
    if (!enabled || embedded() || typeof EventSource === 'undefined') return
    const source = new EventSource('api/live')
    source.addEventListener('ready', () => {
      setStatus('live')
      // Catch up on anything that arrived while disconnected.
      void client.invalidateQueries({ queryKey: CAPTURES_KEY })
      void client.invalidateQueries({ queryKey: VERIFICATION_KEY })
      void client.invalidateQueries({ queryKey: FLOWS_KEY })
      void client.invalidateQueries({ queryKey: SERVER_CAPTURE_KEY })
    })
    source.addEventListener('server-capture', (event) => {
      client.setQueryData(
        SERVER_CAPTURE_KEY,
        JSON.parse((event as MessageEvent<string>).data) as ServerCaptureStatus,
      )
    })
    source.addEventListener('scan', (event) => {
      client.setQueryData(LAST_SCAN_KEY, JSON.parse((event as MessageEvent<string>).data) as ScanEvent)
      // The model changed: fetch it again, with everything that depends on it.
      for (const key of [['model'], ['meta'], VERIFICATION_KEY, FLOWS_KEY, ['site-captures'], ['capture']]) {
        void client.invalidateQueries({ queryKey: key })
      }
    })
    source.addEventListener('flows', (event) => {
      client.setQueryData(FLOWS_KEY, JSON.parse((event as MessageEvent<string>).data) as FlowsSummary)
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

/** Writes Markdown docs or the static site to the configured folder. */
export function useExport() {
  return useMutation({
    mutationFn: (input: { format: ExportFormat; raw: boolean; force?: boolean }) =>
      getJson<ExportResult>('api/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
  })
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
