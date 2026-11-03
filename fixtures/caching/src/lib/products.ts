import type { Product } from '@/types'
import { API_URL } from './api-url'

// A tagged fetch, refreshed by the `/api/revalidate` route handler.
export async function listProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/products`, { next: { tags: ['products'], revalidate: 300 } })
  return res.json()
}
