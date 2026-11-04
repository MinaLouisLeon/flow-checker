import { ArchiveButton } from './archive-button'

// A server component that hands the action it was given on to a client component: still a server action.
export function OrderActions({ id, onArchive }: { id: number; onArchive: (id: number) => Promise<void> }) {
  return <ArchiveButton id={id} action={onArchive} />
}
