'use client'

import type { ReactNode } from 'react'
import { Heading } from './heading'
import { Menu } from './menu'

// Nothing here needs the browser: the directive could move down to `Menu`.
export function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <Heading text={title} />
      <Menu items={['Profile', 'Orders']} />
      {children}
    </section>
  )
}
