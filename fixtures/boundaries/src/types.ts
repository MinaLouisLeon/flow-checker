export interface Todo {
  id: number
  title: string
  done: boolean
}

export interface User {
  id: number
  name: string
}

export interface Product {
  id: number
  name: string
  price: number
}

export interface Settings {
  theme: string
  locale: string
}
