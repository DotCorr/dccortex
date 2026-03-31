/**
 * 1) CORS for /api/* when accessed from tunnel (dccortex.com) so session/auth fetches succeed.
 * 2) NextAuth protection for dashboard/apps/organizations.
 */

import { withAuth, type NextRequestWithAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'

const ALLOWED_ORIGINS = [
  'https://dccortex.com',
  'https://www.dccortex.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
]

function originFromReferer(referer: string | null): string | null {
  if (!referer || !referer.startsWith('http')) return null
  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

function corsHeaders(origin: string | null, referer: string | null) {
  let allowOrigin: string
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.dccortex.com'))) {
    allowOrigin = origin
  } else if (referer) {
    const refOrigin = originFromReferer(referer)
    allowOrigin = refOrigin && (ALLOWED_ORIGINS.includes(refOrigin) || refOrigin.endsWith('.dccortex.com')) ? refOrigin : 'https://dccortex.com'
  } else {
    allowOrigin = 'https://dccortex.com'
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With, Accept, X-CSRF-Token',
  }
}

const authMiddleware = withAuth(
  function middleware() {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname.startsWith('/api/auth/callback')) return true
        return !!token
      },
    },
    pages: { signIn: '/login' },
  }
)

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  if (req.nextUrl.pathname.startsWith('/api')) {
    const origin = req.headers.get('origin')
    const referer = req.headers.get('referer')
    const headers = corsHeaders(origin, referer)
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers })
    }
    const res = NextResponse.next()
    Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v))
    return res
  }
  return authMiddleware(req as NextRequestWithAuth, event)
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
    '/apps/:path*',
    '/organizations/:path*',
  ],
}
