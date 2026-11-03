import type { ReactNode } from 'react'
import { AccountBar } from '@/components/account-bar'

// Every page in the group renders the cached viewer.
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <section>
      <AccountBar />
      {children}
    </section>
  )
}
