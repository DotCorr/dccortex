/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'
import { corsJson, withCors } from '@/lib/cors'
import { migrateLayout } from '@/lib/layout-migration'
import { interpolateScreenToNextJs } from '@/lib/runtime/nextjs-interpolate'
import type { Node } from '@/components/builder/registry'

type ScreenRow = {
  id: string
  project_id: string
  name: string
  slug: string
  layout: unknown
  script: string | null
  updated_at: Date
}

type CachedInterpolation = {
  cachedAt: number
  payload: {
    source: string
    nodeCount: number
    warnings: string[]
  }
}

const CACHE_MAX_ENTRIES = 200
const interpolationCache = new Map<string, CachedInterpolation>()

async function getScreenById(projectId: string, screenId: string): Promise<ScreenRow | null> {
  const client = prisma as any
  if (client.appScreen?.findFirst) {
    const s = await client.appScreen.findFirst({
      where: { id: screenId, projectId },
      select: { id: true, projectId: true, name: true, slug: true, layout: true, script: true, updatedAt: true },
    })
    if (!s) return null
    return {
      id: s.id,
      project_id: s.projectId,
      name: s.name,
      slug: s.slug,
      layout: s.layout,
      script: s.script ?? null,
      updated_at: s.updatedAt,
    }
  }

  const rows = await prisma.$queryRaw<ScreenRow[]>(
    Prisma.sql`SELECT id, project_id, name, slug, layout, script, updated_at FROM app_screens WHERE id = ${screenId} AND project_id = ${projectId} LIMIT 1`
  )
  return rows[0] ?? null
}

function cacheKey(projectId: string, screenId: string, updatedAt: Date): string {
  return `${projectId}:${screenId}:${updatedAt.toISOString()}`
}

function trimCacheForScreen(projectId: string, screenId: string): void {
  const prefix = `${projectId}:${screenId}:`
  for (const key of Array.from(interpolationCache.keys())) {
    if (key.startsWith(prefix)) interpolationCache.delete(key)
  }
}

function trimCacheIfNeeded(): void {
  if (interpolationCache.size <= CACHE_MAX_ENTRIES) return
  const overflow = interpolationCache.size - CACHE_MAX_ENTRIES
  const keys = Array.from(interpolationCache.keys())
  for (let i = 0; i < overflow; i += 1) {
    interpolationCache.delete(keys[i])
  }
}

function extractRootNode(layout: unknown): Node | null {
  try {
    const migrated = migrateLayout(layout)
    if (migrated?.root && typeof migrated.root === 'object') {
      return migrated.root as unknown as Node
    }
  } catch {
    // fall through
  }

  if (layout && typeof layout === 'object') {
    const raw = layout as Record<string, unknown>
    if (raw.root && typeof raw.root === 'object') return raw.root as Node
    if (typeof raw.id === 'string' && typeof raw.type === 'string') return raw as unknown as Node
  }

  return null
}

export async function OPTIONS(req: NextRequest) {
  return withCors(new Response(null, { status: 204 }), req.headers.get('origin'))
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; screenId: string }> | { id: string; screenId: string } }
) {
  try {
    const { id: projectId, screenId } = await Promise.resolve(params)
    const access = await requireProjectDataAccess(projectId, false)
    if (!access.ok) return corsJson(req, { error: access.error }, access.status)

    const row = await getScreenById(projectId, screenId)
    if (!row) return corsJson(req, { error: 'Screen not found' }, 404)

    const root = extractRootNode(row.layout)
    if (!root) {
      return corsJson(req, { error: 'Screen layout is missing a root node' }, 422)
    }

    const key = cacheKey(projectId, screenId, row.updated_at)
    const cached = interpolationCache.get(key)

    if (cached) {
      return corsJson(req, {
        screen: {
          id: row.id,
          projectId: row.project_id,
          name: row.name,
          slug: row.slug,
          updatedAt: row.updated_at.toISOString(),
        },
        source: cached.payload.source,
        nodeCount: cached.payload.nodeCount,
        warnings: cached.payload.warnings,
        cached: true,
      })
    }

    const result = interpolateScreenToNextJs(root, row.name || row.slug || 'Screen')
    trimCacheForScreen(projectId, screenId)
    interpolationCache.set(key, {
      cachedAt: Date.now(),
      payload: {
        source: result.code,
        nodeCount: result.nodeCount,
        warnings: result.warnings,
      },
    })
    trimCacheIfNeeded()

    return corsJson(req, {
      screen: {
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        slug: row.slug,
        updatedAt: row.updated_at.toISOString(),
      },
      source: result.code,
      nodeCount: result.nodeCount,
      warnings: result.warnings,
      cached: false,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[nextjs-source] GET error:', err)
    return corsJson(req, { error: msg }, 500)
  }
}
