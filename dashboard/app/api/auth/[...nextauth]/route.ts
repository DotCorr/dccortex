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
  'https://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
]

function deriveBaseUrl(req: Request): string {
  const origin = req.headers.get('origin')
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin

  const xfHost = req.headers.get('x-forwarded-host')
  if (xfHost) {
    const host = xfHost.split(',')[0]?.trim() || ''
    if (host === 'dccortex.com' || host.endsWith('.dccortex.com')) return `https://${host}`
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
      const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'http'
      return `${proto}://${host}`
    }
  }

  const host = req.headers.get('host') || ''
  if (host === 'dccortex.com' || host.endsWith('.dccortex.com')) return `https://${host}`

  const reqUrl = new URL(req.url)
  if (reqUrl.hostname === 'localhost' || reqUrl.hostname === '127.0.0.1') return reqUrl.origin

  return PUBLIC_URL
}

function ensurePublicUrl(req: Request) {
  const target = deriveBaseUrl(req)
  if (process.env.NEXTAUTH_URL !== target) {
    process.env.NEXTAUTH_URL = target
  }
}

function withCors(res: Response, origin: string | null): Response {
  const allowOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]

  // DO NOT use `new Headers(res.headers)` — the Headers constructor collapses
  // multiple Set-Cookie values into one comma-joined string, which corrupts the
  // OAuth state/PKCE cookies NextAuth sets and causes:
  //   SyntaxError: The string did not match the expected pattern.
  const next = new Response(res.body, { status: res.status, statusText: res.statusText })

  // Copy every header except Set-Cookie (forEach only sees one value per name)
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') next.headers.set(key, value)
  })

  // Re-append each Set-Cookie individually so the browser receives separate headers.
  // Some runtimes don't expose getSetCookie(); in that case, fall back to raw header.
  const setCookies = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
  if (setCookies.length > 0) {
    for (const cookie of setCookies) {
      next.headers.append('set-cookie', cookie)
    }
  } else {
    const rawSetCookie = res.headers.get('set-cookie')
    if (rawSetCookie) next.headers.append('set-cookie', rawSetCookie)
  }

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
  ensurePublicUrl(req)
  const url = new URL(req.url)
  if (url.pathname.includes('signin')) {
    console.log(
      '[NextAuth] env check:',
      'GOOGLE_CLIENT_ID=', process.env.GOOGLE_CLIENT_ID ? 'set' : 'MISSING',
      'GITHUB_CLIENT_ID=', process.env.GITHUB_CLIENT_ID ? 'set' : 'MISSING',
      'OIDC_CLIENT_ID=', process.env.OIDC_CLIENT_ID ? 'set' : 'MISSING'
    )
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
  ensurePublicUrl(req)
  const url = new URL(req.url)
  console.log('[NextAuth] POST', url.pathname)
  const handler = getHandler()
  const res = await handler(req, context as any)
  return withCors(res, req.headers.get('origin'))
}

export { GET, POST }
