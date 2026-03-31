/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; dsId: string }> | { id: string; dsId: string } }
) {
  const { id: projectId, dsId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = await req.json()
  const { realtimePollMs } = body

  const ds = await prisma.internalDatasource.update({
    where: { id: dsId, projectId },
    data: {
      realtimePollMs: Math.max(0, Number(realtimePollMs) || 0),
    },
  })

  return NextResponse.json({ datasource: ds })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; dsId: string }> | { id: string; dsId: string } }
) {
  const { id: projectId, dsId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, false)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const ds = await prisma.internalDatasource.findUnique({
    where: { id: dsId, projectId },
    include: { tables: { include: { columns: true } } },
  })
  if (!ds) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ datasource: ds })
}
