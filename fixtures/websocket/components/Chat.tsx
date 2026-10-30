'use client'

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { SOCKET_URL } from '@/lib/config'
import type { ChatMessage, ClientEvents, ServerEvents } from '@/lib/types'

/** socket.io with typed events: kept in a ref, emits on submit, disconnects on "Leave". */
export function Chat() {
  const socketRef = useRef<Socket<ServerEvents, ClientEvents> | null>(null)
  const [user, setUser] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [left, setLeft] = useState(false)

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, { transports: ['websocket'] })
    socketRef.current.on('joined', (joined) => setUser(joined.user))
    socketRef.current.on('chat', (message) => setMessages((list) => [...list, message]))
    return () => {
      socketRef.current?.disconnect()
    }
  }, [])

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = event.currentTarget.elements.namedItem('text') as HTMLInputElement
    socketRef.current?.emit('chat', { text: input.value })
    input.value = ''
  }

  function leave() {
    socketRef.current?.disconnect()
    setLeft(true)
  }

  return (
    <section>
      <p>{user ? `Joined as ${user}` : 'Joining'}</p>
      <ul>
        {messages.map((m) => (
          <li key={m.id}>
            {m.user}: {m.text}
          </li>
        ))}
      </ul>
      <form onSubmit={send}>
        <input name="text" placeholder="Say something" />
        <button type="submit">Send</button>
      </form>
      <button type="button" onClick={leave}>
        Leave
      </button>
      {left && <p>Left the chat</p>}
    </section>
  )
}
