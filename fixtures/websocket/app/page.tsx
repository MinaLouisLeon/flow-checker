import Link from 'next/link'
import { Ping } from '@/components/Ping'
import { Ticker } from '@/components/Ticker'

export default function HomePage() {
  return (
    <main>
      <h1>Ticker</h1>
      <Ticker />
      <Ping />
      <Link href="/chat">Chat</Link>
    </main>
  )
}
