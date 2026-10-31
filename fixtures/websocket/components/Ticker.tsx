'use client'

import { useEffect, useState } from 'react'
import { WS_URL } from '@/lib/config'
import type { Quote, Subscribe } from '@/lib/types'

const QUOTES = 3

/** A native WebSocket opened on page load: subscribes, reads JSON quotes, closes after three. */
export function Ticker() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/live`, 'ticker.v1')
    ws.addEventListener('open', () => {
      const subscribe: Subscribe = { type: 'subscribe', symbols: ['ACME', 'BETA'] }
      ws.send(JSON.stringify(subscribe))
    })
    let count = 0
    ws.addEventListener('message', (event) => {
      const quote = JSON.parse(event.data) as Quote
      setQuotes((list) => [...list, quote])
      count++
      if (count === QUOTES) ws.close(1000, 'enough quotes')
    })
    ws.addEventListener('close', () => setClosed(true))
    return () => ws.close()
  }, [])

  return (
    <section>
      <ul>
        {quotes.map((q, i) => (
          <li key={i}>
            {q.symbol} {q.price}
          </li>
        ))}
      </ul>
      <p>{closed ? `Ticker closed after ${quotes.length} quotes` : 'Ticker running'}</p>
    </section>
  )
}
