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

export async function OPTIONS(req: NextRequest) {
  const res = new Response(null, { status: 204 })
  return withCors(res, req.headers.get('origin'))
}

async function getScreen(projectId: string, screenId: string) {
  const client = prisma as any
  if (client.appScreen?.findFirst) {
    return client.appScreen.findFirst({ where: { id: screenId, projectId } })
  }
  const rows = await prisma.$queryRaw<
    { id: string; project_id: string; name: string; slug: string; layout: unknown; sort_order: number; created_at: Date; updated_at: Date }[]
  >(Prisma.sql`SELECT id, project_id, name, slug, layout, sort_order, created_at, updated_at FROM app_screens WHERE id = ${screenId} AND project_id = ${projectId} LIMIT 1`)
  const r = rows[0]
  if (!r) return null
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    slug: r.slug,
    layout: r.layout,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function GET(req: NextRequest, context: any) {
  try {
    const { id: projectId, screenId } = await Promise.resolve(context.params)
    if (!projectId || !screenId) return corsJson(req, { error: 'Project ID and screen ID required' }, 400)

    const access = await requireProjectDataAccess(projectId, false)
    if (!access.ok) return corsJson(req, { error: access.error }, access.status)

    const screen = await getScreen(projectId, screenId)
    if (!screen) return corsJson(req, { error: 'Screen not found' }, 404)

    const { layout: _layout, ...meta } = screen
    return corsJson(req, { screen: meta })
  } catch (err) {
    console.error('[screen GET]', err)
    return corsJson(req, { error: err instanceof Error ? err.message : 'Failed to load screen' }, 500)
  }
}

export async function PUT(req: NextRequest, context: any) {
  try {
    const { id: projectId, screenId } = await Promise.resolve(context.params)
    if (!projectId || !screenId) return corsJson(req, { error: 'Project ID and screen ID required' }, 400)

    const access = await requireProjectDataAccess(projectId, true)
    if (!access.ok) return corsJson(req, { error: access.error }, access.status)

    const body = await req.json().catch(() => ({}))
    const layoutJson = JSON.stringify(body)

    const client = prisma as any
    if (client.appScreen?.updateMany) {
      await client.appScreen.updateMany({
        where: { id: screenId, projectId },
        data: { layout: body, updatedAt: new Date() },
      })
    } else {
      await prisma.$executeRaw(
        Prisma.sql`UPDATE app_screens SET layout = ${layoutJson}::jsonb, updated_at = NOW() WHERE id = ${screenId} AND project_id = ${projectId}`
      )
    }

    return corsJson(req, { ok: true })
  } catch (err) {
    console.error('[screen PUT]', err)
    return corsJson(req, { error: err instanceof Error ? err.message : 'Failed to update screen' }, 500)
  }
}
