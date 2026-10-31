'use client'

import type { ReactNode } from 'react'
import { RelayEnvironmentProvider } from 'react-relay'
import { environment } from '@/relay/environment'

export function Providers({ children }: { children: ReactNode }) {
  return <RelayEnvironmentProvider environment={environment}>{children}</RelayEnvironmentProvider>
}
