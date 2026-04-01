/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Projects API endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, hasPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/audit'
import { z } from 'zod'

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  organizationId: z.string().optional(),
})

function toBaseSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return slug || 'project'
}

async function generateUniqueProjectSlug(userId: string, name: string): Promise<string> {
  const base = toBaseSlug(name)
  let candidate = base
  let i = 2

  while (true) {
    const existing = await prisma.project.findUnique({
      where: {
        userId_slug: {
          userId,
          slug: candidate,
        },
      },
      select: { id: true },
    })

    if (!existing) return candidate
    candidate = `${base}-${i}`
    i++
  }
}

// GET /api/projects - List user's projects
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organizationId')

    if (organizationId) {
      const canView = await hasPermission(organizationId, 'app.view', session)
      if (!canView) {
        return NextResponse.json(
          { error: 'You do not have permission to view apps in this organization' },
          { status: 403 }
        )
      }
    }

    const whereClause = organizationId
      ? { organizationId }
      : { userId: session.user.id }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return NextResponse.json({ projects })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch projects', message: error.message },
      { status: 500 }
    )
  }
}

// POST /api/projects - Create project
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, organizationId } = createProjectSchema.parse(body)

    const slug = await generateUniqueProjectSlug(session.user.id, name)

    // If organizationId provided, verify user has app.edit permission
    if (organizationId) {
      const canEdit = await hasPermission(organizationId, PERMISSIONS.APP_EDIT, session)
      if (!canEdit) {
        await logAuditEvent({
          action: 'project.create',
          status: 'denied',
          actorUserId: session.user.id,
          organizationId,
          targetType: 'project',
          reason: 'insufficient_permissions',
          metadata: {
            requestedName: name,
          },
          request: req,
        })
        return NextResponse.json(
          { error: 'Insufficient permissions to create project in this organization' },
          { status: 403 }
        )
      }
    }

    // Create project
    const project = await prisma.project.create({
      data: {
        name,
        slug,
        description,
        userId: session.user.id,
        organizationId: organizationId || null,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    await logAuditEvent({
      action: 'project.create',
      status: 'success',
      actorUserId: session.user.id,
      organizationId: project.organizationId,
      projectId: project.id,
      targetType: 'project',
      targetId: project.id,
      metadata: {
        projectName: project.name,
        slug: project.slug,
      },
      request: req,
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error: unknown) {
    console.error('[Projects API] Error creating project:', error)
    const message = error instanceof Error ? error.message : 'unknown_error'
    await logAuditEvent({
      action: 'project.create',
      status: 'failure',
      actorUserId: null,
      targetType: 'project',
      reason: message,
      request: req,
    })
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create project', message },
      { status: 500 }
    )
  }
}
