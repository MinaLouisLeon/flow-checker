'use client'

import { useEffect, useRef } from 'react'

export default function Chart({ points }: { points: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = ref.current?.getContext('2d')
    if (!context) return
    points.forEach((p, i) => {
      context.fillRect(i * 10, 30 - p * 10, 8, p * 10)
    })
  }, [points])
  return <canvas ref={ref} width={100} height={30} />
}
