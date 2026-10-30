import { getProducts } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  const products = await getProducts()
  return (
    <main>
      <h1>Products</h1>
      <ul>
        {products.map((product) => (
          <li key={product.id}>
            {product.name}: {product.price}
          </li>
        ))}
      </ul>
    </main>
  )
}
