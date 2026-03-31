/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

async function resolveParams(params: Promise<{ id: string }> | { id: string }) {
  return Promise.resolve(params)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id: projectId } = await resolveParams(params)
  const access = await requireProjectDataAccess(projectId, false)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const assets = await prisma.projectAsset.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ assets })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id: projectId } = await resolveParams(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // 50 MB limit
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 413 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const uuid = randomUUID()
  const filename = `${uuid}.${ext}`
  const relDir = projectId
  const relPath = `${relDir}/${filename}`
  // Store in persistent uploads/ directory (NOT public/) so files survive rebuilds & containers
  const absDir = path.join(process.cwd(), 'uploads', relDir)
  const absPath = path.join(absDir, filename)

  await mkdir(absDir, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(absPath, buffer)

  const asset = await prisma.projectAsset.create({
    data: {
      projectId,
      name: file.name,
      mimetype: file.type || 'application/octet-stream',
      size: file.size,
      path: relPath,
      url: `/api/uploads/${relPath}`,
    },
  })
  return NextResponse.json({ asset }, { status: 201 })
}
