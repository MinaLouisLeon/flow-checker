import { ApolloClient, InMemoryCache } from '@apollo/client'
import { BatchHttpLink } from '@apollo/client/link/batch-http'

// Operations started within 20 ms of each other go out as one POST with an array body.
export function makeClient() {
  return new ApolloClient({
    link: new BatchHttpLink({ uri: '/api/graphql', batchMax: 5, batchInterval: 20 }),
    cache: new InMemoryCache(),
  })
}
