import { unstable_cache } from 'next/cache'
import type { Product } from '@/lib/types'
import { refreshProducts } from '../actions'

const API_URL = process.env.API_URL ?? 'http://localhost:4010'

export default async function ProductsPage() {
  // `unstable_cache` written inline. Its tag `products` is never revalidated (see `refreshProducts`).
  const listProducts = unstable_cache(
    async (): Promise<Product[]> => (await fetch(`${API_URL}/products`)).json(),
    ['products'],
    { tags: ['products'], revalidate: 300 },
  )
  const products = await listProducts()
  // The mock API answers 404 here, and Next only keeps a `fetch` that answers 200: every call
  // misses the cache (flagged on purpose by the runtime check, M40).
  const featured = await fetch(`${API_URL}/products/featured`, { cache: 'force-cache' })
  return (
    <main>
      <h1>Products</h1>
      <p>{featured.ok ? 'Featured products' : 'No featured products'}</p>
      <ul>
        {products.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
      <form action={refreshProducts}>
        <button type="submit">Refresh</button>
      </form>
    </main>
  )
}
