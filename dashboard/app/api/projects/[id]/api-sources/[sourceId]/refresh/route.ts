/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireProjectDataAccess } from '@/lib/project-access'
import { fetchAndCacheApiSource } from '@/lib/fetch-api-source'

/** POST /api/projects/[id]/api-sources/[sourceId]/refresh — re-fetch and store cached response */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> | { id: string; sourceId: string } }
) {
  const { id: projectId, sourceId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const result = await fetchAndCacheApiSource(sourceId)
  if (result.error) {
    return NextResponse.json({ error: result.error, data: null }, { status: 502 })
  }
  return NextResponse.json({ ok: true, data: result.data })
}
