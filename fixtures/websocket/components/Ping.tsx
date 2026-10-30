'use client'

import { useState } from 'react'
import { WS_URL } from '@/lib/config'

/** A short-lived WebSocket opened on click: sends text, reads the text answer, closes. */
export function Ping() {
  const [answer, setAnswer] = useState<string | null>(null)

  function ping() {
    const socket = new WebSocket(`${WS_URL}/echo`)
    socket.onopen = () => socket.send('ping')
    socket.onmessage = (event: MessageEvent<string>) => {
      setAnswer(event.data)
      socket.close()
    }
  }

  return (
    <p>
      <button type="button" onClick={ping}>
        Ping
      </button>{' '}
      {answer && <span>Answer: {answer}</span>}
    </p>
  )
}
