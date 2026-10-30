import type { NewTodo, Product, Todo, User } from '@/types'
import { API_URL } from './config'

export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_URL}/users`, { cache: 'no-store' })
  return res.json()
}

// No type: the Postman example fills it.
// biome-ignore lint/suspicious/noExplicitAny: on purpose, the fixture has no response type here
export async function getUser(id: string): Promise<any> {
  const res = await fetch(`${API_URL}/users/${id}`, { cache: 'no-store' })
  return res.json()
}

// Not in the collection.
export async function deleteUser(id: number): Promise<void> {
  await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' })
}

// `Product.price` says string; the collection's example (and the API) send a number.
export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/products`)
  return res.json()
}

export async function createTodo(input: NewTodo): Promise<Todo> {
  const res = await fetch(`${API_URL}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return res.json()
}
