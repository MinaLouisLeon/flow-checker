'use client'

import { trpc } from '@/utils/trpc'

export function TodoFeed() {
  const feed = trpc.todo.feed.useInfiniteQuery({ limit: 1 }, { getNextPageParam: (page) => page.nextCursor })
  const items = feed.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <section>
      <ul>
        {items.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
      <button type="button" disabled={!feed.hasNextPage} onClick={() => feed.fetchNextPage()}>
        More
      </button>
    </section>
  )
}
