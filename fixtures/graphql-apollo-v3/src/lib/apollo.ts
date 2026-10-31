import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'
import { createPersistedQueryLink } from '@apollo/client/link/persisted-queries'

// Hex SHA-256 with WebCrypto, as automatic persisted queries expect.
async function sha256(query: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(query))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Sends only the query hash first; on PersistedQueryNotFound Apollo retries with the full query.
export function makeClient() {
  return new ApolloClient({
    link: createPersistedQueryLink({ sha256 }).concat(new HttpLink({ uri: '/api/graphql' })),
    cache: new InMemoryCache(),
  })
}
