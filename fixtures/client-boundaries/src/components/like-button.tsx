'use client'

import { useLikes } from '@/lib/use-likes'

export function LikeButton({ postId }: { postId: string }) {
  const { likes, like } = useLikes(postId)
  return (
    <button type="button" onClick={like}>
      {likes} likes
    </button>
  )
}
