import { SettingsPanel } from '@/components/SettingsPanel'
import { TodoPanel } from '@/components/TodoPanel'
import { getAccounts } from '@/lib/api'

export const dynamic = 'force-dynamic'

// Server component: the response doesn't match `Account[]`.
export default async function HomePage() {
  const accounts = await getAccounts()
  return (
    <main>
      <h1>Accounts</h1>
      <ul>
        {accounts.map((account) => (
          <li key={account.id}>
            {account.name} ({account.email})
          </li>
        ))}
      </ul>
      <SettingsPanel />
      <TodoPanel />
    </main>
  )
}
