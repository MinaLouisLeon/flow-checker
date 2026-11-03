import { getViewer } from '@/lib/viewer'

export async function AccountBar() {
  const viewer = await getViewer()
  return <p>Signed in as {viewer.name}</p>
}
