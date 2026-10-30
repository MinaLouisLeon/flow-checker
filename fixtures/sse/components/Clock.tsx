'use client'

import { useEffect, useState } from 'react'
import type { ClockStatus, Tick } from '@/lib/types'

/** Opens an event stream on page load: named `tick` events and an unnamed status event. */
export function Clock() {
  const [ticks, setTicks] = useState<Tick[]>([])
  const [status, setStatus] = useState<ClockStatus | null>(null)

  useEffect(() => {
    const source = new EventSource('/api/clock?count=3')
    source.addEventListener('tick', (event) => {
      const tick = JSON.parse(event.data) as Tick
      setTicks((list) => [...list, tick])
    })
    source.onmessage = (event: MessageEvent<string>) => {
      const next: ClockStatus = JSON.parse(event.data)
      setStatus(next)
    }
    // The server ends the stream after `done`. Without close(), EventSource reconnects.
    source.addEventListener('done', () => source.close())
    return () => source.close()
  }, [])

  return (
    <section>
      <ul>
        {ticks.map((tick) => (
          <li key={tick.n}>tick {tick.n}</li>
        ))}
      </ul>
      <p>{status ? `Clock ${status.state} after ${status.ticks} ticks` : 'Clock running'}</p>
    </section>
  )
}
