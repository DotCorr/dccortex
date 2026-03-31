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

async function getScreens(projectId: string) {
  const client = prisma as any
  if (client.appScreen?.findMany) {
    return client.appScreen.findMany({
      where: { projectId, NOT: { slug: '__globals__' } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  }
  const rows = await prisma.$queryRaw<
    { id: string; project_id: string; name: string; slug: string; layout: unknown; sort_order: number; created_at: Date; updated_at: Date }[]
  >(Prisma.sql`SELECT id, project_id, name, slug, layout, sort_order, created_at, updated_at FROM app_screens WHERE project_id = ${projectId} AND slug != '__globals__' ORDER BY sort_order ASC, created_at ASC`)
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    slug: r.slug,
    layout: r.layout,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: projectId } = await Promise.resolve(params)
    if (!projectId) return corsJson(req, { error: 'Project ID required' }, 400)

    const access = await requireProjectDataAccess(projectId, false)
    if (!access.ok) return corsJson(req, { error: access.error }, access.status)

    const screens = await getScreens(projectId)
    return corsJson(req, { screens })
  } catch (err) {
    console.error('[screens GET]', err)
    const message = err instanceof Error ? err.message : 'Failed to load screens'
    return corsJson(req, { error: message }, 500)
  }
}

async function createScreen(projectId: string, name: string, slug: string, layout: object) {
  const client = prisma as any
  if (client.appScreen?.create) {
    const maxOrder = await client.appScreen.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    })
    return client.appScreen.create({
      data: {
        projectId,
        name,
        slug,
        layout,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    })
  }
  const existing = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM app_screens WHERE project_id = ${projectId} AND slug = ${slug} LIMIT 1`
  )
  if (existing.length) return null
  const maxResult = await prisma.$queryRaw<{ max: number | null }[]>(
    Prisma.sql`SELECT COALESCE(MAX(sort_order), -1)::int AS max FROM app_screens WHERE project_id = ${projectId}`
  )
  const sortOrder = (maxResult[0]?.max ?? -1) + 1
  const id = crypto.randomUUID()
  const layoutJson = JSON.stringify(layout)
  await prisma.$executeRaw(
    Prisma.sql`INSERT INTO app_screens (id, project_id, name, slug, layout, sort_order, created_at, updated_at) VALUES (${id}, ${projectId}, ${name}, ${slug}, ${layoutJson}::jsonb, ${sortOrder}, NOW(), NOW())`
  )
  const rows = await prisma.$queryRaw<
    { id: string; project_id: string; name: string; slug: string; layout: unknown; sort_order: number; created_at: Date; updated_at: Date }[]
  >(Prisma.sql`SELECT id, project_id, name, slug, layout, sort_order, created_at, updated_at FROM app_screens WHERE id = ${id}`)
  const r = rows[0]
  if (!r) throw new Error('Insert failed')
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: projectId } = await Promise.resolve(params)
    if (!projectId) return corsJson(req, { error: 'Project ID required' }, 400)

    const access = await requireProjectDataAccess(projectId, true)
    if (!access.ok) return corsJson(req, { error: access.error }, access.status)

    const body = await req.json().catch(() => ({}))
    const name = (body.name as string)?.trim() || 'Screen'
    const slug = (body.slug as string)?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'screen'
    const layout = body.layout ?? { id: 'root', type: 'container', props: {}, children: [] }

    const screen = await createScreen(projectId, name, slug, layout as object)
    if (!screen) return corsJson(req, { error: 'Screen with this slug already exists' }, 409)
    return corsJson(req, { screen }, 201)
  } catch (err) {
    console.error('[screens POST]', err)
    const message = err instanceof Error ? err.message : 'Failed to create screen'
    return corsJson(req, { error: message }, 500)
  }
}
