'use client'

import { useQuery } from '@apollo/client/react'
import { graphql } from '@/gql'

const ViewerQuery = graphql(`
  query Viewer {
    viewer {
      id
      name
    }
  }
`)

export function ViewerBadge() {
  const { data } = useQuery(ViewerQuery)
  return <p>Signed in as {data?.viewer.name ?? '...'}</p>
}
