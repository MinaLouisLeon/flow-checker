import type { Account, NewTodo, Settings, Todo } from '@/types'
import { API_URL } from './config'

export async function getAccounts(): Promise<Account[]> {
  const res = await fetch(`${API_URL}/users`, { cache: 'no-store' })
  return res.json()
}

export async function getSettings(): Promise<Settings> {
  const res = await fetch(`${API_URL}/settings`)
  return res.json()
}

export async function getTodos(): Promise<Todo[]> {
  const res = await fetch(`${API_URL}/todos`)
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
