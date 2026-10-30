'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/client'

export function HealthBadge() {
  const trpc = useTRPC()
  const ping = useQuery(trpc.health.ping.queryOptions())
  return <p>API: {ping.data?.ok ? 'up' : '...'}</p>
}
