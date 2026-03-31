/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

function parseOrgReusables(metadata) {
  if (!metadata || typeof metadata !== 'object') return []
  const raw = metadata.orgReusables
  if (!Array.isArray(raw)) return []
  return raw.filter((item) => {
    if (!item || typeof item !== 'object') return false
    return typeof item.id === 'string' && typeof item.name === 'string' && item.root !== undefined
  })
}

async function getAccess(params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: organizationId } = await Promise.resolve(params)
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      members: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
    },
  })

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const member = org.members[0]
  const isOwner = org.ownerId === userId
  if (!isOwner && !member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const canWrite = isOwner || member?.role === 'owner' || member?.role === 'admin'
  return { organizationId: org.id, canWrite }
}

export async function GET(_request, { params }) {
  try {
    const access = await getAccess(params)
    if (access instanceof NextResponse) return access

    const org = await prisma.organization.findUnique({
      where: { id: access.organizationId },
      select: { metadata: true },
    })

    return NextResponse.json({ reusables: parseOrgReusables(org?.metadata) })
  } catch (err) {
    console.error('[org reusables GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  try {
    const access = await getAccess(params)
    if (access instanceof NextResponse) return access
    if (!access.canWrite) {
      return NextResponse.json({ error: 'Only owner/admin can promote reusables' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const reusable = body?.reusable

    if (!reusable || typeof reusable !== 'object' || !reusable.id || !reusable.name || reusable.root === undefined) {
      return NextResponse.json({ error: 'Invalid reusable payload' }, { status: 400 })
    }

    const org = await prisma.organization.findUnique({
      where: { id: access.organizationId },
      select: { metadata: true },
    })
    const metadata = org?.metadata && typeof org.metadata === 'object' ? org.metadata : {}

    const existing = parseOrgReusables(metadata)
    const now = new Date().toISOString()
    const normalized = {
      id: String(reusable.id),
      name: String(reusable.name),
      root: JSON.parse(JSON.stringify(reusable.root)),
      propsSchema: reusable.propsSchema === undefined ? undefined : JSON.parse(JSON.stringify(reusable.propsSchema)),
      createdAt: reusable.createdAt || now,
      updatedAt: now,
    }

    const idx = existing.findIndex((r) => r.id === normalized.id)
    const next = [...existing]
    if (idx >= 0) {
      next[idx] = {
        ...next[idx],
        ...normalized,
        createdAt: next[idx].createdAt || normalized.createdAt,
      }
    } else {
      next.push(normalized)
    }

    const nextMetadata = JSON.parse(JSON.stringify(metadata ?? {}))
    nextMetadata.orgReusables = JSON.parse(JSON.stringify(next))

    await prisma.$executeRaw(
      Prisma.sql`UPDATE organizations SET metadata = ${JSON.stringify(nextMetadata)}::jsonb, updated_at = NOW() WHERE id = ${access.organizationId}`
    )

    return NextResponse.json({
      ok: true,
      reusable: normalized,
      reusables: next,
    })
  } catch (err) {
    console.error('[org reusables POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
