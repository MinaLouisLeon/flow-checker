import { getUser } from '@/lib/api'
import { getAccount, getSettings } from '@/lib/settings'

export default async function SettingsPage() {
  const [settings, owner, account] = await Promise.all([getSettings(), getUser(2), getAccount(1)])
  return (
    <main>
      <h1>Settings for {account.name}</h1>
      <p>
        {settings.locale} ({owner.email})
      </p>
    </main>
  )
}
