'use client'

import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import type { Product } from '@/lib/schemas'

// Client page calling a dynamic BFF route.
export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [product, setProduct] = useState<Product | null>(null)

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((res) => (res.ok ? (res.json() as Promise<Product>) : null))
      .then(setProduct)
  }, [id])

  return (
    <main>
      <h1>{product?.name ?? 'Loading…'}</h1>
      {product && <p>${product.price}</p>}
      <Link href="/">Back</Link>
    </main>
  )
}
