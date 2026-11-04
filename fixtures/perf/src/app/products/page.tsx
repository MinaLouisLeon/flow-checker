import { getProduct, getProducts } from '@/lib/api'
import type { Product } from '@/lib/types'

// Planted N+1: one request for the list, then one per product, each waiting for the one before.
export default async function ProductsPage() {
  const products = await getProducts()
  const details: Product[] = []
  for (const product of products) {
    details.push(await getProduct(product.id))
  }
  return (
    <ul>
      {details.map((p) => (
        <li key={p.id}>
          {p.name}: {p.stock} left
        </li>
      ))}
    </ul>
  )
}
