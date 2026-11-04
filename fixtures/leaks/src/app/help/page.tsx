import Link from 'next/link'

// Planted: an event handler on `next/link`, a client component, from a server page.
export default function HelpPage() {
  return (
    <Link href="/" onClick={() => console.log('back home')}>
      Back to the orders
    </Link>
  )
}
