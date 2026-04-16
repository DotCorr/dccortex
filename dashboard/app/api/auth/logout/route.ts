import { NextResponse } from 'next/server'

/**
 * GET https://dccortex.com/api/auth/logout
 * Central logout for the entire .dccortex.com platform.
 * Clears the shared session cookie and redirects to /login.
 * Both dccortex.com and flow.dccortex.com point here — one cookie, one signout.
 *
 * NOTE: We use res.headers.append('Set-Cookie', ...) directly instead of
 * res.cookies.set() because ResponseCookies is a Map keyed by name — calling
 * set() twice with the same name silently overwrites the first entry, so only
 * ONE Set-Cookie header would be emitted. We need TWO per cookie name:
 *   1. domain=.dccortex.com  →  clears the shared subdomain-scoped cookie
 *   2. no domain attr        →  clears any host-only variant
 */
export async function GET() {
  const isProd = process.env.NEXTAUTH_URL?.startsWith('https://')
  const secure = isProd ? '; Secure' : ''
  const expireAttrs = `=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure}`

  const res = NextResponse.redirect(
    new URL('/login', process.env.NEXTAUTH_URL ?? 'https://dccortex.com'),
    { status: 302 }
  )

  const cookieNames = [
    '__Secure-next-auth.session-token',
    'next-auth.session-token',
    '__Secure-next-auth.csrf-token',
    'next-auth.csrf-token',
    '__Secure-next-auth.callback-url',
    'next-auth.callback-url',
  ]

  for (const name of cookieNames) {
    // Shared domain — covers dccortex.com AND all *.dccortex.com subdomains
    res.headers.append('Set-Cookie', `${name}${expireAttrs}; Domain=.dccortex.com`)
    // Host-only fallback — in case the cookie was set without a Domain attribute
    res.headers.append('Set-Cookie', `${name}${expireAttrs}`)
  }

  return res
}
