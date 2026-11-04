import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export interface Session {
  userId: string
  role: 'admin' | 'member'
}

/** The signed-in user, or null. */
export async function auth(): Promise<Session | null> {
  const token = (await cookies()).get('session')?.value
  if (!token) return null
  return { userId: token, role: token === 'admin' ? 'admin' : 'member' }
}

/** Sends visitors who aren't signed in to the login page. */
export async function requireUser(): Promise<Session> {
  const session = await auth()
  if (!session) redirect('/login')
  return session
}

/** Wraps an action so only admins can run it. */
export function withAdmin<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    const session = await auth()
    if (session?.role !== 'admin') throw new Error('Forbidden')
    return fn(...args)
  }
}

/** Wraps an action to log its errors. It checks nothing. */
export function action<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      console.error(error)
      throw error
    }
  }
}
