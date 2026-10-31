'use client'

import { useApiQuery } from '@/hooks/useApiQuery'
import { fetchSettings, QueryKey } from '@/services'

// Mounts the same query as SettingsPanel (same key, same function): React Query sends one request.
export function SettingsBadge() {
  const { data } = useApiQuery([QueryKey.Settings], fetchSettings)
  return <p>Theme: {data?.theme ?? '…'}</p>
}
