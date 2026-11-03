import { type ReactNode, Suspense } from 'react'

export const metadata = { title: 'Dashboard' }

export default function DashboardLayout({
  children,
  team,
  stats,
}: {
  children: ReactNode
  team: ReactNode
  stats: ReactNode
}) {
  return (
    <section>
      {children}
      <aside>{team}</aside>
      <Suspense fallback={<p>Loading stats…</p>}>{stats}</Suspense>
    </section>
  )
}
