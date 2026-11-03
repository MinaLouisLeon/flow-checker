'use server'

import { revalidatePath, revalidateTag, updateTag } from 'next/cache'
import { API_URL } from '@/lib/api-url'

export async function createTodo(formData: FormData) {
  await fetch(`${API_URL}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: String(formData.get('title')) }),
  })
  updateTag('todos')
  revalidatePath('/')
}

export async function toggleTodo(formData: FormData) {
  const id = String(formData.get('id'))
  await fetch(`${API_URL}/todos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done: formData.get('done') === 'true' }),
  })
  updateTag(`todo-${id}`)
  revalidatePath('/todos/[id]', 'page')
}

export async function refreshUsers() {
  revalidateTag('users', 'max')
  // Typos on purpose: no data has the tag `user`, and no page is at `/user`.
  revalidateTag('user', 'max')
  revalidatePath('/user')
}
