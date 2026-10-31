import { DeleteUserButton } from '@/components/DeleteUserButton'
import { getUser } from '@/lib/api'

export const dynamic = 'force-dynamic'

// GET /users/:id: the code has no response type, the collection's saved example gives one.
export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser(id)
  return (
    <main>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <DeleteUserButton id={user.id} />
    </main>
  )
}
