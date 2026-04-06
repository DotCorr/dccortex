/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCachedPublicProjectPayload } from '@/lib/public-project-cache'

/**
 * Public (unauthenticated) endpoint for published projects.
 * Returns all screens + globals so the public preview page can render the app.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> | { projectId: string } }
) {
  try {
    const { projectId } = await Promise.resolve(params)

    const { payload, timings, cacheHit } = await getCachedPublicProjectPayload(projectId)

    return NextResponse.json(payload, {
      headers: {
        'Server-Timing': `db;dur=${timings.dbMs.toFixed(1)}, total;dur=${timings.totalMs.toFixed(1)}, cache;desc="${cacheHit ? 'hit' : 'miss'}"`,
      },
    })
  } catch (err: any) {
    if (err?.message === 'PROJECT_NOT_PUBLISHED') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    console.error('[Public API] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
