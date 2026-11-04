import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { db } from '@/lib/db'

const API_URL = process.env.API_URL ?? 'http://localhost:3000'

export default async function HomePage() {
  const posts = await db.post.findMany()

  // Inline action, no auth check, but the text is checked by hand: not flagged.
  async function addPost(formData: FormData) {
    'use server'
    const title = formData.get('title')
    if (typeof title !== 'string' || title.trim() === '') return
    await db.post.create({ id: crypto.randomUUID(), title, body: '', likes: 0 })
    revalidatePath('/')
  }

  // Planted: inline action that sends a DELETE with no auth check and no input.
  async function clearDrafts() {
    'use server'
    await fetch(`${API_URL}/api/drafts`, { method: 'DELETE' })
  }

  return (
    <main>
      <h1>Posts</h1>
      <ul>
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={`/posts/${p.id}`}>{p.title}</Link>
          </li>
        ))}
      </ul>
      <form action={addPost}>
        <input name="title" />
        <button type="submit">Add</button>
      </form>
      <form action={clearDrafts}>
        <button type="submit">Clear drafts</button>
      </form>
    </main>
  )
}
