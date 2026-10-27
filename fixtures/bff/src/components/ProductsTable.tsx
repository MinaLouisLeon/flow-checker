'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Product } from '@/lib/schemas'

// Page-load request to the app's own route handler (first hop).
export function ProductsTable() {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json() as Promise<Product[]>)
      .then(setProducts)
  }, [])

  return (
    <table>
      <tbody>
        {products.map((p) => (
          <tr key={p.id}>
            <td>
              <Link href={`/products/${p.id}`}>{p.name}</Link>
            </td>
            <td>{p.price}</td>
            <td>{p.stock}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
