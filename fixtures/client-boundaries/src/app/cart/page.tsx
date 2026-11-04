import { Cart } from '@/components/cart'

export const metadata = { title: 'Cart' }

export default function CartPage() {
  return (
    <main>
      <h1>Cart</h1>
      <Cart
        initial={[
          { id: 'a', name: 'Mug', price: 12, quantity: 1 },
          { id: 'b', name: 'Tea', price: 6, quantity: 2 },
        ]}
      />
    </main>
  )
}
