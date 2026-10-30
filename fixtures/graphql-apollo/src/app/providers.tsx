'use client'

import { ApolloProvider } from '@apollo/client/react'
import { type ReactNode, useState } from 'react'
import { makeClient } from '@/lib/apollo'

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient)
  return <ApolloProvider client={client}>{children}</ApolloProvider>
}
