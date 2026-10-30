import { Environment, type FetchFunction, Network, RecordSource, Store } from 'relay-runtime'

// Persisted documents only: the server looks the id up in persisted_queries.json.
const fetchQuery: FetchFunction = async (params, variables) => {
  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ doc_id: params.id, variables }),
  })
  return response.json()
}

export const environment = new Environment({
  network: Network.create(fetchQuery),
  store: new Store(new RecordSource()),
})
