/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'
import { corsJson, withCors } from '@/lib/cors'

export async function OPTIONS(req: NextRequest) {
  return withCors(new Response(null, { status: 204 }), req.headers.get('origin'))
}

/** Export a screen as a portable JSON payload */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; screenId: string }> | { id: string; screenId: string } }
) {
  try {
    const { id: projectId, screenId } = await Promise.resolve(params)
    const access = await requireProjectDataAccess(projectId, false)
    if (!access.ok) return corsJson(req, { error: access.error }, access.status)

    const client = prisma as any
    const screen = client.appScreen?.findFirst
      ? await client.appScreen.findFirst({ where: { id: screenId, projectId } })
      : null
    if (!screen) return corsJson(req, { error: 'Screen not found' }, 404)

    const exported = {
      _format: 'dccortex-screen-v1',
      name: screen.name,
      slug: screen.slug,
      layout: screen.layout,
      script: screen.script ?? null,
      exportedAt: new Date().toISOString(),
    }
    return corsJson(req, { screen: exported })
  } catch (err: any) {
    console.error('[export] GET error:', err)
    return corsJson(req, { error: err?.message || 'Internal server error' }, 500)
  }
}

/** Import a screen from a previously exported JSON payload.
 *  POST body: { screen: { name?, slug?, layout, script? } }
 *  Creates a new screen in the project with the imported layout.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; screenId: string }> | { id: string; screenId: string } }
) {
  try {
    const { id: projectId } = await Promise.resolve(params)
    const access = await requireProjectDataAccess(projectId, true)
    if (!access.ok) return corsJson(req, { error: access.error }, access.status)

    const body = await req.json().catch(() => ({}))
    const data = body?.screen
    if (!data || typeof data !== 'object' || !data.layout) {
      return corsJson(req, { error: 'Invalid import payload — screen.layout is required' }, 400)
    }

    const client = prisma as any
    if (!client.appScreen?.create) {
      return corsJson(req, { error: 'Screen model not available' }, 501)
    }

    // Ensure unique slug
    const baseSlug = String(data.slug || 'imported-screen').replace(/[^a-z0-9-]/gi, '-').toLowerCase()
    let slug = baseSlug
    let attempt = 0
    while (await client.appScreen.findFirst({ where: { projectId, slug } })) {
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    const created = await client.appScreen.create({
      data: {
        projectId,
        name: String(data.name || slug),
        slug,
        layout: data.layout,
        script: data.script ?? null,
        sortOrder: 999,
      },
    })

    return corsJson(req, { screen: { id: created.id, name: created.name, slug: created.slug } }, 201)
  } catch (err: any) {
    console.error('[import] POST error:', err)
    return corsJson(req, { error: err?.message || 'Internal server error' }, 500)
  }
}
