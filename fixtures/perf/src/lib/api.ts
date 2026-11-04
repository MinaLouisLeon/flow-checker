// Backend calls for the server components. `?delay=` makes the mock API answer slowly, so capture
// timings show which requests wait for each other.
import type { Product, Todo, User } from './types'

const API = 'http://localhost:4010'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json() as Promise<T>
}

export function getUser(id: number) {
  return get<User>(`/users/${id}?delay=80`)
}

export function getProducts() {
  return get<Product[]>('/products?delay=80')
}

export function getProduct(id: number) {
  return get<Product>(`/products/${id}?delay=40`)
}

export function getTodos() {
  return get<Todo[]>('/todos?delay=40')
}

export function getUserTodos(userId: number) {
  return get<Todo[]>(`/todos?userId=${userId}&delay=40`)
}
