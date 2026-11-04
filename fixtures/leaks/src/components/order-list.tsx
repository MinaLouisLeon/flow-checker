'use client'

// biome-ignore lint/style/useNodejsImportProtocol: Next has a browser version of `path`, but webpack rejects `node:path`
import { basename } from 'path'
import { useState } from 'react'
// A `'use server'` file: the browser gets references to its actions, not its imports (`fs`, `pg`).
import type { archiveOrder } from '@/actions/orders'
import { refreshOrders } from '@/actions/orders'
import type { Amount } from '@/lib/amount'
// Type-only: nothing of the database module reaches the browser.
import type { Order } from '@/lib/orders'

interface Props {
  orders: Order[]
  updatedAt: Date
  byStatus: Map<number, string>
  tags: Set<string>
  source: URL
  archive: typeof archiveOrder
  archiveFirst: () => Promise<void>
  format: (cents: number) => string
  total: Amount
}

export function OrderList({
  orders,
  updatedAt,
  byStatus,
  tags,
  source,
  archive,
  archiveFirst,
  format,
  total,
}: Props) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section>
      <p>
        {/* A `URL` arrives as what its `toJSON()` returns: the address as a string. */}
        {orders.length} orders from {basename(String(source))}, updated {updatedAt.toLocaleTimeString()} (
        {[...tags].join(', ')}), total {format(Number(total))}
      </p>
      <ul>
        {orders.map((order) => (
          <li key={order.id}>
            <button type="button" onClick={() => setOpen(order.id)}>
              #{order.id} {byStatus.get(order.id)}
            </button>
            {open === order.id && (
              <form action={archive.bind(null, order.id)}>
                <button type="submit">Archive</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <form action={archiveFirst}>
        <button type="submit">Archive the first</button>
      </form>
      <form action={refreshOrders}>
        <button type="submit">Refresh</button>
      </form>
    </section>
  )
}
