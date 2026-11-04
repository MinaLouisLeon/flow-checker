import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Nav } from '@/components/nav'

export const metadata: Metadata = {
  title: { template: '%s | Client boundaries', default: 'Client boundaries' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* A client component in the layout: a boundary on every page. */}
        <Nav />
        {children}
      </body>
    </html>
  )
}
