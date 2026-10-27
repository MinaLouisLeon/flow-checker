export type Role = 'admin' | 'member'

export interface User {
  id: number
  name: string
  email: string
  role: Role
}

export interface Todo {
  id: number
  userId: number
  title: string
  done: boolean
}

export type UserSummary = Pick<User, 'id' | 'name'>
