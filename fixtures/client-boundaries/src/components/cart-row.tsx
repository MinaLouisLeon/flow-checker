import { CartItemSchema } from '@/lib/cart-item'
import { Price } from './price'

// No directive: it runs on the client because `Cart` imports it.
export function CartRow({ item, onRemove }: { item: unknown; onRemove: () => void }) {
  const parsed = CartItemSchema.parse(item)
  return (
    <li>
      {parsed.name} × {parsed.quantity} <Price amount={parsed.price} />
      <button type="button" onClick={onRemove}>
        Remove
      </button>
    </li>
  )
}
