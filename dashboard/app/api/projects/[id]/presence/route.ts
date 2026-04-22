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
import { listPresence, publishProjectSync, removePresence, upsertPresence } from '@/lib/projects/live-sync'

type Params = Promise<{ id: string }> | { id: string }

async function getAuthorisedProjectContext(params: any): Promise<{ projectId: string; userId: string; name: string | null } | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id?: string; name?: string | null }
  if (!user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = params
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId: user.id },
        { organization: { members: { some: { userId: user.id } } } },
      ],
    },
    select: { id: true },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return { projectId: project.id, userId: user.id, name: user.name ?? null }
}

export async function GET(
  _request: NextRequest,
  context: any
) {
  try {
    const auth = await getAuthorisedProjectContext(context.params)
    if (auth instanceof NextResponse) return auth

    return NextResponse.json({
      presence: listPresence(auth.projectId).map(({ updatedAt, ...rest }) => rest),
    })
  } catch (err) {
    console.error('[presence GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const auth = await getAuthorisedProjectContext(context.params)
    if (auth instanceof NextResponse) return auth

    const body = await request.json().catch(() => ({}))
    const clientId = typeof body.clientId === 'string' && body.clientId.trim()
      ? body.clientId.trim()
      : `client-${auth.userId}`
    const screenId = typeof body.screenId === 'string' && body.screenId.trim()
      ? body.screenId.trim()
      : null
    const selectionId = typeof body.selectionId === 'string' && body.selectionId.trim()
      ? body.selectionId.trim()
      : null
    const cursorX = typeof body.cursorX === 'number' && Number.isFinite(body.cursorX)
      ? Math.min(1, Math.max(0, body.cursorX))
      : null
    const cursorY = typeof body.cursorY === 'number' && Number.isFinite(body.cursorY)
      ? Math.min(1, Math.max(0, body.cursorY))
      : null
    const viewState = body.viewState && typeof body.viewState === 'object'
      ? (body.viewState as Record<string, unknown>)
      : null

    const presence = upsertPresence({
      projectId: auth.projectId,
      userId: auth.userId,
      name: auth.name,
      screenId,
      selectionId,
      cursorX,
      cursorY,
      viewState,
      clientId,
    })

    publishProjectSync({
      type: 'presence',
      projectId: auth.projectId,
      clientId,
      payload: presence.map(({ updatedAt, ...rest }) => rest),
    })

    return NextResponse.json({
      ok: true,
      presence: presence.map(({ updatedAt, ...rest }) => rest),
    })
  } catch (err) {
    console.error('[presence POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: any
) {
  try {
    const auth = await getAuthorisedProjectContext(context.params)
    if (auth instanceof NextResponse) return auth

    const body = await request.json().catch(() => ({}))
    const clientId = typeof body.clientId === 'string' && body.clientId.trim()
      ? body.clientId.trim()
      : null

    if (!clientId) {
      return NextResponse.json({ error: 'clientId required' }, { status: 400 })
    }

    const presence = removePresence(auth.projectId, clientId)
    publishProjectSync({
      type: 'presence',
      projectId: auth.projectId,
      clientId,
      payload: presence.map(({ updatedAt, ...rest }) => rest),
    })

    return NextResponse.json({
      ok: true,
      presence: presence.map(({ updatedAt, ...rest }) => rest),
    })
  } catch (err) {
    console.error('[presence DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
