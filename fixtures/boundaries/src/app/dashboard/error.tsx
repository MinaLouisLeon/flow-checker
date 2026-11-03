'use client'

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <button type="button" onClick={() => reset()}>
      Try again
    </button>
  )
}
