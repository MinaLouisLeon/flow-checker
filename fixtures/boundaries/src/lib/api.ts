import type { Product, Settings, Todo, User } from '@/types'

const API = 'http://localhost:4010'

// Each request asks for fresh data, so the pages that make them render per request.
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${path} answered ${res.status}`)
  return res.json() as Promise<T>
}

export const listTodos = () => get<Todo[]>('/todos')
export const listUsers = () => get<User[]>('/users')
export const getSettings = () => get<Settings>('/settings')

export async function findProduct(id: string): Promise<Product | undefined> {
  const res = await fetch(`${API}/products/${id}`, { cache: 'no-store' })
  if (res.status === 404) return undefined
  return res.json() as Promise<Product>
}
