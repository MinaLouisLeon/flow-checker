import type { ReactNode } from 'react'

export default function ReportsTemplate({ children }: { children: ReactNode }) {
  return <div className="reports">{children}</div>
}
