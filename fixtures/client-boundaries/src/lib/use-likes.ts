import { useEffect, useState } from 'react'

const KEY = 'likes:'

/** Likes kept in the browser's storage. */
export function useLikes(postId: string) {
  const [likes, setLikes] = useState(0)
  useEffect(() => {
    setLikes(Number(window.localStorage.getItem(KEY + postId) ?? 0))
  }, [postId])
  const like = () => {
    window.localStorage.setItem(KEY + postId, String(likes + 1))
    setLikes(likes + 1)
  }
  return { likes, like }
}
