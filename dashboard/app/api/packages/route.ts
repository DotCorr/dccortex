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
import { Prisma } from '@prisma/client'

/**
 * Packages are stored in a `packages` table.
 * We use raw SQL so this works on the deployed container without needing
 * a Prisma migration (CREATE TABLE IF NOT EXISTS is safe to call every time).
 */

async function ensureTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      author_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      thumbnail_url TEXT DEFAULT '',
      tags JSONB DEFAULT '[]'::jsonb,
      content JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_public BOOLEAN DEFAULT false,
      version TEXT DEFAULT '1.0.0',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

export type PackageRow = {
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

function toPackage(r: PackageRow) {
  return {
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
  }
}

/** GET /api/packages?orgId=&search= */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id

    await ensureTable()

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId') ?? null
    const search = (searchParams.get('search') ?? '').trim().toLowerCase()

    let rows: PackageRow[]
    if (orgId) {
      rows = await prisma.$queryRaw<PackageRow[]>`
        SELECT * FROM packages
        WHERE (is_public = true OR organization_id = ${orgId} OR author_user_id = ${userId})
        ORDER BY updated_at DESC
      `
    } else {
      rows = await prisma.$queryRaw<PackageRow[]>`
        SELECT * FROM packages
        WHERE (is_public = true OR author_user_id = ${userId})
        ORDER BY updated_at DESC
      `
    }

    const packages = rows.map(toPackage).filter((p) => {
      if (!search) return true
      const name = String(p.name ?? '').toLowerCase()
      const desc = String(p.description ?? '').toLowerCase()
      const tags = (p.tags ?? []).map((t) => String(t ?? '').toLowerCase())
      return (
        name.includes(search) ||
        desc.includes(search) ||
        tags.some((t) => t.includes(search))
      )
    })

    return NextResponse.json({ packages })
  } catch (err: any) {
    console.error('[packages GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST /api/packages – publish a new package */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any).id

    await ensureTable()

    const body = await request.json()
    const {
      name,
      description = '',
      thumbnailUrl = '',
      tags = [],
      content,
      isPublic = false,
      version = '1.0.0',
      organizationId = null,
    } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!content || typeof content !== 'object') return NextResponse.json({ error: 'Content is required' }, { status: 400 })

    const id = `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []) as unknown as Prisma.InputJsonValue
    const contentJson = JSON.stringify(content) as unknown as Prisma.InputJsonValue

    await prisma.$executeRaw`
      INSERT INTO packages (id, organization_id, author_user_id, name, description, thumbnail_url, tags, content, is_public, version)
      VALUES (
        ${id},
        ${organizationId},
        ${userId},
        ${name.trim()},
        ${description},
        ${thumbnailUrl},
        ${tagsJson}::jsonb,
        ${contentJson}::jsonb,
        ${isPublic},
        ${version}
      )
    `

    return NextResponse.json({ ok: true, id })
  } catch (err: any) {
    console.error('[packages POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
