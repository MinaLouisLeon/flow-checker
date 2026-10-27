import 'server-only'
import type { CreateProductInput, Product } from '@/types/product'

const API_URL = process.env.API_URL ?? 'http://localhost:4010'

export async function listProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/products`, { cache: 'no-store' })
  return res.json()
}

export async function getProduct(id: number): Promise<Product | null> {
  const res = await fetch(`${API_URL}/products/${id}`, { cache: 'no-store' })
  return res.ok ? res.json() : null
}

export async function insertProduct(input: CreateProductInput): Promise<Product> {
  const res = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error((await res.json()).error ?? 'Create failed')
  return res.json()
}

export async function removeProduct(id: number): Promise<void> {
  await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' })
}
