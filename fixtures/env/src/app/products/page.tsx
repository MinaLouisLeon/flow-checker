import { ProductLink } from '@/components/product-link'
import { getProducts } from '@/lib/api'

export const metadata = { title: 'Products' }

export default async function Products() {
  const products = await getProducts()
  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>
          <ProductLink id={p.id} name={p.name} />
        </li>
      ))}
    </ul>
  )
}
