import { RefreshButton } from '@/components/refresh-button'

// Planted: the button imports `revalidatePath`, which only works in server code.
export default function AdminPage() {
  return <RefreshButton />
}
