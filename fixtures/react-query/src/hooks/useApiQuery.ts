import { type QueryFunction, type QueryKey, useQuery } from '@tanstack/react-query'

// A project query hook that forwards its key and query function to React Query (M24): each call
// is its own query site, with the key it is given.
export function useApiQuery<T>({ queryKey, queryFn }: { queryKey: QueryKey; queryFn: QueryFunction<T> }) {
  return useQuery({ queryKey, queryFn, staleTime: 60_000 })
}
