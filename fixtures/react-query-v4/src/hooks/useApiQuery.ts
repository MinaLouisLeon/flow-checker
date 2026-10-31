import { type QueryFunction, type QueryKey, useQuery } from '@tanstack/react-query'

// v4: a project query hook (an arrow with positional arguments) that forwards its key and query
// function to React Query (M24).
export const useApiQuery = <T>(queryKey: QueryKey, queryFn: QueryFunction<T>) =>
  useQuery(queryKey, queryFn, { staleTime: 60_000 })
