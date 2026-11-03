import { API_URL } from '@/lib/api-url'
import type { Product } from '@/types'

// The mock API answers 404 here, and Next only keeps a `fetch` that answers 200: every call misses
// the cache (flagged on purpose by the runtime check, M40). In a route handler, so the miss doesn't
// change how a page renders.
export async function GET() {
  const res = await fetch(`${API_URL}/products/featured`, { next: { revalidate: 300 } })
  const featured: Product[] = res.ok ? await res.json() : []
  return Response.json(featured)
}
