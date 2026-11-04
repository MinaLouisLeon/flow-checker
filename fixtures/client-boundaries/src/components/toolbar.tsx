'use client'

import { Tabs } from './tabs'

// No hooks, but it hands a function to `Tabs`: a server component couldn't.
export function Toolbar() {
  return <Tabs tabs={['Day', 'Week']} onSelect={(tab) => console.info('selected', tab)} />
}
