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
import { publishProjectSync } from '@/lib/projects/live-sync'

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

function toScreen(r: ScreenRow) {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    slug: r.slug,
    layout: r.layout,
    script: r.script ?? '',
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
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
    return corsJson(req, { screen: toScreen(row) })
  } catch (err: any) {
    console.error('[screens] GET error:', err)
    return corsJson(req, { error: err?.message || 'Internal server error' }, 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; screenId: string }> | { id: string; screenId: string } }
) {
  try {
    const { id: projectId, screenId } = await Promise.resolve(params)
    const access = await requireProjectDataAccess(projectId, true)
    if (!access.ok) return corsJson(req, { error: access.error }, access.status)
    const clientId = req.headers.get('x-dcc-client-id')?.trim() || undefined

    const row = await getScreenById(projectId, screenId)
    if (!row) return corsJson(req, { error: 'Screen not found' }, 404)

    const body = await req.json().catch(() => ({}))
    const client = prisma as any

    // Save a version snapshot before applying the update (fire-and-forget)
    if (body.layout !== undefined && client.screenVersion?.create) {
      client.screenVersion.create({ data: { screenId, layout: row.layout, script: row.script } })
        .then(() => {
          // Prune to 50 most recent versions
          return client.screenVersion.findMany({ where: { screenId }, orderBy: { createdAt: 'desc' }, skip: 50, select: { id: true } })
        })
        .then((old: { id: string }[]) => {
          if (old.length > 0) {
            return client.screenVersion.deleteMany({ where: { id: { in: old.map((v: { id: string }) => v.id) } } })
          }
        })
        .catch(() => {})
    }

    if (client.appScreen?.update) {
      const updates: Record<string, unknown> = {}
      if (typeof body.name === 'string') updates.name = body.name.trim()
      if (typeof body.slug === 'string') updates.slug = body.slug.trim()
      if (body.layout !== undefined) updates.layout = body.layout
      if (body.script !== undefined) updates.script = body.script == null ? null : String(body.script)
      if (typeof body.sortOrder === 'number') updates.sortOrder = body.sortOrder
      const updated = await client.appScreen.update({ where: { id: screenId }, data: updates })
      if (body.layout !== undefined) {
        publishProjectSync({
          type: 'layout',
          projectId,
          screenId,
          clientId,
          payload: body.layout,
        })
      }
      if (body.script !== undefined) {
        publishProjectSync({
          type: 'script',
          projectId,
          screenId,
          clientId,
          payload: body.script,
        })
      }
      return corsJson(req, { screen: updated })
    }

    const name = typeof body.name === 'string' ? body.name.trim() : row.name
    const slug = typeof body.slug === 'string' ? body.slug.trim() : row.slug
    const layout = body.layout !== undefined ? body.layout : row.layout
    const script = body.script !== undefined ? (body.script == null ? null : String(body.script)) : row.script
    const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : row.sort_order
    const layoutJson = JSON.stringify(layout)
    await prisma.$executeRaw(
      Prisma.sql`UPDATE app_screens SET name = ${name}, slug = ${slug}, layout = ${layoutJson}::jsonb, script = ${script}, sort_order = ${sortOrder}, updated_at = NOW() WHERE id = ${screenId} AND project_id = ${projectId}`
    )
    if (body.layout !== undefined) {
      publishProjectSync({
        type: 'layout',
        projectId,
        screenId,
        clientId,
        payload: body.layout,
      })
    }
    if (body.script !== undefined) {
      publishProjectSync({
        type: 'script',
        projectId,
        screenId,
        clientId,
        payload: body.script,
      })
    }
    const updatedRow = await getScreenById(projectId, screenId)
    return corsJson(req, { screen: updatedRow ? toScreen(updatedRow) : toScreen(row) })
  } catch (err: any) {
    console.error('[screens] PATCH error:', err)
    return corsJson(req, { error: err?.message || 'Internal server error' }, 500)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; screenId: string }> | { id: string; screenId: string } }
) {
  const { id: projectId, screenId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return corsJson(req, { error: access.error }, access.status)

  const row = await getScreenById(projectId, screenId)
  if (!row) return corsJson(req, { error: 'Screen not found' }, 404)

  const client = prisma as any
  if (client.appScreen?.delete) {
    await client.appScreen.delete({ where: { id: screenId } })
  } else {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM app_screens WHERE id = ${screenId} AND project_id = ${projectId}`)
  }
  return corsJson(req, { ok: true })
}
