import Link from 'next/link'
import { DeleteProductButton } from '@/components/DeleteProductButton'
import { listProducts } from '@/lib/backend'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  const products = await listProducts()
  return (
    <main>
      <h1>Products</h1>
      <Link href="/products/new">New product</Link>
      <ul>
        {products.map((product) => (
          <li key={product.id}>
            <Link href={`/products/${product.id}`}>{product.name}</Link> ${product.price}
            <DeleteProductButton id={product.id} />
          </li>
        ))}
      </ul>
    </main>
  )
}
