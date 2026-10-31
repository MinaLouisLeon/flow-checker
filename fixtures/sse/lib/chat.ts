import type { ChatChunk, ChatDone, ChatRequest } from './types'

/** Posts the prompt and reads the event stream by hand. Returns the token count. */
export async function streamChat(prompt: string, onDelta: (text: string) => void): Promise<number> {
  const body: ChatRequest = { prompt }
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
  })
  if (!response.body) return 0
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let tokens = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += value
    for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
      const frame = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const event = /^event: (.*)$/m.exec(frame)?.[1] ?? 'message'
      const data = /^data: (.*)$/m.exec(frame)?.[1] ?? ''
      if (event === 'chunk') onDelta((JSON.parse(data) as ChatChunk).delta)
      if (event === 'done') tokens = (JSON.parse(data) as ChatDone).tokens
    }
  }
  return tokens
}
