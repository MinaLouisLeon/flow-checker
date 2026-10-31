import { SettingsBadge } from '@/components/SettingsBadge'
import { SettingsPanel } from '@/components/SettingsPanel'

export default function SettingsPage() {
  return (
    <main>
      <h1>Settings</h1>
      <SettingsBadge />
      <SettingsPanel />
    </main>
  )
}
