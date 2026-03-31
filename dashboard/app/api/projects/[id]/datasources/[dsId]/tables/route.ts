/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'

async function getDsAndAccess(projectId: string, dsId: string, needWrite: boolean) {
  const access = await requireProjectDataAccess(projectId, needWrite)
  if (!access.ok) return { error: NextResponse.json({ error: access.error }, { status: access.status }), ds: null }
  const ds = await prisma.internalDatasource.findFirst({
    where: { id: dsId, projectId },
    include: { tables: { include: { columns: true } } },
  })
  if (!ds) return { error: NextResponse.json({ error: 'Datasource not found' }, { status: 404 }), ds: null }
  return { error: null, ds }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; dsId: string }> | { id: string; dsId: string } }
) {
  const { id: projectId, dsId } = await Promise.resolve(params)
  const { error, ds } = await getDsAndAccess(projectId, dsId, false)
  if (error) return error
  return NextResponse.json({ tables: ds!.tables })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; dsId: string }> | { id: string; dsId: string } }
) {
  const { id: projectId, dsId } = await Promise.resolve(params)
  const { error, ds } = await getDsAndAccess(projectId, dsId, true)
  if (error) return error
  const body = await req.json().catch(() => ({}))
  const name = (body.name as string)?.trim() || 'Table'
  const existing = await prisma.internalTable.findUnique({
    where: { datasourceId_name: { datasourceId: ds!.id, name } },
  })
  if (existing) return NextResponse.json({ error: 'Table with this name already exists' }, { status: 409 })
  const table = await prisma.internalTable.create({
    data: { datasourceId: ds!.id, name },
    include: { columns: true },
  })
  return NextResponse.json({ table })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; dsId: string }> | { id: string; dsId: string } }
) {
  const resolved = await Promise.resolve(params)
  const projectId = resolved.id
  const dsId = resolved.dsId
  const { error, ds } = await getDsAndAccess(projectId, dsId, true)
  if (error) return error
  const body = await req.json().catch(() => ({}))
  const tableId = (req.nextUrl.searchParams.get('tableId') || body.tableId) as string
  if (!tableId) return NextResponse.json({ error: 'tableId required' }, { status: 400 })
  const table = await prisma.internalTable.findFirst({
    where: { id: tableId, datasourceId: ds!.id },
    include: { columns: true },
  })
  if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })
  const name = (body.name as string)?.trim()
  if (name !== undefined) {
    await prisma.internalTable.update({ where: { id: tableId }, data: { name } })
  }
  if (Array.isArray(body.columns)) {
    const cols = body.columns as Array<{ id?: string; name: string; type: string; sortOrder?: number }>
    const systemNames = new Set(['id', 'created_at', 'updated_at', 'created_by'])
    for (const c of cols) {
      if (systemNames.has(c.name)) continue
      const type = (c.type || 'text').toLowerCase()
      if (!['text', 'number', 'date', 'boolean', 'email', 'url', 'json'].includes(type)) continue
      const existing = table.columns.find((x) => x.name === c.name)
      if (existing) {
        await prisma.internalColumn.update({
          where: { id: existing.id },
          data: { type, sortOrder: c.sortOrder ?? existing.sortOrder },
        })
      } else {
        await prisma.internalColumn.create({
          data: { tableId, name: c.name, type, sortOrder: c.sortOrder ?? 0 },
        })
      }
    }
  }
  const updated = await prisma.internalTable.findUnique({
    where: { id: tableId },
    include: { columns: true },
  })
  return NextResponse.json({ table: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; dsId: string }> | { id: string; dsId: string } }
) {
  const { id: projectId, dsId } = await Promise.resolve(params)
  const { error, ds } = await getDsAndAccess(projectId, dsId, true)
  if (error) return error
  const tableId = req.nextUrl.searchParams.get('tableId') as string
  if (!tableId) return NextResponse.json({ error: 'tableId required' }, { status: 400 })
  const table = await prisma.internalTable.findFirst({
    where: { id: tableId, datasourceId: ds!.id },
  })
  if (!table) return NextResponse.json({ error: 'Table not found' }, { status: 404 })
  await prisma.internalTable.delete({ where: { id: tableId } })
  return NextResponse.json({ ok: true })
}
