/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Public (unauthenticated) runtime mutation endpoint for published projects.
 * Allows no-code apps to insert / update / delete rows in internal tables at runtime.
 *
 * POST /api/p/[projectId]/data/mutate
 * Body: { action: 'insertRow' | 'updateRow' | 'deleteRow', table: string, data?: object, rowId?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> | { projectId: string } }
) {
  try {
    const { projectId } = await Promise.resolve(params)

    // Only published projects
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    })
    if (!project || project.status !== 'published') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { action, table: tableName, data: rowData, rowId } = body as {
      action: string
      table?: string
      data?: Record<string, unknown>
      rowId?: string
    }

    if (!action || !tableName) {
      return NextResponse.json({ error: 'action and table are required' }, { status: 400 })
    }

    // Find the internal datasource and table
    const ds = await prisma.internalDatasource.findUnique({
      where: { projectId },
    })
    if (!ds) {
      return NextResponse.json({ error: 'No internal datasource' }, { status: 404 })
    }

    const table = await prisma.internalTable.findFirst({
      where: { datasourceId: ds.id, name: { equals: tableName, mode: 'insensitive' } },
      include: { columns: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!table) {
      return NextResponse.json({ error: `Table "${tableName}" not found` }, { status: 404 })
    }

    const AUTO_KEYS = ['id', 'created_at', 'updated_at', 'created_by']

    switch (action) {
      case 'insertRow': {
        if (!rowData || typeof rowData !== 'object') {
          return NextResponse.json({ error: 'data object required for insertRow' }, { status: 400 })
        }
        // Only allow columns that exist on the table
        const sanitized: Record<string, unknown> = {}
        for (const col of table.columns) {
          if (AUTO_KEYS.includes(col.name)) continue
          if (rowData[col.name] !== undefined) sanitized[col.name] = rowData[col.name]
        }
        const row = await prisma.internalRow.create({
          data: {
            tableId: table.id,
            data: sanitized as import('@prisma/client').Prisma.InputJsonValue,
            createdBy: 'runtime',
          },
        })
        return NextResponse.json({
          ok: true,
          row: { id: row.id, ...sanitized, created_at: row.createdAt },
        })
      }

      case 'updateRow': {
        if (!rowId) {
          return NextResponse.json({ error: 'rowId required for updateRow' }, { status: 400 })
        }
        if (!rowData || typeof rowData !== 'object') {
          return NextResponse.json({ error: 'data object required for updateRow' }, { status: 400 })
        }
        const existing = await prisma.internalRow.findFirst({
          where: { id: rowId, tableId: table.id },
        })
        if (!existing) {
          return NextResponse.json({ error: 'Row not found' }, { status: 404 })
        }
        const current = (existing.data as Record<string, unknown>) || {}
        const merged: Record<string, unknown> = { ...current }
        for (const col of table.columns) {
          if (AUTO_KEYS.includes(col.name)) continue
          if (rowData[col.name] !== undefined) merged[col.name] = rowData[col.name]
        }
        const updated = await prisma.internalRow.update({
          where: { id: rowId },
          data: { data: merged as import('@prisma/client').Prisma.InputJsonValue },
        })
        return NextResponse.json({
          ok: true,
          row: { id: updated.id, ...merged, created_at: updated.createdAt },
        })
      }

      case 'deleteRow': {
        if (!rowId) {
          return NextResponse.json({ error: 'rowId required for deleteRow' }, { status: 400 })
        }
        const row = await prisma.internalRow.findFirst({
          where: { id: rowId, tableId: table.id },
        })
        if (!row) {
          return NextResponse.json({ error: 'Row not found' }, { status: 404 })
        }
        await prisma.internalRow.delete({ where: { id: rowId } })
        return NextResponse.json({ ok: true, deleted: rowId })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err: unknown) {
    console.error('[Public data mutate] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
