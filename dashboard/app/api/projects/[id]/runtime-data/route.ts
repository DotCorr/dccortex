/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireProjectDataAccess } from '@/lib/project-access'
import { getCachedRuntimeData, parseVarsQuery } from '@/lib/public-runtime-cache'

/**
 * Authenticated runtime-data endpoint for the editor preview panel.
 * Uses the same buildRuntimeData as the public endpoint — single source of truth.
 * Only difference: auth guard + skipPublishedCheck so draft projects work.
 */
export async function GET(
  req: NextRequest,
  context: any
) {
  try {
    const { id: projectId } = context.params
    const access = await requireProjectDataAccess(projectId, false)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const varsMap = parseVarsQuery(req.nextUrl.searchParams.get('vars'))
    const { data, timings, cacheHit } = await getCachedRuntimeData(projectId, varsMap, { skipPublishedCheck: true })

    return NextResponse.json({ data }, {
      headers: {
        'Cache-Control': 'no-store, no-cache',
        'Server-Timing': `db;dur=${timings.dbMs.toFixed(1)}, api;dur=${timings.apiMs.toFixed(1)}, total;dur=${timings.totalMs.toFixed(1)}, cache;desc="${cacheHit ? 'hit' : 'miss'}"`,
      },
    })
  } catch (err: unknown) {
    console.error('[Runtime data] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
