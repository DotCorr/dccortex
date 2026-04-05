/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Organizations API endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { z } from 'zod'
import axios from 'axios'

const createOrgSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

// GET /api/organizations - List user's organizations
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if session exists
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Check if user exists
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Ensure user.id is set - if not, try to fetch from database
    let userId = session.user.id
    if (!userId && session.user.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
      })
      if (!dbUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = dbUser.id
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizations = await prisma.organization.findMany({
      where: {
        members: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            projects: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const platformApiUrl = process.env.PLATFORM_API_URL || 'http://localhost:3001'
    let containerMap = new Map<string, any>()
    try {
      const { data } = await axios.get(`${platformApiUrl}/api/v1/apps/containers`, { timeout: 2000 })
      const records = Array.isArray(data?.containers) ? data.containers : []
      containerMap = new Map(records.map((record: any) => [record.orgId, record]))
    } catch {
      containerMap = new Map()
    }

    const organizationsWithContainerState = organizations.map((org) => {
      const liveContainer = containerMap.get(org.id)
      if (!liveContainer) return org
      return {
        ...org,
        metadata: {
          ...((org.metadata as Record<string, unknown> | null) ?? {}),
          containerStatus: liveContainer.status,
          containerBackend: liveContainer.backend,
          containerProvisionedAt: liveContainer.provisionedAt,
          containerRequestedAt: liveContainer.requestedAt,
          containerLastError: liveContainer.lastError,
        },
      }
    })

    return NextResponse.json({ organizations: organizationsWithContainerState })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch organizations', message: error.message },
      { status: 500 }
    )
  }
}

// POST /api/organizations - Create organization
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if session exists
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized - No session' }, { status: 401 })
    }
    
    // Check if user exists
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized - No user in session' }, { status: 401 })
    }
    
    // Ensure user.id is set - if not, try to fetch from database
    let userId = session.user.id
    if (!userId && session.user.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
      })
      if (!dbUser) {
        return NextResponse.json({ error: 'Unauthorized - User not found' }, { status: 401 })
      }
      userId = dbUser.id
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized - No user ID' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description } = createOrgSchema.parse(body)

    // Generate slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // Check if slug exists
    const existing = await prisma.organization.findUnique({
      where: { slug },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Organization name already taken' },
        { status: 400 }
      )
    }

    const nowIso = new Date().toISOString()

    // Create organization and mark provisioning as pending.
    // The platform registry is async, so org creation should stay fast and not block on it.
    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        description,
        ownerId: userId,
        metadata: {
          containerStatus: 'provisioning',
          containerRequestedAt: nowIso,
        },
        members: {
          create: {
            userId: userId,
            role: 'owner',
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    const platformApiUrl = process.env.PLATFORM_API_URL || 'http://localhost:3001'

    void axios.post(
      `${platformApiUrl}/api/v1/apps/organizations/${organization.id}/container`,
      { environment: 'development' },
      {
        timeout: 300000,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    ).then(async () => {
      const currentMetadata = (organization.metadata as Record<string, unknown> | null) ?? {}
      await prisma.organization.update({
        where: { id: organization.id },
        data: {
          metadata: {
            ...currentMetadata,
            containerStatus: 'provisioned',
            containerProvisionedAt: new Date().toISOString(),
          },
        },
      })
    }).catch((err: any) => {
      console.warn('[Organizations API] Container provisioning is best-effort:', err?.message || err)
    })

    await logAuditEvent({
      action: 'organization.create',
      status: 'success',
      actorUserId: userId,
      organizationId: organization.id,
      targetType: 'organization',
      targetId: organization.id,
      metadata: {
        organizationName: organization.name,
        containerStatus: 'provisioning',
      },
      request: req,
    })

    return NextResponse.json({
      organization: {
        ...organization,
        metadata: {
          ...((organization.metadata as Record<string, unknown> | null) ?? {}),
          containerStatus: 'provisioning',
          containerRequestedAt: nowIso,
        },
      },
    }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    // Check if it's a foreign key constraint error (user doesn't exist)
    if (error.message?.includes('Foreign key constraint') || error.code === 'P2003') {
      return NextResponse.json(
        { error: 'User not found. Please log out and register again.', message: error.message },
        { status: 401 }
      )
    }

    await logAuditEvent({
      action: 'organization.create',
      status: 'failure',
      actorUserId: null,
      targetType: 'organization',
      reason: error?.message || 'unknown_error',
      request: req,
    })

    return NextResponse.json(
      { error: 'Failed to create organization', message: error.message },
      { status: 500 }
    )
  }
}

