import dynamic from 'next/dynamic'
import { LikeButton, Price } from '@/components'
import { Counter } from '@/components/counter'
import { Shell } from '@/components/shell'
import { Toolbar } from '@/components/toolbar'

// Loaded on demand: its code is a separate chunk.
const Chart = dynamic(() => import('@/components/chart'))

export default function HomePage() {
  return (
    <main>
      <h1>Home</h1>
      {/* Direct: the page imports a `'use client'` file. */}
      <Counter start={1} />
      {/* Through a barrel: `@/components` re-exports `./like-button`. */}
      <LikeButton postId="hello" />
      {/* Shared: no directive, rendered here on the server and inside `Cart` on the client. */}
      <Price amount={12} />
      {/* Planted: nothing in `Shell` needs the client, only `Menu` below it does. */}
      <Shell title="Welcome">
        <p>Rendered on the server and passed in.</p>
      </Shell>
      {/* Needs the client: it hands a function to `Tabs`. */}
      <Toolbar />
      <Chart points={[1, 3, 2]} />
    </main>
  )
}
