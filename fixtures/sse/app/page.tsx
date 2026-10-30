import Link from 'next/link'
import { Clock } from '@/components/Clock'

export default function HomePage() {
  return (
    <main>
      <h1>Clock</h1>
      <Clock />
      <Link href="/jobs/7">Job 7</Link> <Link href="/chat">Chat</Link>
    </main>
  )
}
