/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { publishProjectSync } from '@/lib/projects/live-sync'

/**
 * Globals (reusables, global state, theme) are stored as a reserved AppScreen row
 * with slug = '__globals__'. This avoids needing a metadata column on Project,
 * which is not in the deployed Prisma client.
 */
const GLOBALS_SLUG = '__globals__'

type Params = Promise<{ id: string }> | { id: string }

async function getAuthorisedProjectId(req: NextRequest, params: Params): Promise<{ projectId: string } | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: projectId } = await Promise.resolve(params)
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId },
        { organization: { members: { some: { userId } } } },
      ],
    },
    select: { id: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return { projectId: project.id }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const result = await getAuthorisedProjectId(request, params)
    if (result instanceof NextResponse) return result
    const { projectId } = result
    const clientId = request.headers.get('x-dcc-client-id')?.trim() || undefined

    const row = await prisma.appScreen.findUnique({
      where: { projectId_slug: { projectId, slug: GLOBALS_SLUG } },
      select: { layout: true },
    })

    return NextResponse.json({ globals: (row?.layout ?? {}) as Record<string, unknown> })
  } catch (err: any) {
    console.error('[globals GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const result = await getAuthorisedProjectId(request, params)
    if (result instanceof NextResponse) return result
    const { projectId } = result
    const clientId = request.headers.get('x-dcc-client-id')?.trim() || undefined

    const body = await request.json()
    const globals = body?.globals ?? body // accept { globals: {...} } or the object directly

    await prisma.appScreen.upsert({
      where: { projectId_slug: { projectId, slug: GLOBALS_SLUG } },
      create: {
        projectId,
        slug: GLOBALS_SLUG,
        name: GLOBALS_SLUG,
        layout: globals as any,
        sortOrder: -1, // keep it out of the way
      },
      update: {
        layout: globals as any,
      },
    })

    publishProjectSync({
      type: 'globals',
      projectId,
      clientId,
      payload: globals,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[globals PUT]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
