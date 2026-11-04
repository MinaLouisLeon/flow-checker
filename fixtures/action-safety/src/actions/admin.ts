'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { action, withAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

// Wrapped in a helper that checks the role; the input is checked with zod.
export const banUser = withAdmin(async (userId: string) => {
  const id = z.string().min(1).parse(userId)
  await db.user.update(id, { banned: true })
  revalidatePath('/admin')
})

// Planted: wrapped in a helper that checks nothing, then changes data with neither.
export const resetLikes = action(async () => {
  for (const post of await db.post.findMany()) await db.post.update(post.id, { likes: 0 })
  revalidatePath('/')
})
