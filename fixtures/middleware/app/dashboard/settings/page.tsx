import { getSettings } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const settings = await getSettings()
  return (
    <main>
      <h1>Settings</h1>
      <p>Theme: {settings.theme}</p>
    </main>
  )
}
