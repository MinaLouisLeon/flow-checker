import { API_URL } from '@/lib/api-url'
import type { Todo } from '@/types'

// A cached fetch in a route handler. Nothing revalidates `stats` (flagged on purpose).
export async function GET() {
  const res = await fetch(`${API_URL}/todos`, { cache: 'force-cache', next: { tags: ['stats'] } })
  const todos: Todo[] = await res.json()
  return Response.json({ total: todos.length, done: todos.filter((t) => t.done).length })
}
