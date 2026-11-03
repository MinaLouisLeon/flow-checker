'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

const API_URL = process.env.API_URL ?? 'http://localhost:4010'

export async function createTodo(formData: FormData) {
  await fetch(`${API_URL}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: String(formData.get('title')) }),
  })
  revalidateTag('todos')
  revalidatePath('/')
}

export async function toggleTodo(formData: FormData) {
  const id = String(formData.get('id'))
  await fetch(`${API_URL}/todos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done: formData.get('done') === 'true' }),
  })
  revalidateTag(`todo-${id}`)
}

export async function refreshProducts() {
  // A typo on purpose: the data's tag is `products`, so this refreshes nothing.
  revalidateTag('product')
  revalidatePath('/products', 'layout')
}
