import { CreateProductForm } from '@/components/CreateProductForm'
import { ProductsTable } from '@/components/ProductsTable'

export default function HomePage() {
  return (
    <main>
      <h1>Products (via BFF)</h1>
      <CreateProductForm />
      <ProductsTable />
    </main>
  )
}
