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
  tableId: string
) {
  const access = await requireProjectDataAccess(projectId, true)
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

function parseCsv(text: string): string[][] {
  const lines: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (inQuotes) {
      cell += ch
    } else if (ch === ',' || ch === '\t') {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim())
      cell = ''
      lines.push(row)
      row = []
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim())
    lines.push(row)
  }
  return lines
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; dsId: string; tableId: string }> | { id: string; dsId: string; tableId: string } }
) {
  const { id: projectId, dsId, tableId } = await Promise.resolve(params)
  const { error, table } = await getTableAndAccess(projectId, dsId, tableId)
  if (error) return error
  const session = await requireProjectDataAccess(projectId, true)
  const userId = session.ok ? (session.session.user as any).id : null
  const formData = await req.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'No form data' }, { status: 400 })
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  const mapping = formData.get('mapping') as string | null
  const columnMap: Record<string, string> = mapping ? JSON.parse(mapping) : {}
  const text = await file.text()
  const rows = parseCsv(text)
  if (rows.length < 2) return NextResponse.json({ inserted: 0, errors: ['CSV has no data rows'] })
  const headers = rows[0]
  const colNames = (table!.columns.map((c) => c.name).filter((n) => !['id', 'created_at', 'updated_at', 'created_by'].includes(n))) as string[]
  const errors: string[] = []
  let inserted = 0
  for (let i = 1; i < rows.length; i++) {
    const raw = rows[i]
    const data: Record<string, unknown> = {}
    for (let j = 0; j < headers.length; j++) {
      const csvCol = headers[j]
      const targetCol = columnMap[csvCol] ?? csvCol
      if (!colNames.includes(targetCol)) continue
      let val: unknown = raw[j] ?? ''
      const col = table!.columns.find((c) => c.name === targetCol)
      if (col) {
        if (col.type === 'number') val = Number(val) || 0
        else if (col.type === 'boolean') val = /^(1|true|yes)$/i.test(String(val).trim())
        else if (col.type === 'date') val = String(val).trim()
        else val = String(val).trim()
      }
      data[targetCol] = val
    }
    try {
      await prisma.internalRow.create({
        data: { tableId: table!.id, data: data as import('@prisma/client').Prisma.InputJsonValue, createdBy: userId ?? undefined },
      })
      inserted++
    } catch (e: any) {
      errors.push(`Row ${i + 1}: ${e?.message || 'Failed'}`)
    }
  }
  return NextResponse.json({ inserted, errors: errors.slice(0, 20) })
}
