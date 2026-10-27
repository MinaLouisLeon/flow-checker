import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata = { title: 'basic fixture' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Users</Link> | <Link href="/about">About</Link>
        </nav>
        {children}
      </body>
    </html>
  )
}
