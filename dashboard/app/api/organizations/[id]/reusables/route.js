/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, hasPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/audit'

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
    select: { id: true },
  })

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const canView = await hasPermission(organizationId, PERMISSIONS.APP_VIEW, session)
  if (!canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const canWrite = await hasPermission(organizationId, PERMISSIONS.ORG_MANAGE, session)
  return { organizationId: org.id, canWrite, userId }
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
      await logAuditEvent({
        action: 'org.reusable.promote',
        status: 'denied',
        actorUserId: access.userId,
        organizationId: access.organizationId,
        targetType: 'reusable',
        reason: 'insufficient_permissions',
        request,
      })
      return NextResponse.json({ error: 'Insufficient permissions to promote reusables' }, { status: 403 })
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

    await prisma.organization.update({
      where: { id: access.organizationId },
      data: { metadata: nextMetadata },
    })

    await logAuditEvent({
      action: 'org.reusable.promote',
      status: 'success',
      actorUserId: access.userId,
      organizationId: access.organizationId,
      targetType: 'reusable',
      targetId: normalized.id,
      metadata: {
        reusableName: normalized.name,
      },
      request,
    })

    return NextResponse.json({
      ok: true,
      reusable: normalized,
      reusables: next,
    })
  } catch (err) {
    console.error('[org reusables POST]', err)
    const { id: organizationId } = await Promise.resolve(params)
    await logAuditEvent({
      action: 'org.reusable.promote',
      status: 'failure',
      actorUserId: null,
      organizationId,
      targetType: 'reusable',
      reason: err instanceof Error ? err.message : 'unknown_error',
      request,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
