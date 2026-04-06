/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCachedRuntimeData, parseVarsQuery } from '@/lib/public-runtime-cache'

/**
 * Public (unauthenticated) runtime-data endpoint.
 * Returns all project data sources as a flat map: { [sourceName]: data }
 *   - ExternalApiSource records → server-side proxied HTTP fetch
 *   - InternalDatasource tables → all rows from Prisma
 * Used by PreviewApp to populate {{data.*}} bindings at runtime.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> | { projectId: string } }
) {
  try {
    const { projectId } = await Promise.resolve(params)

    const varsMap = parseVarsQuery(_req.nextUrl.searchParams.get('vars'))
    const { data, timings, cacheHit } = await getCachedRuntimeData(projectId, varsMap)

    return NextResponse.json({ data }, {
      headers: {
        'Cache-Control': 'no-store, no-cache',
        'Server-Timing': `db;dur=${timings.dbMs.toFixed(1)}, api;dur=${timings.apiMs.toFixed(1)}, total;dur=${timings.totalMs.toFixed(1)}, cache;desc="${cacheHit ? 'hit' : 'miss'}"`,
      },
    })
  } catch (err: unknown) {
    if ((err as Error)?.message === 'PROJECT_NOT_PUBLISHED') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    console.error('[Public data] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
