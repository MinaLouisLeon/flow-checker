'use client'

import { trpc } from '@/utils/trpc'

export function HealthBadge() {
  const ping = trpc.ping.useQuery()
  return <p>API: {ping.data?.ok ? 'up' : '...'}</p>
}
