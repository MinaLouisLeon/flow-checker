import { unstable_cache } from 'next/cache'
import type { User } from './types'

const API_URL = process.env.API_URL ?? 'http://localhost:4010'

// Cached for a day, or until the `/api/revalidate` webhook revalidates `viewer`.
export const getViewer = unstable_cache(
  async (): Promise<User> => {
    const res = await fetch(`${API_URL}/users/1`)
    return res.json()
  },
  ['viewer'],
  { tags: ['viewer'], revalidate: 86_400 },
)
