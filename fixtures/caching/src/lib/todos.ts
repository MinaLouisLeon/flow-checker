import { cacheLife, cacheTag } from 'next/cache'
import type { Todo } from '@/types'
import { API_URL } from './api-url'

// Cached functions: the server actions refresh each tag with `updateTag`.
export async function listTodos(): Promise<Todo[]> {
  'use cache'
  cacheLife('hours')
  cacheTag('todos')
  const res = await fetch(`${API_URL}/todos`)
  return res.json()
}

export async function getTodo(id: string): Promise<Todo> {
  'use cache'
  cacheTag(`todo-${id}`)
  const res = await fetch(`${API_URL}/todos/${id}`)
  return res.json()
}
