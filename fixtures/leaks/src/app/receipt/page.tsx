import { ReceiptTotal } from '@/components/receipt-total'
import { Money } from '@/lib/amount'

// Planted: a class instance with no `toJSON` handed to a client component.
export default function ReceiptPage() {
  return <ReceiptTotal total={new Money(4250, 'EUR')} />
}
