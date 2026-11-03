'use cache'

import { cacheTag } from 'next/cache'
import type { Settings } from '@/types'
import { API_URL } from './api-url'

// Every function in this file is cached. Nothing revalidates `settings` (flagged on purpose).
export async function getSettings(): Promise<Settings> {
  cacheTag('settings')
  const res = await fetch(`${API_URL}/settings`)
  return res.json()
}
