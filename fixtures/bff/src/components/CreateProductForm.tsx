'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import type { ApiError, CreateProductInput, Product } from '@/lib/schemas'

// Flow: submit -> POST /api/products -> (BFF) POST backend -> 201 navigate | 422 show issues.
export function CreateProductForm() {
  const router = useRouter()
  const [error, setError] = useState<ApiError | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const input: CreateProductInput = {
      name: String(form.get('name')),
      price: Number(form.get('price')),
      stock: Number(form.get('stock') || 0),
    }

    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    if (res.status === 201) {
      const product: Product = await res.json()
      router.push(`/products/${product.id}`)
    } else {
      setError(await res.json())
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Name" />
      <input name="price" type="number" step="0.01" placeholder="Price" />
      <input name="stock" type="number" placeholder="Stock" />
      <button type="submit">Create</button>
      {error && (
        <ul role="alert">
          <li>{error.error}</li>
          {error.issues?.map((issue) => (
            <li key={issue.path}>
              {issue.path}: {issue.message}
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
