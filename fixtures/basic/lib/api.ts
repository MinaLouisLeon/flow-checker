import axios from 'axios'
import type { Todo, User } from '@/types/user'
import { API_URL } from './config'

// Wrapper client: the scanner must see through `api.*` to the axios instance.
export const api = axios.create({ baseURL: API_URL })

export function deleteUser(id: number) {
  return api.delete<void>(`/users/${id}`)
}

// Plain fetch helpers used by server components.
export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_URL}/users`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load users')
  return res.json()
}

export async function getUser(id: string): Promise<User> {
  const res = await fetch(`${API_URL}/users/${id}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to load user')
  return res.json()
}

export async function getTodos(userId: number): Promise<Todo[]> {
  const res = await fetch(`${API_URL}/todos?userId=${userId}`)
  return res.json()
}
