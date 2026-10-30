export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'member'
}

export interface Settings {
  theme: string
  locale: string
  digest: string | null
}

export interface Product {
  id: number
  name: string
  price: number
  stock: number
}
