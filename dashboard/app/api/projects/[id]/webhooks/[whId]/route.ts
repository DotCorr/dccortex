/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'

async function resolveParams(params: Promise<{ id: string; whId: string }> | { id: string; whId: string }) {
  return Promise.resolve(params)
}

// PATCH /api/projects/[id]/webhooks/[whId] — update
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; whId: string }> | { id: string; whId: string } }
) {
  const { id: projectId, whId } = await resolveParams(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = await req.json()
  const { name, url, events, secret, active } = body

  const webhook = await prisma.projectWebhook.update({
    where: { id: whId, projectId },
    data: {
      ...(name !== undefined && { name }),
      ...(url !== undefined && { url }),
      ...(events !== undefined && { events }),
      ...(secret !== undefined && { secret: secret || null }),
      ...(active !== undefined && { active }),
    },
  })
  return NextResponse.json({ webhook })
}

// DELETE /api/projects/[id]/webhooks/[whId] — delete
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; whId: string }> | { id: string; whId: string } }
) {
  const { id: projectId, whId } = await resolveParams(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  await prisma.projectWebhook.delete({ where: { id: whId, projectId } })
  return NextResponse.json({ ok: true })
}

// POST /api/projects/[id]/webhooks/[whId]/test handled in a sub-route
