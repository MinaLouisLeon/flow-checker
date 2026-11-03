import { revalidatePath, revalidateTag } from 'next/cache'

// A webhook: refreshes the tagged product fetch and the cached header.
export async function POST() {
  revalidateTag('products', 'max')
  revalidateTag('nav', { expire: 0 })
  revalidatePath('/products')
  return Response.json({ revalidated: true })
}
