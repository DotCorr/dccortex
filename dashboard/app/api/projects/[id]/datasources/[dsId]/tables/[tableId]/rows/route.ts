/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'

async function getTableAndAccess(
  projectId: string,
  dsId: string,
  tableId: string,
  needWrite: boolean
) {
  const access = await requireProjectDataAccess(projectId, needWrite)
  if (!access.ok) return { error: NextResponse.json({ error: access.error }, { status: access.status }), table: null }
  const ds = await prisma.internalDatasource.findFirst({
    where: { id: dsId, projectId },
  })
  if (!ds) return { error: NextResponse.json({ error: 'Datasource not found' }, { status: 404 }), table: null }
  const table = await prisma.internalTable.findFirst({
    where: { id: tableId, datasourceId: dsId },
    include: { columns: true },
  })
  if (!table) return { error: NextResponse.json({ error: 'Table not found' }, { status: 404 }), table: null }
  return { error: null, table }
}

const AUTO_KEYS = ['id', 'created_at', 'updated_at', 'created_by']

const SORT_FIELD_MAP = {
  id: 'id',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  created_by: 'createdBy',
} as const

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; dsId: string; tableId: string }> | { id: string; dsId: string; tableId: string } }
) {
  const { id: projectId, dsId, tableId } = await Promise.resolve(params)
  const { error, table } = await getTableAndAccess(projectId, dsId, tableId, false)
  if (error) return error
  const url = req.nextUrl
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))
  const skip = (page - 1) * limit
  const sort = url.searchParams.get('sort') || 'created_at'
  const order = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc'
  const sortField = SORT_FIELD_MAP[sort as keyof typeof SORT_FIELD_MAP] ?? SORT_FIELD_MAP.created_at

  const [rows, total] = await Promise.all([
    prisma.internalRow.findMany({
      where: { tableId: table!.id },
      orderBy: { [sortField]: order },
      skip,
      take: limit,
    }),
    prisma.internalRow.count({ where: { tableId: table!.id } }),
  ])
  const columnNames = table!.columns.map((c) => c.name)
  const out = rows.map((r) => {
    const data = (r.data as Record<string, unknown>) || {}
    return {
      id: r.id,
      ...data,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
      created_by: r.createdBy,
    }
  })
  return NextResponse.json({ rows: out, total, page, limit, columns: columnNames })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; dsId: string; tableId: string }> | { id: string; dsId: string; tableId: string } }
) {
  const { id: projectId, dsId, tableId } = await Promise.resolve(params)
  const { error, table } = await getTableAndAccess(projectId, dsId, tableId, true)
  if (error) return error
  const session = await requireProjectDataAccess(projectId, true)
  const userId = session.ok ? (session.session.user as any).id : null
  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  for (const col of table!.columns) {
    if (AUTO_KEYS.includes(col.name)) continue
    if (body[col.name] !== undefined) data[col.name] = body[col.name]
  }
  const row = await prisma.internalRow.create({
    data: {
      tableId: table!.id,
      data: data as import('@prisma/client').Prisma.InputJsonValue,
      createdBy: userId ?? undefined,
    },
  })
  const full = {
    id: row.id,
    ...((row.data as Record<string, unknown>) || {}),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    created_by: row.createdBy,
  }
  return NextResponse.json({ row: full })
}
