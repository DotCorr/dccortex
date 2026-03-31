/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'

const AUTO_KEYS = ['id', 'created_at', 'updated_at', 'created_by']

async function getRowAndAccess(
  projectId: string,
  dsId: string,
  tableId: string,
  rowId: string,
  needWrite: boolean
) {
  const access = await requireProjectDataAccess(projectId, needWrite)
  if (!access.ok) return { error: NextResponse.json({ error: access.error }, { status: access.status }), row: null, table: null }
  const ds = await prisma.internalDatasource.findFirst({
    where: { id: dsId, projectId },
  })
  if (!ds) return { error: NextResponse.json({ error: 'Datasource not found' }, { status: 404 }), row: null, table: null }
  const table = await prisma.internalTable.findFirst({
    where: { id: tableId, datasourceId: dsId },
    include: { columns: true },
  })
  if (!table) return { error: NextResponse.json({ error: 'Table not found' }, { status: 404 }), row: null, table: null }
  const row = await prisma.internalRow.findFirst({
    where: { id: rowId, tableId },
  })
  if (!row) return { error: NextResponse.json({ error: 'Row not found' }, { status: 404 }), row: null, table: null }
  return { error: null, row, table }
}

function rowToJson(r: { id: string; data: unknown; createdAt: Date; updatedAt: Date; createdBy: string | null }) {
  return {
    id: r.id,
    ...((r.data as Record<string, unknown>) || {}),
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    created_by: r.createdBy,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; dsId: string; tableId: string; rowId: string }> | { id: string; dsId: string; tableId: string; rowId: string } }
) {
  const { id: projectId, dsId, tableId, rowId } = await Promise.resolve(params)
  const { error, row } = await getRowAndAccess(projectId, dsId, tableId, rowId, false)
  if (error) return error
  return NextResponse.json({ row: rowToJson(row!) })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; dsId: string; tableId: string; rowId: string }> | { id: string; dsId: string; tableId: string; rowId: string } }
) {
  const { id: projectId, dsId, tableId, rowId } = await Promise.resolve(params)
  const { error, row, table } = await getRowAndAccess(projectId, dsId, tableId, rowId, true)
  if (error) return error
  const body = await req.json().catch(() => ({}))
  const current = (row!.data as Record<string, unknown>) || {}
  const data: Record<string, unknown> = { ...current }
  for (const col of table!.columns) {
    if (AUTO_KEYS.includes(col.name)) continue
    if (body[col.name] !== undefined) data[col.name] = body[col.name]
  }
  const updated = await prisma.internalRow.update({
    where: { id: rowId },
    data: { data: data as import('@prisma/client').Prisma.InputJsonValue },
  })
  return NextResponse.json({ row: rowToJson(updated) })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; dsId: string; tableId: string; rowId: string }> | { id: string; dsId: string; tableId: string; rowId: string } }
) {
  const { id: projectId, dsId, tableId, rowId } = await Promise.resolve(params)
  const { error } = await getRowAndAccess(projectId, dsId, tableId, rowId, true)
  if (error) return error
  await prisma.internalRow.delete({ where: { id: rowId } })
  return NextResponse.json({ ok: true })
}
