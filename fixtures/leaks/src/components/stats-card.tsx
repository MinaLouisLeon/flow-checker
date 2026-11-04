'use client'

import { useEffect, useState } from 'react'
import { countOrders } from '@/lib/stats'

export function StatsCard() {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    countOrders().then(setCount)
  }, [])
  return <p>{count ?? '...'} orders</p>
}
