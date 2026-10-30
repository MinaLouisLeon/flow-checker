'use client'

import { Hydrate, type HydrateProps } from '@tanstack/react-query'

// v4's Hydrate has no 'use client' of its own, so server pages render it through this file.
export function HydrateClient(props: HydrateProps) {
  return <Hydrate {...props} />
}
