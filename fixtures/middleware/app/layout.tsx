import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata = { title: 'middleware fixture' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Home</Link> | <Link href="/dashboard">Dashboard</Link> |{' '}
          <Link href="/shop">Shop</Link>
        </nav>
        {children}
      </body>
    </html>
  )
}
