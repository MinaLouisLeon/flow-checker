import type { ReactNode } from 'react'

export const metadata = { title: 'server-actions fixture' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
