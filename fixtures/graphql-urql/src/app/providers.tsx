'use client'

import { type ReactNode, useState } from 'react'
import { Provider } from 'urql'
import { makeClient } from '@/lib/urql'

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient)
  return <Provider value={client}>{children}</Provider>
}
