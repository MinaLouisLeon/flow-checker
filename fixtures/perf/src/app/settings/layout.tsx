import type { ReactNode } from 'react'
import { getUser } from '@/lib/api'
import { getAccount, getSettings } from '@/lib/settings'

// Planted duplicate: the page asks for the same settings through axios. Not flagged: `getUser`
// (a GET fetch, which Next dedupes) and `getAccount` (wrapped in React's `cache()`).
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const [settings, owner, account] = await Promise.all([getSettings(), getUser(2), getAccount(1)])
  return (
    <section data-theme={settings.theme}>
      <p>
        {owner.name} / {account.name}
      </p>
      {children}
    </section>
  )
}
