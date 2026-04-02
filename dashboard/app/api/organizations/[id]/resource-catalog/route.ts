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
import { PERMISSIONS } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/audit'

type OrgReusable = {
  id: string
  name: string
  root: unknown
  propsSchema?: unknown
  createdAt?: string
  updatedAt?: string
  sourceProjectId?: string
  sourceProjectName?: string
  sourceOwnerUserId?: string
  sourceOwnerName?: string
  sourceOwnerEmail?: string
  promotedByUserId?: string
}

type ResourceCatalogRules = {
  memberDataSharingEnabled: boolean
}

type ReusableUsageEntry = {
  projectId: string
  projectName: string
  screenId: string
  screenName: string
  screenSlug: string
  instanceCount: number
}

function parseOrgReusables(metadata: unknown): OrgReusable[] {
  if (!metadata || typeof metadata !== 'object') return []
  const raw = (metadata as Record<string, unknown>).orgReusables
  if (!Array.isArray(raw)) return []

  return raw
    .filter((item) => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as Record<string, unknown>
      return typeof candidate.id === 'string' && typeof candidate.name === 'string' && candidate.root !== undefined
    })
    .map((item) => {
      const candidate = item as Record<string, unknown>
      return {
        id: String(candidate.id),
        name: String(candidate.name),
        root: candidate.root,
        propsSchema: candidate.propsSchema,
        createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : undefined,
        updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined,
      }
    })
}

function walkNode(node: unknown, visit: (node: Record<string, unknown>) => void): void {
  if (!node || typeof node !== 'object') return
  const record = node as Record<string, unknown>
  visit(record)
  const children = record.children
  if (Array.isArray(children)) {
    for (const child of children) {
      walkNode(child, visit)
    }
  }
}

function collectReusableRefs(layout: unknown): Map<string, number> {
  const counts = new Map<string, number>()
  walkNode(layout, (node) => {
    if (node.type !== 'reusableInstance') return
    const props = node.props
    if (!props || typeof props !== 'object') return
    const reusableId = String((props as Record<string, unknown>).reusableId ?? '').trim()
    if (!reusableId) return
    counts.set(reusableId, (counts.get(reusableId) ?? 0) + 1)
  })
  return counts
}

function textMatches(value: string | null | undefined, query: string): boolean {
  if (!query) return true
  return String(value ?? '').toLowerCase().includes(query)
}

function parseResourceCatalogRules(metadata: unknown): ResourceCatalogRules {
  if (!metadata || typeof metadata !== 'object') return { memberDataSharingEnabled: true }
  const rules = (metadata as Record<string, unknown>).resourceCatalogRules
  if (!rules || typeof rules !== 'object') return { memberDataSharingEnabled: true }

  const memberDataSharingEnabledRaw = (rules as Record<string, unknown>).memberDataSharingEnabled
  return {
    memberDataSharingEnabled: typeof memberDataSharingEnabledRaw === 'boolean' ? memberDataSharingEnabledRaw : true,
  }
}

function withResourceCatalogRules(metadata: unknown, rules: ResourceCatalogRules): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object'
    ? JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>
    : {}
  base.resourceCatalogRules = {
    ...(base.resourceCatalogRules && typeof base.resourceCatalogRules === 'object' ? base.resourceCatalogRules as Record<string, unknown> : {}),
    memberDataSharingEnabled: rules.memberDataSharingEnabled,
  }
  return base
}

