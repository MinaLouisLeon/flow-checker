import { formatPrice } from '@/lib/format'

export function Price({ amount }: { amount: number }) {
  return <span className="price">{formatPrice(amount)}</span>
}
