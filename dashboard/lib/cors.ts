/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'

export const CORS_ORIGINS = [
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
    const u = new URL(referer)
    return u.origin
  } catch {
    return null
  }
}

function isAllowedOrigin(origin: string): boolean {
  if (CORS_ORIGINS.includes(origin)) return true
  if (origin === 'https://dccortex.com' || origin === 'https://www.dccortex.com') return true
  if (origin.endsWith('.dccortex.com')) return true
  return false
}

export function withCors(res: NextResponse | Response, origin: string | null, referer?: string | null): NextResponse | Response {
  let o: string
  if (origin && isAllowedOrigin(origin)) {
    o = origin
  } else if (referer) {
    const refOrigin = originFromReferer(referer)
    o = refOrigin && isAllowedOrigin(refOrigin) ? refOrigin : CORS_ORIGINS[0]
  } else {
    o = CORS_ORIGINS[0]
  }
  res.headers.set('Access-Control-Allow-Origin', o)
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, X-CSRF-Token'
  )
  return res
}

export function corsJson(
  req: NextRequest,
  data: object,
  status = 200
): NextResponse {
  const res = NextResponse.json(data, { status })
  return withCors(res, req.headers.get('origin'), req.headers.get('referer')) as NextResponse
}
