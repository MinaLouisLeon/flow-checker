import { apiUrl } from './config'

export interface Product {
  id: number
  name: string
}

export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${apiUrl}/products`)
  return res.json()
}
