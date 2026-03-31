/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

/**
 * Public asset upload for published apps.
 * Only allows uploads to projects with status "published".
 * 10 MB limit (stricter than authenticated endpoint).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> | { projectId: string } }
) {
  const { projectId } = await Promise.resolve(params)

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, status: true },
  })
  if (!project || project.status !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // 10 MB limit for public uploads
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
  }

  // Only allow safe file types
  const allowedTypes = ['image/', 'audio/', 'video/', 'application/pdf']
  if (!allowedTypes.some(t => file.type.startsWith(t))) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 415 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const uuid = randomUUID()
  const filename = `${uuid}.${ext}`
  const relDir = projectId
  const relPath = `${relDir}/${filename}`
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
