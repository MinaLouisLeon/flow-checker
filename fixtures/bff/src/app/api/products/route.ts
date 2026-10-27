import { NextResponse } from 'next/server'
import { backend } from '@/lib/backend'
import { type ApiError, CreateProductSchema, type Product } from '@/lib/schemas'

// GET /api/products -> GET {BACKEND}/products
export async function GET() {
  const res = await backend('/products')
  const products: Product[] = await res.json()
  return NextResponse.json(products)
}

// POST /api/products -> validate -> POST {BACKEND}/products
export async function POST(request: Request) {
  const parsed = CreateProductSchema.safeParse(await request.json())
  if (!parsed.success) {
    const body: ApiError = {
      error: 'Validation failed',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    }
    return NextResponse.json(body, { status: 422 })
  }

  const res = await backend('/products', { method: 'POST', body: JSON.stringify(parsed.data) })
  const created: Product = await res.json()
  return NextResponse.json(created, { status: 201 })
}
