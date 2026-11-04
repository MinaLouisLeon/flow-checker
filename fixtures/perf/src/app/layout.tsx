import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: { template: '%s | Perf', default: 'Perf' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Home</Link> <Link href="/users/1">User</Link> <Link href="/products">Products</Link>{' '}
          <Link href="/catalog">Catalog</Link> <Link href="/todos">Todos</Link>{' '}
          <Link href="/settings">Settings</Link>
        </nav>
        {children}
      </body>
    </html>
  )
}
