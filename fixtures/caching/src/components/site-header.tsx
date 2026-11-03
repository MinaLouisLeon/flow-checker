import { cacheTag } from 'next/cache'
import Link from 'next/link'

// A cached component in the root layout: refreshing `nav` refreshes every page.
export async function SiteHeader() {
  'use cache'
  cacheTag('nav')
  return (
    <header>
      <Link href="/">Todos</Link> <Link href="/products">Products</Link> <Link href="/users">Users</Link>{' '}
      <Link href="/settings">Settings</Link>
    </header>
  )
}
