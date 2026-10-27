import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

// Locale-aware wrappers: the scanner must treat these like next/link and next/navigation.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
