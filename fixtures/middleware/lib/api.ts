import type { Product, Settings, User } from '@/types/user'
import { API_URL } from './config'

export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_URL}/users`, { cache: 'no-store' })
  return res.json()
}

export async function getSettings(): Promise<Settings> {
  const res = await fetch(`${API_URL}/settings`, { cache: 'no-store' })
  return res.json()
}

export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/products`, { cache: 'no-store' })
  return res.json()
}
