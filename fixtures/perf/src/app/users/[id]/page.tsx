import { notFound } from 'next/navigation'
import { getProducts, getUser, getUserTodos } from '@/lib/api'

// Not flagged: the todos need the user, the two lists start together, and the admins are a fixed list.
export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser(Number(id))
  if (!user) notFound()
  const [todos, products] = await Promise.all([getUserTodos(user.id), getProducts()])
  const admins = await Promise.all([1, 2].map((n) => getUser(n)))
  return (
    <main>
      <h1>{user.name}</h1>
      <p>
        {todos.length} todos, {products.length} products, {admins.length} admins
      </p>
    </main>
  )
}
