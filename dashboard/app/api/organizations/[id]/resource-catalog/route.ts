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

  const allowed = await hasPermission(organizationId, PERMISSIONS.ORG_MANAGE, session)
  if (!allowed) {
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

  return {
    organizationId,
    actorUserId: session.user.id,
    organizationMetadata: organization.metadata,
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

    const projects = await prisma.project.findMany({
      where: { organizationId: access.organizationId },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    })

    const allowedProjectIds = new Set(projects.map((project) => project.id))
    const scopedProjectIds = selectedProjectId && allowedProjectIds.has(selectedProjectId)
      ? [selectedProjectId]
      : projects.map((project) => project.id)

    const [assets, apiSources, datasources, screens] = await Promise.all([
      prisma.projectAsset.findMany({
        where: { projectId: { in: scopedProjectIds } },
        select: {
          id: true,
          name: true,
          mimetype: true,
          size: true,
          url: true,
          createdAt: true,
          projectId: true,
          project: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.externalApiSource.findMany({
        where: { projectId: { in: scopedProjectIds } },
        select: {
          id: true,
          name: true,
          method: true,
          url: true,
          authType: true,
          updatedAt: true,
          projectId: true,
          project: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.internalDatasource.findMany({
        where: { projectId: { in: scopedProjectIds } },
        select: {
          id: true,
          projectId: true,
          project: { select: { name: true } },
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
      }),
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
    const reusableNameById = new Map(orgReusables.map((item) => [item.id, item.name]))
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

    const filteredOrgReusables = orgReusables
      .filter((item) => {
        if (!query) return true
        return textMatches(item.name, query) || textMatches(item.id, query)
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))

    const filteredAssets = assets.filter((asset) => {
      if (!query) return true
      return textMatches(asset.name, query) || textMatches(asset.project?.name, query)
    })

    const filteredApiSources = apiSources.filter((source) => {
      if (!query) return true
      return textMatches(source.name, query) || textMatches(source.url, query) || textMatches(source.project?.name, query)
    })

    const filteredDatabases = datasources
      .map((datasource) => ({
        datasourceId: datasource.id,
        projectId: datasource.projectId,
        projectName: datasource.project?.name ?? 'Unknown project',
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
        if (textMatches(db.projectName, query)) return true
        return db.tables.some((table) => textMatches(table.name, query))
      })

    return NextResponse.json({
      projects,
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
      assets: filteredAssets,
      apiSources: filteredApiSources,
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
