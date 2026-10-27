import type { AppModel } from '@flow-checker/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

/** Mirrors `ServerMeta` in @flow-checker/server. */
export interface Meta {
  root?: string
  appPort?: number
  version?: string
  scannedAt?: string
  canRescan: boolean
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
