import { FileBadge } from '@/components/file-badge'

// Planted: the badge's code reaches `fs` (no browser version) through two files.
export default function FilesPage() {
  return <FileBadge name="report.pdf" bytes={20480} />
}
