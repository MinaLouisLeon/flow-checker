import { notFound } from 'next/navigation'
import { findProduct } from '@/lib/api'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `Photo ${id}` }
}

export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await findProduct(id)
  if (!product) notFound()
  return <h1>{product.name}</h1>
}
