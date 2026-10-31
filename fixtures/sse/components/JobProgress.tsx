'use client'

import { useState } from 'react'
import type { Progress } from '@/lib/types'

/** Opens an event stream when the button is clicked, with a listener declared as a function. */
export function JobProgress({ id }: { id: string }) {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [done, setDone] = useState(false)

  function onProgress(event: MessageEvent<string>) {
    const next = JSON.parse(event.data) as Progress
    setProgress(next)
  }

  const start = () => {
    const source = new EventSource(`/api/jobs/${id}/progress`)
    source.addEventListener('progress', onProgress)
    source.addEventListener('done', () => {
      source.close()
      setDone(true)
    })
  }

  return (
    <section>
      <button type="button" onClick={start}>
        Start job
      </button>
      <p>{done ? 'Job finished' : progress ? `${progress.step} ${progress.percent}` : 'Not started'}</p>
    </section>
  )
}
