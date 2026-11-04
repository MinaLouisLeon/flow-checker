'use client'

export function ArchiveButton({ id, action }: { id: number; action: (id: number) => Promise<void> }) {
  return (
    <button type="button" onClick={() => action(id)}>
      Archive #{id}
    </button>
  )
}
