/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * POST /api/projects/[id]/duplicate
 * Create a full copy of a project (screens, layout, script, scripts, internal database) for the current user.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getProjectForAccess } from '@/lib/project-access'

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id

    const { id: sourceProjectId } = await Promise.resolve(params)
    if (!sourceProjectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
    }

    const access = await getProjectForAccess(sourceProjectId)
    if (!access) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    const { project: source } = access

    const body = await req.json().catch(() => ({}))
    const newName = typeof body.name === 'string' && body.name.trim()
      ? body.name.trim()
      : `${source.name} (copy)`

    let slug = slugFromName(newName)
    const existing = await prisma.project.findUnique({
      where: {
        userId_slug: {
          userId,
          slug,
        },
      },
    })
    if (existing) {
      let suffix = 1
      while (true) {
        const candidate = `${slug}-${suffix}`
        const again = await prisma.project.findUnique({
          where: {
            userId_slug: {
              userId,
              slug: candidate,
            },
          },
        })
        if (!again) {
          slug = candidate
          break
        }
        suffix++
      }
    }

    const newProject = await prisma.project.create({
      data: {
        name: newName,
        slug,
        description: source.description ?? undefined,
        backendScript: source.backendScript ?? undefined,
        frontendScript: source.frontendScript ?? undefined,
        scriptsScript: source.scriptsScript ?? undefined,
        userId,
        organizationId: source.organizationId ?? undefined,
        status: 'draft',
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    })

    const screens = await prisma.appScreen.findMany({
      where: { projectId: sourceProjectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    for (const s of screens) {
      await prisma.appScreen.create({
        data: {
          projectId: newProject.id,
          name: s.name,
          slug: s.slug,
          layout: (s.layout ?? undefined) as import('@prisma/client').Prisma.InputJsonValue,
          script: s.script ?? undefined,
          sortOrder: s.sortOrder,
        },
      })
    }

    // Duplicate internal datasource (tables, columns, rows)
    const sourceDatasource = await prisma.internalDatasource.findUnique({
      where: { projectId: sourceProjectId },
      include: {
        tables: {
          include: {
            columns: { orderBy: { sortOrder: 'asc' } },
            rows: true,
          },
        },
      },
    })

    if (sourceDatasource) {
      const newDatasource = await prisma.internalDatasource.create({
        data: { projectId: newProject.id },
      })

      for (const table of sourceDatasource.tables) {
        const newTable = await prisma.internalTable.create({
          data: {
            datasourceId: newDatasource.id,
            name: table.name,
          },
        })

        // Copy columns
        for (const col of table.columns) {
          await prisma.internalColumn.create({
            data: {
              tableId: newTable.id,
              name: col.name,
              type: col.type,
              options: (col.options ?? undefined) as import('@prisma/client').Prisma.InputJsonValue,
              sortOrder: col.sortOrder,
            },
          })
        }

        // Copy rows
        for (const row of table.rows) {
          await prisma.internalRow.create({
            data: {
              tableId: newTable.id,
              data: row.data as import('@prisma/client').Prisma.InputJsonValue,
              createdBy: userId,
            },
          })
        }
      }
    }

    return NextResponse.json({ project: newProject }, { status: 201 })
  } catch (error: any) {
    console.error('[Projects API] duplicate error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to duplicate project' },
      { status: 500 }
    )
  }
}
