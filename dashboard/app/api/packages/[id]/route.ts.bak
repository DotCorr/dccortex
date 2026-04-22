/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = Promise<{ id: string }> | { id: string }

type PackageRow = {
  id: string
  organization_id: string | null
  author_user_id: string
  name: string
  description: string
  thumbnail_url: string
  tags: string[]
  content: Record<string, unknown>
  is_public: boolean
  version: string
  created_at: Date
  updated_at: Date
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await Promise.resolve(params)
    const rows = await prisma.$queryRaw<PackageRow[]>`SELECT * FROM packages WHERE id = ${id} LIMIT 1`
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const r = rows[0]
    return NextResponse.json({
      package: {
        id: r.id,
        organizationId: r.organization_id,
        authorUserId: r.author_user_id,
        name: r.name,
        description: r.description,
        thumbnailUrl: r.thumbnail_url,
        tags: Array.isArray(r.tags) ? r.tags : [],
        content: r.content,
        isPublic: r.is_public,
        version: r.version,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
    })
  } catch (err: any) {
    console.error('[package GET id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id

    const { id } = await Promise.resolve(params)
    // Only the author can delete
    const rows = await prisma.$queryRaw<{ author_user_id: string }[]>`
      SELECT author_user_id FROM packages WHERE id = ${id} LIMIT 1
    `
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (rows[0].author_user_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await prisma.$executeRaw`DELETE FROM packages WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[package DELETE id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id

    const { id } = await Promise.resolve(params)
    const rows = await prisma.$queryRaw<{ author_user_id: string }[]>`
      SELECT author_user_id FROM packages WHERE id = ${id} LIMIT 1
    `
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (rows[0].author_user_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { name, description, thumbnailUrl, tags, isPublic, version } = body

    await prisma.$executeRaw`
      UPDATE packages SET
        name = COALESCE(${name ?? null}, name),
        description = COALESCE(${description ?? null}, description),
        thumbnail_url = COALESCE(${thumbnailUrl ?? null}, thumbnail_url),
        tags = COALESCE(${tags ? JSON.stringify(tags) : null}::jsonb, tags),
        is_public = COALESCE(${isPublic ?? null}, is_public),
        version = COALESCE(${version ?? null}, version),
        updated_at = NOW()
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[package PATCH id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
