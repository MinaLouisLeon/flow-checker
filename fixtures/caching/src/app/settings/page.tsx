import { getSettings } from '@/lib/settings'

export default async function SettingsPage() {
  const settings = await getSettings()
  return (
    <main>
      <h1>Settings</h1>
      <p>
        {settings.theme} / {settings.locale}
      </p>
    </main>
  )
}
