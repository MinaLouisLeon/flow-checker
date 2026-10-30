export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'member'
}

export interface Product {
  id: number
  name: string
  // Wrong on purpose: the API sends a number.
  price: string
  stock: number
}

export interface Todo {
  id: number
  userId: number
  title: string
  done: boolean
}

export interface NewTodo {
  title: string
  userId: number
}
