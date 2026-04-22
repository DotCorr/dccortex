/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, hasPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'
import { PERMISSIONS } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/audit'

type ResourceCatalogRules = {
  memberDataSharingEnabled: boolean
}

function parseResourceCatalogRules(metadata: unknown): ResourceCatalogRules {
  if (!metadata || typeof metadata !== 'object') return { memberDataSharingEnabled: true }
  const rules = (metadata as Record<string, unknown>).resourceCatalogRules
  if (!rules || typeof rules !== 'object') return { memberDataSharingEnabled: true }
  const enabled = (rules as Record<string, unknown>).memberDataSharingEnabled
  return {
    memberDataSharingEnabled: typeof enabled === 'boolean' ? enabled : true,
  }
}

function nextImportedName(base: string, usedNames: Set<string>): string {
  if (!usedNames.has(base)) return base
  let idx = 2
  while (usedNames.has(`${base} (${idx})`)) idx += 1
  return `${base} (${idx})`
}

export async function POST(
  request: NextRequest,
  context: any
) {
  const resolvedParams = await Promise.resolve(context.params)
  const targetProjectId = resolvedParams.id

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const access = await requireProjectDataAccess(targetProjectId, true)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const body = await request.json().catch(() => ({})) as { organizationId?: string; sourceId?: string }
    const organizationId = typeof body.organizationId === 'string' ? body.organizationId : ''
    const sourceId = typeof body.sourceId === 'string' ? body.sourceId : ''

    if (!organizationId || !sourceId) {
      return NextResponse.json({ error: 'organizationId and sourceId are required' }, { status: 400 })
    }

    if (access.project.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Target project is not part of the provided organization' }, { status: 400 })
    }

    const canViewApp = await hasPermission(organizationId, PERMISSIONS.APP_VIEW, session)
    if (!canViewApp) {
      await logAuditEvent({
        action: 'org.api_source.import',
        status: 'denied',
        actorUserId: session.user.id,
        organizationId,
        projectId: targetProjectId,
        targetType: 'api_source',
        targetId: sourceId,
        reason: 'insufficient_permissions',
        request,
      })
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const canManage = await hasPermission(organizationId, PERMISSIONS.ORG_MANAGE, session)
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { metadata: true },
    })
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const rules = parseResourceCatalogRules(org.metadata)
    if (!canManage && !rules.memberDataSharingEnabled) {
      await logAuditEvent({
        action: 'org.api_source.import',
        status: 'denied',
        actorUserId: session.user.id,
        organizationId,
        projectId: targetProjectId,
        targetType: 'api_source',
        targetId: sourceId,
        reason: 'member_data_sharing_disabled',
        request,
      })
      return NextResponse.json({ error: 'Admins disabled member data sharing for this organization' }, { status: 403 })
    }

    const source = await prisma.externalApiSource.findFirst({
      where: {
        id: sourceId,
        project: {
          organizationId,
        },
      },
    })

    if (!source) {
      return NextResponse.json({ error: 'Source API not found' }, { status: 404 })
    }

    const existingNames = await prisma.externalApiSource.findMany({
      where: { projectId: targetProjectId },
      select: { name: true },
    })
    const usedNames = new Set(existingNames.map((item) => item.name))
    const targetName = nextImportedName(source.name, usedNames)

    const imported = await prisma.externalApiSource.create({
      data: {
        projectId: targetProjectId,
        name: targetName,
        url: source.url,
        method: source.method,
        headers: source.headers ?? undefined,
        body: source.body ?? null,
        authType: source.authType,
        authValue: source.authValue ?? null,
        authHeader: source.authHeader ?? null,
        schema: source.schema ?? undefined,
        urlParams: source.urlParams ?? undefined,
      },
    })

    await logAuditEvent({
      action: 'org.api_source.import',
      status: 'success',
      actorUserId: session.user.id,
      organizationId,
      projectId: targetProjectId,
      targetType: 'api_source',
      targetId: imported.id,
      metadata: {
        sourceId,
        sourceProjectId: source.projectId,
      },
      request,
    })

    return NextResponse.json({ ok: true, source: imported })
  } catch (error) {
    await logAuditEvent({
      action: 'org.api_source.import',
      status: 'failure',
      actorUserId: null,
      organizationId: null,
      projectId: targetProjectId,
      targetType: 'api_source',
      reason: error instanceof Error ? error.message : 'unknown_error',
      request,
    })
    console.error('[org api-source import]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
