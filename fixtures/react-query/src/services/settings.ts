import type { Settings } from '@/types/settings'
import { http } from './todos'

export const fetchSettings = () => http<Settings>('/settings')
