import { cacheExchange, createClient, fetchExchange } from 'urql'

// Queries go out as GET with ?query=&variables=; mutations stay POST.
export function makeClient() {
  return createClient({
    url: '/api/graphql',
    exchanges: [cacheExchange, fetchExchange],
    preferGetMethod: true,
  })
}
