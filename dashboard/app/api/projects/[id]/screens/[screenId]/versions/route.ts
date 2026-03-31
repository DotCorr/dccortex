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

/** List versions for a screen (newest first, max 50) */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; screenId: string }> | { id: string; screenId: string } }
) {
  try {
    const { id: projectId, screenId } = await Promise.resolve(params)
    const access = await requireProjectDataAccess(projectId, false)
    if (!access.ok) return corsJson(req, { error: access.error }, access.status)

    const client = prisma as any
    if (!client.screenVersion?.findMany) {
      return corsJson(req, { versions: [] })
    }

    const versions = await client.screenVersion.findMany({
      where: { screenId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, createdAt: true },
    })
    return corsJson(req, { versions })
  } catch (err: any) {
    console.error('[versions] GET error:', err)
    return corsJson(req, { error: err?.message || 'Internal server error' }, 500)
  }
}

/** Restore a version: POST { versionId } */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; screenId: string }> | { id: string; screenId: string } }
) {
  try {
    const { id: projectId, screenId } = await Promise.resolve(params)
    const access = await requireProjectDataAccess(projectId, true)
    if (!access.ok) return corsJson(req, { error: access.error }, access.status)

    const body = await req.json().catch(() => ({}))
    const { versionId } = body
    if (!versionId || typeof versionId !== 'string') {
      return corsJson(req, { error: 'versionId is required' }, 400)
    }

    const client = prisma as any
    if (!client.screenVersion?.findFirst) {
      return corsJson(req, { error: 'Version history not available' }, 501)
    }

    const version = await client.screenVersion.findFirst({
      where: { id: versionId, screenId },
    })
    if (!version) return corsJson(req, { error: 'Version not found' }, 404)

    // Save current state as a new version before restoring
    const current = await client.appScreen.findFirst({ where: { id: screenId, projectId }, select: { layout: true, script: true } })
    if (current) {
      await client.screenVersion.create({ data: { screenId, layout: current.layout, script: current.script } })
    }

    // Restore
    await client.appScreen.update({
      where: { id: screenId },
      data: { layout: version.layout, script: version.script },
    })

    return corsJson(req, { ok: true, restoredFrom: versionId })
  } catch (err: any) {
    console.error('[versions] POST error:', err)
    return corsJson(req, { error: err?.message || 'Internal server error' }, 500)
  }
}
