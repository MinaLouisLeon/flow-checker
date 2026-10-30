import type { ClockStatus, Tick } from '@/lib/types'

export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** A few `tick` events, an unnamed status event, then `done`. */
export async function GET(request: Request) {
  const count = Number(new URL(request.url).searchParams.get('count') ?? 3)
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      controller.enqueue(encoder.encode(': connected\n\n'))
      for (let n = 1; n <= count; n++) {
        const tick: Tick = { n, at: new Date().toISOString() }
        send('tick', tick)
        await sleep(200)
      }
      const status: ClockStatus = { state: 'stopped', ticks: count }
      // No `event:` line: this is what `onmessage` gets.
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(status)}\n\n`))
      send('done', { ok: true })
      controller.close()
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}
