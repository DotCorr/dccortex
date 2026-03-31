/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * GET /api/projects/[id]/screens/[screenId]/edit-payload
 * Returns { project, screen } in one response. Use this from the edit page to avoid CORS issues from multiple requests.
 */
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'
import { corsJson, withCors } from '@/lib/cors'

type ScreenRow = {
  id: string
  project_id: string
  name: string
  slug: string
  layout: unknown
  script: string | null
  sort_order: number
  created_at: Date
  updated_at: Date
}

async function getScreenById(projectId: string, screenId: string): Promise<ScreenRow | null> {
  const client = prisma as any
  if (client.appScreen?.findFirst) {
    const s = await client.appScreen.findFirst({ where: { id: screenId, projectId } })
    if (!s) return null
    return {
      id: s.id,
      project_id: s.projectId,
      name: s.name,
      slug: s.slug,
      layout: s.layout,
      script: s.script ?? null,
      sort_order: s.sortOrder,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    }
  }
  const rows = await prisma.$queryRaw<ScreenRow[]>(
    Prisma.sql`SELECT id, project_id, name, slug, layout, script, sort_order, created_at, updated_at FROM app_screens WHERE id = ${screenId} AND project_id = ${projectId} LIMIT 1`
  )
  return rows[0] ?? null
}

export async function OPTIONS(req: NextRequest) {
  return withCors(new Response(null, { status: 204 }), req.headers.get('origin'), req.headers.get('referer'))
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

    // sanitize any layout content before sending to client
    const sanitize = (val: unknown): unknown => {
      if (typeof val === 'string') {
        return val.replace(/([^\s]+?)\.toLowerCase\(\)/g,(m,g)=>{
          const expr = g.endsWith('?') ? g.slice(0,-1) : g
          return `String(${expr}||'').toLowerCase()`
        });
      }
      if (Array.isArray(val)) return val.map(sanitize);
      if (val && typeof val === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k,v] of Object.entries(val as Record<string, unknown>)) {
          out[k] = sanitize(v);
        }
        return out;
      }
      return val;
    }

    const screen = {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      slug: row.slug,
      layout: sanitize(row.layout),
      script: row.script ?? '',
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }

    const p = access.project as Record<string, unknown>
    const org = p.organization as { id: string; name: string } | null
    const project = {
      id: String(p.id),
      name: String(p.name ?? ''),
      slug: String(p.slug ?? ''),
      status: String(p.status ?? 'draft'),
      customDomain: p.customDomain != null ? String(p.customDomain) : null,
      description: p.description != null ? String(p.description) : null,
      metadata: p.metadata != null ? p.metadata : null,
      organizationId: p.organizationId != null ? String(p.organizationId) : null,
      organization: org
        ? { id: String(org.id), name: String(org.name ?? '') }
        : null,
    }

    const body = { project, screen }
    return corsJson(req, body)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[edit-payload] GET error:', err)
    return corsJson(req, { error: msg }, 500)
  }
}
