import { unstable_cache } from 'next/cache'
import { API_URL } from './api-url'

/** @returns {Promise<import('@/types').User[]>} */
async function loadUsers() {
  const res = await fetch(`${API_URL}/users`)
  return res.json()
}

export const getUsers = unstable_cache(loadUsers, ['users'], { tags: ['users'], revalidate: 60 })
