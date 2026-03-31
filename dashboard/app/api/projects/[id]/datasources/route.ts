/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id: projectId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, false)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const list = await prisma.internalDatasource.findMany({
    where: { projectId },
    include: { tables: { include: { columns: true } } },
  })
  return NextResponse.json({ datasources: list })
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id: projectId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const existing = await prisma.internalDatasource.findUnique({ where: { projectId } })
  if (existing) return NextResponse.json({ datasource: existing })

  const datasource = await prisma.internalDatasource.create({
    data: { projectId },
    include: { tables: true },
  })
  return NextResponse.json({ datasource })
}
