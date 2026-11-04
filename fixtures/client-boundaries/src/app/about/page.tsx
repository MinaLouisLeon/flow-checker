import { Heading } from '@/components/heading'

export const metadata = { title: 'About' }

// Only the layout's `Nav` runs on the client here.
export default function AboutPage() {
  return (
    <main>
      <Heading text="About" />
      <p>A page with no client components of its own.</p>
    </main>
  )
}
