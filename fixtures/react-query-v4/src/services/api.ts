import type { NewTodo, Todo, TodoPatch } from '@/types/todo'
import type { User } from '@/types/user'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4010'

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export const todoKeys = {
  all: ['todos'] as const,
  lists: () => [...todoKeys.all, 'list'] as const,
  list: (userId: number) => [...todoKeys.lists(), { userId }] as const,
  detail: (id: number) => [...todoKeys.all, 'detail', id] as const,
}

export const fetchTodos = () => http<Todo[]>('/todos')
export const fetchTodo = (id: number) => http<Todo>(`/todos/${id}`)
export const fetchUserTodos = (userId: number) => http<Todo[]>(`/todos?userId=${userId}`)
export const createTodo = (input: NewTodo) =>
  http<Todo>('/todos', { method: 'POST', body: JSON.stringify(input) })
export const updateTodo = (id: number, patch: TodoPatch) =>
  http<Todo>(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })

export const fetchUsers = () => http<User[]>('/users')
export const deleteUser = (id: number) => http<User>(`/users/${id}`, { method: 'DELETE' })
