'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { insertProduct, removeProduct } from '@/lib/backend'
import type { FormState } from '@/types/product'

// Used with useActionState: validates FormData, calls the backend, then redirects.
export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim()
  const price = Number(formData.get('price'))
  const stock = Number(formData.get('stock') ?? 0)

  const fieldErrors: FormState['fieldErrors'] = {}
  if (!name) fieldErrors.name = 'Name is required'
  if (!Number.isFinite(price) || price <= 0) fieldErrors.price = 'Price must be positive'
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  let id: number
  try {
    id = (await insertProduct({ name, price, stock })).id
  } catch (error) {
    return { error: (error as Error).message }
  }
  revalidatePath('/products')
  redirect(`/products/${id}`)
}

// Called directly from a client component's onClick.
export async function deleteProduct(id: number): Promise<void> {
  await removeProduct(id)
  revalidatePath('/products')
}
