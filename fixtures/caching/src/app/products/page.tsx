import { Suspense } from 'react'
import { listProducts } from '@/lib/products'

async function ProductList() {
  const products = await listProducts()
  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>
          {p.name}: {p.price}
        </li>
      ))}
    </ul>
  )
}

export default function ProductsPage() {
  return (
    <main>
      <h1>Products</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <ProductList />
      </Suspense>
    </main>
  )
}
