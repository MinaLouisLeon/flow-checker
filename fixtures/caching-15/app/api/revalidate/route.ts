import { revalidatePath, revalidateTag } from 'next/cache'

// A webhook: refreshes the cached viewer.
export async function POST() {
  revalidateTag('viewer')
  // A typo on purpose: the page is `/profile`.
  revalidatePath('/profil')
  return Response.json({ revalidated: true })
}
