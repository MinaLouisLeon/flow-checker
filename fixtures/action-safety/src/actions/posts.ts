'use server'

import { revalidatePath } from 'next/cache'
import * as v from 'valibot'
import { auth, requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { PostSchema, RenameSchema } from '@/lib/schemas'

export interface FormState {
  error?: string
}

// Auth checked inline, input checked with zod.
export async function createPost(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth()
  if (!session) return { error: 'Sign in first' }
  const parsed = PostSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Check the title and text' }
  await db.post.create({ id: crypto.randomUUID(), likes: 0, ...parsed.data })
  revalidatePath('/')
  return {}
}

// Planted: changes data with no auth check and no input check. Anyone can delete any post.
export async function deletePost(id: string): Promise<void> {
  await db.post.delete(id)
  revalidatePath('/')
}

// Auth checked by a helper that redirects, input checked with valibot.
export async function renamePost(id: string, title: string): Promise<void> {
  await requireUser()
  const input = v.parse(RenameSchema, { id, title })
  await db.post.update(input.id, { title: input.title })
  revalidatePath(`/posts/${input.id}`)
}

// No auth check, but the FormData is checked by hand: not flagged.
export async function likePost(formData: FormData): Promise<void> {
  const id = formData.get('id')
  if (typeof id !== 'string' || id.length > 40) return
  const post = await db.post.findUnique(id)
  if (post) await db.post.update(id, { likes: post.likes + 1 })
}

// Only reads: not flagged.
export async function searchPosts(query: string) {
  return db.post.findMany((p) => p.title.toLowerCase().includes(query.toLowerCase()))
}

// Changes data with neither, but no code calls it, so Next leaves it out of the build.
export async function purgePosts(): Promise<void> {
  for (const post of await db.post.findMany()) await db.post.delete(post.id)
}
