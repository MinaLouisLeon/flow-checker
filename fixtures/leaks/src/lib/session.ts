import { cookies } from 'next/headers'

export async function currentUser(): Promise<string> {
  return (await cookies()).get('user')?.value ?? ''
}
