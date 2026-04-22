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

export async function GET(
  _req: NextRequest,
  context: any
) {
  try {
    const { id: projectId } = context.params
    const access = await requireProjectDataAccess(projectId, false)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const sources = await prisma.externalApiSource.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ sources })
  } catch (err: any) {
    console.error('[api-sources GET]', err)
    return NextResponse.json({ error: err.message ?? 'Failed to fetch sources' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  context: any
) {
  try {
    const { id: projectId } = context.params
    const access = await requireProjectDataAccess(projectId, true)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const body = await req.json().catch(() => ({}))
    const { name, url, method, headers, authType, authValue, authHeader, schema: schemaVal, body: reqBody, cacheMode } = body as {
      name?: string
      url?: string
      method?: string
      headers?: Record<string, string>
      authType?: string
      authValue?: string
      authHeader?: string
      schema?: unknown
      body?: string
      cacheMode?: string
    }

    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    // Coerce schema to a JSON-safe value (Prisma Json? requires null or a plain object/array)
    const schemaJson = schemaVal !== undefined ? schemaVal : null

    const resolvedCacheMode = cacheMode === 'realtime' ? 'realtime' : 'cached'

    const source = await prisma.externalApiSource.create({
      data: {
        projectId,
        name: name.trim(),
        url: url ?? '',
        method: method ?? 'GET',
        headers: headers !== undefined ? (headers as any) : null,
        body: reqBody ?? null,
        authType: authType ?? 'none',
        authValue: authValue ?? null,
        authHeader: authHeader ?? null,
        schema: schemaJson as any,
        cacheMode: resolvedCacheMode,
      },
    })

    // Fetch the external API and cache the response in DB (non-blocking, cached mode only)
    if (resolvedCacheMode === 'cached' && source.url) {
      fetchAndCacheApiSource(source.id).catch((err) =>
        console.warn('[api-sources POST] background fetch failed:', err)
      )
    }

    return NextResponse.json({ source })
  } catch (err: any) {
    console.error('[api-sources POST]', err)
    return NextResponse.json({ error: err.message ?? 'Failed to create source' }, { status: 500 })
  }
}
