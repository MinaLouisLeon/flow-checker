'use client'

import { useState } from 'react'

export function Counter({ start }: { start: number }) {
  const [count, setCount] = useState(start)
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  )
}
