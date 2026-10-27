import { DeleteUserButton } from '@/components/DeleteUserButton'
import { ProfileCard } from '@/components/ProfileCard'
import { getUser } from '@/lib/api'

export const dynamic = 'force-dynamic'

// Dynamic route: server fetch with a path param, plus client children that make requests.
export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser(id)
  return (
    <main>
      <ProfileCard user={user} />
      <DeleteUserButton userId={user.id} />
    </main>
  )
}
