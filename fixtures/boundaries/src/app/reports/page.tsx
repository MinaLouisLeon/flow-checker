import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/error-boundary'
import { getSettings, listTodos } from '@/lib/api'

async function ReportTable() {
  const todos = await listTodos()
  return <p>{todos.length} rows</p>
}

async function SettingsPanel() {
  const settings = await getSettings()
  return <p>{settings.theme}</p>
}

export const metadata = { title: { absolute: 'Reports' } }

export default async function ReportsPage() {
  const theme = (await cookies()).get('theme')?.value ?? 'light'
  return (
    <main data-theme={theme}>
      <Suspense fallback={<p>Loading report…</p>}>
        <ReportTable />
      </Suspense>
      <Suspense fallback={null}>
        <ErrorBoundary fallback={<p>Settings are not available.</p>}>
          <SettingsPanel />
        </ErrorBoundary>
      </Suspense>
    </main>
  )
}
