'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { version } from 'react'
import { useApiQuery } from '@/hooks/useApiQuery'
import { fetchSettings, fetchTodos, fetchUsers, QueryKey, Scopes, STATS } from '@/services'

// v4: keys from an enum (through the project hook), an `as const` object and a constant, and one
// that starts with a library value the scanner can't read.
export function SettingsPanel() {
  const queryClient = useQueryClient()
  const { data: settings } = useApiQuery([QueryKey.Settings], fetchSettings)
  const { data: users = [] } = useQuery([Scopes.users, STATS], fetchUsers)
  const { data: todos = [] } = useQuery([version, 'todos'], fetchTodos)

  return (
    <section>
      <p>
        Locale: {settings?.locale ?? '…'} · {users.length} users · {todos.length} todos
      </p>
      <button type="button" onClick={() => queryClient.invalidateQueries([QueryKey.Settings])}>
        Reload settings
      </button>
      <button type="button" onClick={() => queryClient.invalidateQueries([version])}>
        Clear version cache
      </button>
    </section>
  )
}
