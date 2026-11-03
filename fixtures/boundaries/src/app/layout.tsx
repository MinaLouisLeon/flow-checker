import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: { template: '%s | Boundaries', default: 'Boundaries' },
  description: 'flow-checker boundaries fixture',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Home</Link> <Link href="/dashboard">Dashboard</Link>{' '}
          <Link href="/photos">Photos</Link> <Link href="/reports">Reports</Link>{' '}
          <Link href="/account">Account</Link> <Link href="/blog/hello">Blog</Link>
        </nav>
        {children}
      </body>
    </html>
  )
}
