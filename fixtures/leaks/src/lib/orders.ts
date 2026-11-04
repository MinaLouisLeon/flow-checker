import 'server-only'

export interface Order {
  id: number
  status: 'new' | 'paid'
  total: number
  createdAt: Date
}

export async function listOrders(): Promise<Order[]> {
  return [
    { id: 1, status: 'new', total: 1250, createdAt: new Date('2026-11-01') },
    { id: 2, status: 'paid', total: 990, createdAt: new Date('2026-11-02') },
  ]
}
