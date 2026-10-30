import { queryOptions } from '@tanstack/react-query'
import type { NewTodo, Todo, TodoPatch } from '@/types/todo'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4010'

// Generic JSON helper: the response type comes from the caller's type argument.
export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

// Key factory: functions that build on each other, so invalidating a prefix hits the rest.
export const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (filters: { done?: boolean }) => [...todoKeys.lists(), filters] as const,
  details: () => [...todoKeys.all, 'detail'] as const,
  detail: (id: number) => [...todoKeys.details(), id] as const,
}

export const fetchTodos = () => http<Todo[]>('/todos')

export const fetchTodo = (id: number) => http<Todo>(`/todos/${id}`)

export const createTodo = (input: NewTodo) =>
  http<Todo>('/todos', { method: 'POST', body: JSON.stringify(input) })

export const updateTodo = (id: number, patch: TodoPatch) =>
  http<Todo>(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })

// Query options factories (v5 `queryOptions`), used by hooks and `queryClient` methods alike.
export const todoQueries = {
  list: (filters: { done?: boolean } = {}) =>
    queryOptions({ queryKey: todoKeys.list(filters), queryFn: fetchTodos }),
  detail: (id: number) => queryOptions({ queryKey: todoKeys.detail(id), queryFn: () => fetchTodo(id) }),
}
