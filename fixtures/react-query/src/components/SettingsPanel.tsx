'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { version } from 'react'
import { useApiQuery } from '@/hooks/useApiQuery'
import { QueryKey, SCOPES, STATS } from '@/services/keys'
import { fetchSettings } from '@/services/settings'
import { fetchTodos } from '@/services/todos'
import { fetchUsers } from '@/services/users'

// Keys from an enum (through the project hook), an `as const` object and a constant, and one
// that starts with a library value the scanner can't read.
export function SettingsPanel() {
  const queryClient = useQueryClient()
  const { data: settings } = useApiQuery({ queryKey: [QueryKey.Settings], queryFn: fetchSettings })
  const { data: users = [] } = useQuery({ queryKey: [SCOPES.users, STATS], queryFn: fetchUsers })
  const { data: todos = [] } = useQuery({ queryKey: [version, 'todos'], queryFn: fetchTodos })

  return (
    <section>
      <p>
        Locale: {settings?.locale ?? '…'} · {users.length} users · {todos.length} todos
      </p>
      <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: [QueryKey.Settings] })}>
        Reload settings
      </button>
      <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: [version] })}>
        Clear version cache
      </button>
    </section>
  )
}
