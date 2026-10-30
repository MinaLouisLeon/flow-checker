import { eventStream, sleep, sseEvent } from '@/lib/sse'

export const dynamic = 'force-dynamic'

const STEPS = ['queued', 'building', 'testing', 'deploying']

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const [i, step] of STEPS.entries()) {
        // The percentage goes out as text ("25%"), but the page's Progress type says number.
        const percent = `${((i + 1) / STEPS.length) * 100}%`
        controller.enqueue(sseEvent('progress', { percent, step }))
        await sleep(150)
      }
      controller.enqueue(sseEvent('done', { id, token: `job-${id}-secret` }))
      controller.close()
    },
  })
  return eventStream(stream)
}
