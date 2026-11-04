'use client'

import { useState } from 'react'
import type { CartItem } from '@/lib/cart-item'
import { CartRow } from './cart-row'
import { Price } from './price'

export function Cart({ initial }: { initial: CartItem[] }) {
  const [items, setItems] = useState(initial)
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  return (
    <div>
      <ul>
        {items.map((item) => (
          <CartRow
            key={item.id}
            item={item}
            onRemove={() => setItems(items.filter((other) => other.id !== item.id))}
          />
        ))}
      </ul>
      <p>
        Total: <Price amount={total} />
      </p>
    </div>
  )
}
