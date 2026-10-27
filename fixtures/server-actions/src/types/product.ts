export interface Product {
  id: number
  name: string
  price: number
  stock: number
}

export type CreateProductInput = Omit<Product, 'id'>

export interface FormState {
  error?: string
  fieldErrors?: Partial<Record<keyof CreateProductInput, string>>
}
