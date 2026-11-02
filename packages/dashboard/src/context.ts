import { createContext, useContext } from 'react'
import type { LiveStatus, Meta } from './api'
import type { ModelIndex } from './model-index'

export interface DashboardData {
  index: ModelIndex
  meta: Meta
  /** Live feed connection, when capture is on. */
  live?: LiveStatus
  /** Page guards a captured session hit: route id -> guard ids (M31). */
  seenGuards?: Map<string, Set<string>>
}

export const DataContext = createContext<DashboardData | null>(null)

export function useData(): DashboardData {
  const data = useContext(DataContext)
  if (!data) throw new Error('useData() needs a loaded model')
  return data
}
