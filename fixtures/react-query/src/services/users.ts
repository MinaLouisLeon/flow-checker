import { queryOptions } from '@tanstack/react-query'
import type { Todo } from '@/types/todo'
import type { User } from '@/types/user'
import { http } from './todos'

export const userKeys = {
  all: ['users'] as const,
  detail: (id: number) => ['users', id] as const,
  todos: (userId: number) => ['todos', 'list', { userId }] as const,
}

export const fetchUsers = () => http<User[]>('/users')

export const fetchUser = (id: number) => http<User>(`/users/${id}`)

export const fetchUserTodos = (userId: number) => http<Todo[]>(`/todos?userId=${userId}`)

export function userQueries() {
  return queryOptions({ queryKey: userKeys.all, queryFn: fetchUsers })
}

export const userQuery = (id: number) =>
  queryOptions({ queryKey: userKeys.detail(id), queryFn: () => fetchUser(id), staleTime: 30_000 })
