import { getProduct, getProducts } from '@/lib/api'

// Planted N+1: the details start together, but it is still one request per product.
export default async function CatalogPage() {
  const products = await getProducts()
  const details = await Promise.all(products.map((product) => getProduct(product.id)))
  return (
    <ul>
      {details.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}
