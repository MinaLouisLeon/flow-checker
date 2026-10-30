import { Suspense } from 'react'
import { UserList } from '@/components/UserList'

export default function UsersPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <UserList />
    </Suspense>
  )
}
