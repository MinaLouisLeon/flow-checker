import type { ReactNode } from 'react'

// A server component around the client bar: what it renders inside is fine.
export function FilterShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  )
}
