import { BuildBadge } from '@/components/build-badge'
import { getProducts } from '@/lib/api'

export default async function Home() {
  const products = await getProducts()
  // Never defined, but the fallback covers it.
  const ttl = Number(process.env.CACHE_TTL ?? '60')
  return (
    <main>
      <h1>Products ({ttl}s)</h1>
      <ul>
        {products.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
      <BuildBadge />
    </main>
  )
}
