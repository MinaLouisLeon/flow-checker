import { createContext, useContext } from 'react'
import type { Meta } from './api'
import type { ModelIndex } from './model-index'

export interface DashboardData {
  index: ModelIndex
  meta: Meta
}

export const DataContext = createContext<DashboardData | null>(null)

export function useData(): DashboardData {
  const data = useContext(DataContext)
  if (!data) throw new Error('useData() needs a loaded model')
  return data
}
