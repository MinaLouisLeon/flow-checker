'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/cart', label: 'Cart' },
  { href: '/settings', label: 'Settings' },
  { href: '/about', label: 'About' },
]

export function Nav() {
  const pathname = usePathname()
  return (
    <nav>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
