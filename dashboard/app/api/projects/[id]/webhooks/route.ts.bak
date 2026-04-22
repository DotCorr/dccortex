/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'

async function resolveId(params: Promise<{ id: string }> | { id: string }) {
  return (await Promise.resolve(params)).id
}

// GET /api/projects/[id]/webhooks — list all webhooks for a project
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const projectId = await resolveId(params)
  const access = await requireProjectDataAccess(projectId, false)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const webhooks = await prisma.projectWebhook.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ webhooks })
}

// POST /api/projects/[id]/webhooks — create a webhook
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const projectId = await resolveId(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = await req.json()
  const { name, url, events, secret, active } = body
  if (!name || !url) return NextResponse.json({ error: 'name and url required' }, { status: 400 })

  const webhook = await prisma.projectWebhook.create({
    data: {
      projectId,
      name,
      url,
      events: events ?? [],
      secret: secret ?? null,
      active: active !== false,
    },
  })
  return NextResponse.json({ webhook }, { status: 201 })
}
