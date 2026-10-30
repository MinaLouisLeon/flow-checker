import { type NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from './lib/session'

// Runs before the requests its matcher selects. Next.js 16 renamed middleware.ts to proxy.ts.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('session')?.value

  // Old shop links: the products page answers and the URL stays.
  if (pathname.startsWith('/shop')) return NextResponse.rewrite(new URL('/products', request.url))

  // The old home page moved for good.
  if (pathname === '/old-home') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url, 308)
  }

  // Signed-in users skip the login page (the matcher only runs here with a session cookie).
  if (pathname === '/login') return NextResponse.redirect(new URL('/dashboard', request.url))

  // The dashboard needs a valid session.
  if (!token) return NextResponse.redirect(new URL('/login', request.url))
  const user = await getSessionUser(token)
  if (!user) {
    // Drop the stale cookie, or the login page would send the user straight back here.
    const response = NextResponse.redirect(new URL('/login?expired=1', request.url))
    response.cookies.delete('session')
    return response
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/shop/:path*',
    '/old-home',
    { source: '/login', has: [{ type: 'cookie', key: 'session' }] },
  ],
}
