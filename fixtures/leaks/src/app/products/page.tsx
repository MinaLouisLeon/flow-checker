import { ProductPicker } from '@/components/product-picker'

// Planted: a function handed to a client component (only server actions cross).
export default function ProductsPage() {
  return (
    <ProductPicker
      products={[
        { id: 1, name: 'Mug' },
        { id: 2, name: 'Plate' },
      ]}
      onSelect={(id: number) => console.log('picked', id)}
    />
  )
}
