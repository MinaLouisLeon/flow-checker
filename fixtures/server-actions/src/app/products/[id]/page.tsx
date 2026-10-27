import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProduct } from '@/lib/backend'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getProduct(Number(id))
  if (!product) notFound()

  return (
    <main>
      <h1>{product.name}</h1>
      <p>
        ${product.price} · {product.stock} in stock
      </p>
      <Link href="/products">All products</Link>
    </main>
  )
}
