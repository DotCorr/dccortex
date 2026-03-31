/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * NextAuth configuration
 * Wraps handler to add CORS so OAuth and session work when frontend is served via dccortex.com
 */

import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const PUBLIC_URL = 'https://dccortex.com'

function getHandler() {
  return NextAuth(authOptions)
}

const ALLOWED_ORIGINS = [
  'https://dccortex.com',
  'https://www.dccortex.com',
  'https://active.dccortex.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
]

function ensurePublicUrl() {
  if (process.env.NEXTAUTH_URL !== PUBLIC_URL) {
    process.env.NEXTAUTH_URL = PUBLIC_URL
  }
}

function withCors(res: Response, origin: string | null): Response {
  const allowOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  const next = new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: new Headers(res.headers),
  })
  next.headers.set('Access-Control-Allow-Origin', allowOrigin)
  next.headers.set('Access-Control-Allow-Credentials', 'true')
  next.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  next.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, X-CSRF-Token'
  )
  // Prevent Cloudflare/proxies from caching auth responses (cached 302 = callback never hits server)
  next.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate')
  next.headers.set('Pragma', 'no-cache')
  return next
}

type RouteContext = { params: Promise<{ nextauth: string[] }> | { nextauth: string[] } }

async function GET(req: Request, context: RouteContext) {
  ensurePublicUrl()
  const url = new URL(req.url)
  if (url.pathname.includes('signin')) {
    console.log('[NextAuth] env check: GOOGLE_CLIENT_ID=', process.env.GOOGLE_CLIENT_ID ? 'set' : 'MISSING', 'GITHUB_CLIENT_ID=', process.env.GITHUB_CLIENT_ID ? 'set' : 'MISSING')
  }
  console.log('[NextAuth] GET', url.pathname, url.pathname.includes('callback') ? 'has code=' + !!url.searchParams.get('code') : '')
  const handler = getHandler()
  const res = await handler(req, context as any)
  if (url.pathname.includes('signin') && res.status === 302) {
    const loc = res.headers.get('Location') || ''
    console.log('[NextAuth] 302 Location (first 120 chars):', loc.slice(0, 120))
  }
  return withCors(res, req.headers.get('origin'))
}

async function POST(req: Request, context: RouteContext) {
  ensurePublicUrl()
  const url = new URL(req.url)
  console.log('[NextAuth] POST', url.pathname)
  const handler = getHandler()
  const res = await handler(req, context as any)
  return withCors(res, req.headers.get('origin'))
}

export { GET, POST }
