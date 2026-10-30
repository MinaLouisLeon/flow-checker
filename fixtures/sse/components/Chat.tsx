'use client'

import { type FormEvent, useState } from 'react'
import { streamChat } from '@/lib/chat'

/** Sends the prompt and shows the reply as it streams in. */
export function Chat() {
  const [prompt, setPrompt] = useState('')
  const [reply, setReply] = useState('')
  const [tokens, setTokens] = useState<number | null>(null)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setReply('')
    setTokens(await streamChat(prompt, (delta) => setReply((text) => text + delta)))
  }

  return (
    <form onSubmit={onSubmit}>
      <input placeholder="Say something" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <button type="submit">Send</button>
      <p>{reply}</p>
      {tokens !== null && <p>{tokens} tokens</p>}
    </form>
  )
}
