import { NextResponse } from 'next/server'
import { backend } from '@/lib/backend'
import type { ApiError, Product } from '@/lib/schemas'

// GET /api/products/:id -> GET {BACKEND}/products/:id
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await backend(`/products/${id}`)
  if (!res.ok) {
    return NextResponse.json<ApiError>({ error: 'Product not found' }, { status: 404 })
  }
  const product: Product = await res.json()
  return NextResponse.json(product)
}
