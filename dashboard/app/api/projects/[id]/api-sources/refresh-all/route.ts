/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'
import { fetchAndCacheApiSource } from '@/lib/fetch-api-source'

/** POST /api/projects/[id]/api-sources/refresh-all — re-fetch all external API sources for a project */
export async function POST(
  _req: NextRequest,
  context: any
) {
  const { id: projectId } = context.params
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const sources = await prisma.externalApiSource.findMany({
    where: { projectId },
    select: { id: true, name: true },
  })

  const results = await Promise.allSettled(
    sources.map(async (src) => {
      const res = await fetchAndCacheApiSource(src.id)
      return { id: src.id, name: src.name, ok: !res.error, error: res.error }
    })
  )

  const summary = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { id: '', name: '', ok: false, error: String(r.reason) }
  )

  return NextResponse.json({ results: summary })
}
