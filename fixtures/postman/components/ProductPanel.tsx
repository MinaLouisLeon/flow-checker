'use client'

import { useEffect, useState } from 'react'
import { getProducts } from '@/lib/api'
import type { Product } from '@/types'

export function ProductPanel() {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    getProducts().then(setProducts)
  }, [])

  return (
    <section>
      <h2>Products</h2>
      <ul>
        {products.map((product) => (
          <li key={product.id}>
            {product.name}: {product.price}
          </li>
        ))}
      </ul>
    </section>
  )
}
