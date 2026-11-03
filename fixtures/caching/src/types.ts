export interface Todo {
  id: number
  userId: number
  title: string
  done: boolean
}

export interface Product {
  id: number
  name: string
  price: number
  stock: number
}

export interface User {
  id: number
  name: string
  email: string
}

export interface Settings {
  theme: string
  locale: string
}