async function getAccess(request: NextRequest, params: Promise<{ id: string }> | { id: string }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: organizationId } = await Promise.resolve(params)
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, metadata: true },
  })

  if (!organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const canViewApp = await hasPermission(organizationId, PERMISSIONS.APP_VIEW, session)
  if (!canViewApp) {
    await logAuditEvent({
      action: 'org.resource_catalog.read',
      status: 'denied',
      actorUserId: session.user.id,
      organizationId,
      targetType: 'organization',
      targetId: organizationId,
      reason: 'insufficient_permissions',
      request,
    })
    return NextResponse.json({ error: 'Insufficient permissions to view organization resource catalog' }, { status: 403 })
  }

  const canManage = await hasPermission(organizationId, PERMISSIONS.ORG_MANAGE, session)

  return {
    organizationId,
    actorUserId: session.user.id,
    organizationMetadata: organization.metadata,
    canManage,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const access = await getAccess(request, params)
    if (access instanceof NextResponse) return access

    const query = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? ''
    const selectedProjectId = request.nextUrl.searchParams.get('projectId')?.trim() ?? ''
    const rules = parseResourceCatalogRules(access.organizationMetadata)
    const canViewDataResources = access.canManage || rules.memberDataSharingEnabled

    const projects = await prisma.project.findMany({
      where: { organizationId: access.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const projectById = new Map(projects.map((project) => [project.id, project]))

    const allowedProjectIds = new Set(projects.map((project) => project.id))
    const scopedProjectIds = selectedProjectId && allowedProjectIds.has(selectedProjectId)
      ? [selectedProjectId]
      : projects.map((project) => project.id)

    const [assets, apiSources, datasources, screens] = await Promise.all([
      canViewDataResources
        ? prisma.projectAsset.findMany({
            where: { projectId: { in: scopedProjectIds } },
            select: {
              id: true,
              name: true,
              mimetype: true,
              size: true,
              url: true,
              createdAt: true,
              projectId: true,
              project: {
                select: {
                  name: true,
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      canViewDataResources
        ? prisma.externalApiSource.findMany({
            where: { projectId: { in: scopedProjectIds } },
            select: {
              id: true,
              name: true,
              method: true,
              url: true,
              authType: true,
              headers: true,
              body: true,
              authValue: true,
              authHeader: true,
              schema: true,
              updatedAt: true,
              projectId: true,
              project: {
                select: {
                  name: true,
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
            orderBy: { updatedAt: 'desc' },
          })
        : Promise.resolve([]),
      canViewDataResources
        ? prisma.internalDatasource.findMany({
            where: { projectId: { in: scopedProjectIds } },
            select: {
              id: true,
              projectId: true,
              project: {
                select: {
                  name: true,
                  user: { select: { id: true, name: true, email: true } },
                },
              },
              tables: {
                select: {
                  id: true,
                  name: true,
                  _count: {
                    select: {
                      columns: true,
                      rows: true,
                    },
                  },
                },
                orderBy: { name: 'asc' },
              },
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
      prisma.appScreen.findMany({
        where: { projectId: { in: scopedProjectIds } },
        select: {
          id: true,
          name: true,
          slug: true,
          projectId: true,
          layout: true,
          project: { select: { name: true } },
        },
      }),
    ])

    const orgReusables = parseOrgReusables(access.organizationMetadata)
    const reusablesWithSourceMeta = orgReusables.map((item) => {
      const sourceProjectId = item.sourceProjectId
      const sourceProject = sourceProjectId ? projectById.get(sourceProjectId) : undefined
      return {
        ...item,
        sourceProjectName: item.sourceProjectName ?? sourceProject?.name,
        sourceOwnerUserId: item.sourceOwnerUserId ?? sourceProject?.user?.id,
        sourceOwnerName: item.sourceOwnerName ?? sourceProject?.user?.name ?? null,
        sourceOwnerEmail: item.sourceOwnerEmail ?? sourceProject?.user?.email ?? null,
      }
    })

    const reusableNameById = new Map(reusablesWithSourceMeta.map((item) => [item.id, item.name]))
    const reusableUsageMap = new Map<string, ReusableUsageEntry[]>()

    for (const screen of screens) {
      const refs = collectReusableRefs(screen.layout)
      refs.forEach((instanceCount, reusableId) => {
        const entries = reusableUsageMap.get(reusableId) ?? []
        entries.push({
          projectId: screen.projectId,
          projectName: screen.project?.name ?? 'Unknown project',
          screenId: screen.id,
          screenName: screen.name,
          screenSlug: screen.slug,
          instanceCount,
        })
        reusableUsageMap.set(reusableId, entries)
      })
    }

    const reusableUsage = Array.from(reusableUsageMap.entries())
      .map(([reusableId, usage]) => ({
        reusableId,
        reusableName: reusableNameById.get(reusableId) ?? null,
        totalInstances: usage.reduce((sum, item) => sum + item.instanceCount, 0),
        usage,
      }))
      .filter((item) => {
        if (!query) return true
        if (textMatches(item.reusableName, query) || textMatches(item.reusableId, query)) return true
        return item.usage.some((entry) => textMatches(entry.projectName, query) || textMatches(entry.screenName, query))
      })
      .sort((a, b) => b.totalInstances - a.totalInstances)

    const filteredOrgReusables = reusablesWithSourceMeta
      .filter((item) => {
        if (!query) return true
        return (
          textMatches(item.name, query)
          || textMatches(item.id, query)
          || textMatches(item.sourceProjectName, query)
          || textMatches(item.sourceOwnerName, query)
          || textMatches(item.sourceOwnerEmail, query)
        )
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))

    const filteredAssets = assets.filter((asset) => {
      if (!query) return true
      return (
        textMatches(asset.name, query)
        || textMatches(asset.project?.name, query)
        || textMatches(asset.project?.user?.name, query)
        || textMatches(asset.project?.user?.email, query)
      )
    })

    const filteredApiSources = apiSources.filter((source) => {
      if (!query) return true
      return (
        textMatches(source.name, query)
        || textMatches(source.url, query)
        || textMatches(source.project?.name, query)
        || textMatches(source.project?.user?.name, query)
        || textMatches(source.project?.user?.email, query)
      )
    })

    const filteredDatabases = datasources
      .map((datasource) => ({
        datasourceId: datasource.id,
        projectId: datasource.projectId,
        projectName: datasource.project?.name ?? 'Unknown project',
        projectOwnerName: datasource.project?.user?.name ?? null,
        projectOwnerEmail: datasource.project?.user?.email ?? null,
        updatedAt: datasource.updatedAt,
        tableCount: datasource.tables.length,
        tables: datasource.tables.map((table) => ({
          id: table.id,
          name: table.name,
          columnCount: table._count.columns,
          rowCount: table._count.rows,
        })),
      }))
      .filter((db) => {
        if (!query) return true
          if (textMatches(db.projectName, query) || textMatches(db.projectOwnerName, query) || textMatches(db.projectOwnerEmail, query)) return true
        return db.tables.some((table) => textMatches(table.name, query))
      })

    return NextResponse.json({
      permissions: {
        canManageOrgResources: access.canManage,
        canViewDataResources,
      },
      rules,
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        slug: project.slug,
        owner: {
          userId: project.user?.id ?? null,
          name: project.user?.name ?? null,
          email: project.user?.email ?? null,
        },
      })),
      summary: {
        projectCount: projects.length,
        orgReusableCount: filteredOrgReusables.length,
        reusableReferenceCount: reusableUsage.reduce((sum, entry) => sum + entry.totalInstances, 0),
        assetCount: filteredAssets.length,
        apiSourceCount: filteredApiSources.length,
        datasourceCount: filteredDatabases.length,
        tableCount: filteredDatabases.reduce((sum, entry) => sum + entry.tableCount, 0),
      },
      reusables: {
        organization: filteredOrgReusables,
        usage: reusableUsage,
      },
      assets: filteredAssets.map((asset) => ({
        ...asset,
        projectOwnerName: asset.project?.user?.name ?? null,
        projectOwnerEmail: asset.project?.user?.email ?? null,
      })),
      apiSources: filteredApiSources.map((source) => ({
        ...source,
        projectOwnerName: source.project?.user?.name ?? null,
        projectOwnerEmail: source.project?.user?.email ?? null,
      })),
      databases: filteredDatabases,
    })
  } catch (error) {
    const resolvedParams = await Promise.resolve(params)
    await logAuditEvent({
      action: 'org.resource_catalog.read',
      status: 'failure',
      actorUserId: null,
      organizationId: resolvedParams.id,
      targetType: 'organization',
      targetId: resolvedParams.id,
      reason: error instanceof Error ? error.message : 'unknown_error',
      request,
    })
    console.error('[org resource catalog GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const access = await getAccess(request, params)
    if (access instanceof NextResponse) return access

    if (!access.canManage) {
      await logAuditEvent({
        action: 'org.resource_catalog.rules.update',
        status: 'denied',
        actorUserId: access.actorUserId,
        organizationId: access.organizationId,
        targetType: 'organization',
        targetId: access.organizationId,
        reason: 'insufficient_permissions',
        request,
      })
      return NextResponse.json({ error: 'Insufficient permissions to update resource sharing rules' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({})) as { memberDataSharingEnabled?: unknown }
    if (typeof body.memberDataSharingEnabled !== 'boolean') {
      return NextResponse.json({ error: 'memberDataSharingEnabled must be a boolean' }, { status: 400 })
    }

    const nextRules: ResourceCatalogRules = {
      memberDataSharingEnabled: body.memberDataSharingEnabled,
    }
    const nextMetadata = withResourceCatalogRules(access.organizationMetadata, nextRules)
    await prisma.organization.update({
      where: { id: access.organizationId },
      data: { metadata: nextMetadata as any },
    })

    await logAuditEvent({
      action: 'org.resource_catalog.rules.update',
      status: 'success',
      actorUserId: access.actorUserId,
      organizationId: access.organizationId,
      targetType: 'organization',
      targetId: access.organizationId,
      metadata: nextRules,
      request,
    })

    return NextResponse.json({ ok: true, rules: nextRules })
  } catch (error) {
    const resolvedParams = await Promise.resolve(params)
    await logAuditEvent({
      action: 'org.resource_catalog.rules.update',
      status: 'failure',
      actorUserId: null,
      organizationId: resolvedParams.id,
      targetType: 'organization',
      targetId: resolvedParams.id,
      reason: error instanceof Error ? error.message : 'unknown_error',
      request,
    })
    console.error('[org resource catalog PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
