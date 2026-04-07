/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const PROJECT_CACHE_TTL_MS = 5 * 60 * 1000

export type PublicProjectPayload = {
  project: { id: string; name: string; faviconUrl: string | null; seoDefaults: unknown }
  screens: Array<{ id: string; name: string; slug: string; layout: unknown; script: string | null; sortOrder: number }>
  globals: Record<string, unknown>
}

type ProjectBuildTimings = {
  dbMs: number
  totalMs: number
}

type ProjectCacheEntry = {
  ts: number
  payload: PublicProjectPayload
  timings: ProjectBuildTimings
}

type PublicRuntimeCacheEntry = {
  ts: number
  data: Record<string, unknown>
  timings: { totalMs: number; dbMs: number; apiMs: number }
}

type PublicAppCache = {
  ts: number
  payload?: PublicProjectPayload
  runtime?: Record<string, PublicRuntimeCacheEntry>
}

const projectCache = new Map<string, ProjectCacheEntry>()

function readProjectMetadata(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === 'object' ? { ...(meta as Record<string, unknown>) } : {}
}

function readPublicAppCache(meta: unknown): PublicAppCache | null {
  const obj = readProjectMetadata(meta)
  const cache = obj.publicAppCache
  if (!cache || typeof cache !== 'object') return null
  return cache as PublicAppCache
}

export async function persistPublicAppCache(projectId: string, next: Partial<PublicAppCache>): Promise<void> {
  try {
    const _projectId = projectId
    const _next = next
    void _projectId
    void _next
  } catch {
    // Best-effort only.
  }
}

export function readPublicProjectPayloadFromMetadata(meta: unknown): PublicProjectPayload | null {
  const cache = readPublicAppCache(meta)
  const payload = cache?.payload
  return payload ?? null
}

export function readPublicRuntimeDataFromMetadata(meta: unknown, signature: string): { data: Record<string, unknown>; timings: { totalMs: number; dbMs: number; apiMs: number } } | null {
  const cache = readPublicAppCache(meta)
  const entry = cache?.runtime?.[signature]
  if (!entry) return null
  return {
    data: entry.data,
    timings: entry.timings,
  }
}

function sanitize(val: unknown): unknown {
  if (typeof val === 'string') {
    return val.replace(/([^\s]+?)\.toLowerCase\(\)/g, (_m, g) => {
      const expr = g.endsWith('?') ? g.slice(0, -1) : g
      return `String(${expr}||'').toLowerCase()`
    })
  }
  if (Array.isArray(val)) return val.map(sanitize)
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = sanitize(v)
    }
    return out
  }
  return val
}

async function buildPublicProjectPayload(projectId: string): Promise<{ payload: PublicProjectPayload; timings: ProjectBuildTimings }> {
  const totalStart = performance.now()
  const dbStart = performance.now()

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, status: true, faviconUrl: true, seoDefaults: true },
  })

  if (!project || project.status !== 'published') {
    throw new Error('PROJECT_NOT_PUBLISHED')
  }

  const client = prisma as any
  let screensRows: Array<{ id: string; name: string; slug: string; layout: unknown; script: string | null; sortOrder: number }>
  let globalsLayout: unknown | null = null

  if (client.appScreen?.findMany) {
    const [screens, globalsRow] = await Promise.all([
      client.appScreen.findMany({
        where: { projectId, NOT: { slug: '__globals__' } },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, slug: true, layout: true, script: true, sortOrder: true },
      }),
      client.appScreen.findUnique({
        where: { projectId_slug: { projectId, slug: '__globals__' } },
        select: { layout: true },
      }),
    ])
    screensRows = screens
    globalsLayout = globalsRow?.layout ?? null
  } else {
    // Fallback: Prisma client may not have AppScreen model yet
    const [rawScreens, rawGlobals] = await Promise.all([
      prisma.$queryRaw<
        { id: string; name: string; slug: string; layout: unknown; script: string | null; sort_order: number }[]
      >(Prisma.sql`SELECT id, name, slug, layout, script, sort_order FROM app_screens WHERE project_id = ${projectId} AND slug != '__globals__' ORDER BY sort_order ASC`),
      prisma.$queryRaw<
        { layout: unknown }[]
      >(Prisma.sql`SELECT layout FROM app_screens WHERE project_id = ${projectId} AND slug = '__globals__' LIMIT 1`),
    ])
    screensRows = rawScreens.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      layout: r.layout,
      script: r.script,
      sortOrder: r.sort_order,
    }))
    globalsLayout = rawGlobals[0]?.layout ?? null
  }

  const payload: PublicProjectPayload = {
    project: { id: project.id, name: project.name, faviconUrl: project.faviconUrl, seoDefaults: project.seoDefaults },
    screens: screensRows.map((r) => ({ ...r, layout: sanitize(r.layout) })),
    globals: sanitize(globalsLayout ?? {}) as Record<string, unknown>,
  }

  return {
    payload,
    timings: {
      dbMs: performance.now() - dbStart,
      totalMs: performance.now() - totalStart,
    },
  }
}

export async function getCachedPublicProjectPayload(projectId: string): Promise<{ payload: PublicProjectPayload; timings: ProjectBuildTimings; cacheHit: boolean }> {
  const now = Date.now()
  const cached = projectCache.get(projectId)
  if (cached && now - cached.ts <= PROJECT_CACHE_TTL_MS) {
    return { payload: cached.payload, timings: cached.timings, cacheHit: true }
  }

  const built = await buildPublicProjectPayload(projectId)
  projectCache.set(projectId, { ts: now, payload: built.payload, timings: built.timings })
  return { payload: built.payload, timings: built.timings, cacheHit: false }
}

export type ProjectWarmStats = {
  projectId: string
  durationMs: number
  cacheHit: boolean
  failed: boolean
  error?: string
}

export async function warmProjectPayloadCache(projectId: string): Promise<ProjectWarmStats> {
  const started = performance.now()
  try {
    const res = await getCachedPublicProjectPayload(projectId)
    await persistPublicAppCache(projectId, { payload: res.payload })
    return {
      projectId,
      durationMs: Math.round((performance.now() - started) * 10) / 10,
      cacheHit: res.cacheHit,
      failed: false,
    }
  } catch (err) {
    return {
      projectId,
      durationMs: Math.round((performance.now() - started) * 10) / 10,
      cacheHit: false,
      failed: true,
      error: (err as Error).message,
    }
  }
}
