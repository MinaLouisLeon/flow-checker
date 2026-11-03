import { cookies } from 'next/headers'
import { forbidden, unauthorized } from 'next/navigation'

export default async function AccountPage() {
  const store = await cookies()
  const session = store.get('session')?.value
  if (!session) unauthorized()
  if (store.get('role')?.value !== 'admin') forbidden()
  return <h1>Account</h1>
}
