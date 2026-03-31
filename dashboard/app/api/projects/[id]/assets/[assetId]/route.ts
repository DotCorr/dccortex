/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'
import { unlink } from 'fs/promises'
import path from 'path'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> | { id: string; assetId: string } }
) {
  const { id: projectId, assetId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const asset = await prisma.projectAsset.findFirst({ where: { id: assetId, projectId } })
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  // Delete file from disk
  try {
    const absPath = path.join(process.cwd(), 'public', 'uploads', asset.path)
    await unlink(absPath)
  } catch {
    // File already gone — still delete the DB record
  }

  await prisma.projectAsset.delete({ where: { id: assetId } })
  return NextResponse.json({ ok: true })
}
