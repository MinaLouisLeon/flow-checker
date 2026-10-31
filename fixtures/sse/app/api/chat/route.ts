import { eventStream, sleep, sseEvent } from '@/lib/sse'
import type { ChatChunk, ChatDone, ChatRequest } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Streams the reply word by word (`chunk`), then the token count (`done`). */
export async function POST(request: Request) {
  const { prompt } = (await request.json()) as ChatRequest
  const words = `You said: ${prompt}`.split(' ')
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const word of words) {
        const chunk: ChatChunk = { delta: `${word} ` }
        controller.enqueue(sseEvent('chunk', chunk))
        await sleep(50)
      }
      const done: ChatDone = { tokens: words.length }
      controller.enqueue(sseEvent('done', done))
      controller.close()
    },
  })
  return eventStream(stream)
}
