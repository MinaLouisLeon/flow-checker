import Link from 'next/link'
import { archiveOrder } from '@/actions/orders'
import { formatTotal } from '@/components/format-total'
import { OrderActions } from '@/components/order-actions'
import { OrderList } from '@/components/order-list'
import { Amount } from '@/lib/amount'
import { listOrders } from '@/lib/orders'

// Everything here crosses to the browser: no leak on this page.
export default async function Home() {
  const orders = await listOrders()
  return (
    <main>
      <h1>Orders</h1>
      <OrderList
        orders={orders}
        updatedAt={new Date()}
        byStatus={new Map(orders.map((o) => [o.id, o.status]))}
        tags={new Set(['new', 'paid'])}
        source={new URL('https://example.com/orders')}
        // A server action, also bound to an argument.
        archive={archiveOrder}
        archiveFirst={archiveOrder.bind(null, orders[0]?.id ?? 0)}
        // A function from a `'use client'` file crosses as a reference.
        format={formatTotal}
        // A class with `toJSON` is sent as what `toJSON` returns.
        total={new Amount(orders.reduce((sum, o) => sum + o.total, 0))}
      />
      {orders[0] && <OrderActions id={orders[0].id} onArchive={archiveOrder} />}
      <Link href="/products">Products</Link>
    </main>
  )
}
