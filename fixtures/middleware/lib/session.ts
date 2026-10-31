import type { User } from '@/types/user'
import { API_URL } from './config'

/** The signed-in user for a session token, or null when the token is not valid. */
export async function getSessionUser(token: string): Promise<User | null> {
  const res = await fetch(`${API_URL}/me`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as User
}
