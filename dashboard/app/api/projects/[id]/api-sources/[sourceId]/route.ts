/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'

async function getSource(projectId: string, sourceId: string) {
  return prisma.externalApiSource.findFirst({ where: { id: sourceId, projectId } })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> | { id: string; sourceId: string } }
) {
  const { id: projectId, sourceId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, false)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const source = await getSource(projectId, sourceId)
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ source })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> | { id: string; sourceId: string } }
) {
  const { id: projectId, sourceId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const existing = await getSource(projectId, sourceId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const updated = await prisma.externalApiSource.update({
    where: { id: sourceId },
    data: {
      name: body.name ?? existing.name,
      url: body.url ?? existing.url,
      method: body.method ?? existing.method,
      headers: body.headers !== undefined ? body.headers : existing.headers,
      body: body.body !== undefined ? body.body : existing.body,
      authType: body.authType ?? existing.authType,
      authValue: body.authValue !== undefined ? body.authValue : existing.authValue,
      authHeader: body.authHeader !== undefined ? body.authHeader : existing.authHeader,
      schema: body.schema !== undefined ? body.schema : existing.schema,
      urlParams: body.urlParams !== undefined ? body.urlParams : (existing as any).urlParams,
    },
  })
  return NextResponse.json({ source: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> | { id: string; sourceId: string } }
) {
  const { id: projectId, sourceId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const existing = await getSource(projectId, sourceId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.externalApiSource.delete({ where: { id: sourceId } })
  return NextResponse.json({ ok: true })
}
