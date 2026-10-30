// Server helpers for event stream route handlers.
const encoder = new TextEncoder()

/** One server-sent event. */
export function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export function eventStream(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
