'use client'

interface Product {
  id: number
  name: string
}

export function ProductPicker({
  products,
  onSelect,
}: {
  products: Product[]
  onSelect: (id: number) => void
}) {
  return (
    <select onChange={(e) => onSelect(Number(e.target.value))}>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}
