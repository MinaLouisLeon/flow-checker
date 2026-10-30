import type { ReactNode } from 'react'
import { Providers } from './providers'

export const metadata = { title: 'Apollo Client 4 fixture' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
