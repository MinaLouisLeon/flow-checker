'use client'

import { useState } from 'react'

export function Tabs({ tabs, onSelect }: { tabs: string[]; onSelect: (tab: string) => void }) {
  const [active, setActive] = useState(tabs[0])
  return (
    <div role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={tab === active}
          onClick={() => {
            setActive(tab)
            onSelect(tab)
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
