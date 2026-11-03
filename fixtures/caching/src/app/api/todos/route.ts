import { updateTag } from 'next/cache'
import { API_URL } from '@/lib/api-url'

// `updateTag` only works in server actions: Next throws here (flagged on purpose).
export async function POST(request: Request) {
  const res = await fetch(`${API_URL}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await request.text(),
  })
  updateTag('todos')
  return Response.json(await res.json(), { status: res.status })
}
