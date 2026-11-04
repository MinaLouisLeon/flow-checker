'use client'

import { revalidatePath } from 'next/cache'

export function RefreshButton() {
  return (
    <button type="button" onClick={() => revalidatePath('/')}>
      Refresh
    </button>
  )
}
