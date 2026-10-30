import type { ReactNode } from 'react'

export const metadata = { title: 'postman fixture' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-todos-url="http://localhost:4010/todos">
      <body>{children}</body>
    </html>
  )
}
