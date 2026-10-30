import type { Todo } from '@/types/todo'

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
export const createTodo = (title: string) =>
  api<Todo>('/todos', { method: 'POST', body: JSON.stringify({ title }) })
export const patchTodo = (id: number, done: boolean) =>
  api<Todo>(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) })
/** Untyped on purpose: the procedure's `.output()` schema gives the type. */
export const fetchUsers = (): Promise<unknown> => api('/users')
export const fetchUser = (id: number): Promise<unknown> => api(`/users/${id}`)
