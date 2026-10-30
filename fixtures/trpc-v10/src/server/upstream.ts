import type { Todo } from '@/types/todo'
import type { User } from '@/types/user'

const API_URL = process.env.API_URL ?? 'http://localhost:4010'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export const listTodos = () => api<Todo[]>('/todos')
export const getTodo = (id: number) => api<Todo>(`/todos/${id}`)
export const createTodo = (input: { title: string; userId: number }) =>
  api<Todo>('/todos', { method: 'POST', body: JSON.stringify(input) })
export const patchTodo = (id: number, patch: Partial<Pick<Todo, 'done' | 'title'>>) =>
  api<Todo>(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const listUsers = () => api<User[]>('/users')
