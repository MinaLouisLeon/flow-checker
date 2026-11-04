import { notFound } from 'next/navigation'
import { PostActions } from '@/components/post-actions'
import { db } from '@/lib/db'

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await db.post.findUnique(id)
  if (!post) notFound()
  return (
    <main>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
      <PostActions id={post.id} />
    </main>
  )
}
