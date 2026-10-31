'use client'

import { useApiQuery } from '@/hooks/useApiQuery'
import { QueryKey } from '@/services/keys'
import { fetchSettings } from '@/services/settings'

// Mounts the same query as SettingsPanel (same key, same function): React Query sends one request.
export function SettingsBadge() {
  const { data } = useApiQuery({ queryKey: [QueryKey.Settings], queryFn: fetchSettings })
  return <p>Theme: {data?.theme ?? '…'}</p>
}
