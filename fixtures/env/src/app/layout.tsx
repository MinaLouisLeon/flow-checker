import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Analytics } from '@/components/analytics'

export const metadata: Metadata = {
  title: { template: '%s | Env', default: 'Env' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* A NEXT_PUBLIC_ name read directly: inlined into the browser bundle. */}
        <Analytics />
        {children}
      </body>
    </html>
  )
}
