import { getProducts, getUser } from '@/lib/api'

// Planted waterfall: the products don't need the user, but wait for it.
export default async function Home() {
  const user = await getUser(1)
  const products = await getProducts()
  return (
    <main>
      <h1>Hello {user.name}</h1>
      <p>{products.length} products</p>
    </main>
  )
}
