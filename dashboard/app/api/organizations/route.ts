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

    return NextResponse.json({ organizations })
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

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        description,
        ownerId: userId,
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

    // Create organization container immediately (BLOCKING - container is required for projects)
    // Projects are physical folders in the container, so we MUST have the container first
    const platformApiUrl = process.env.PLATFORM_API_URL || 'http://localhost:3001'
    
    try {
      const containerResponse = await axios.post(
        `${platformApiUrl}/api/v1/apps/organizations/${organization.id}/container`,
        { environment: 'development' },
        { 
          timeout: 300000, // 5 minute timeout (Docker build can take 1-2 minutes on first build)
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    } catch (err: any) {
      // Container creation is REQUIRED - fail org creation if it fails
      // Rollback: Delete the organization we just created
      try {
        await prisma.organization.delete({
          where: { id: organization.id }
        })
      } catch (rollbackError) {
        // Silent error handling
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to create organization container. Please try again.',
          details: err.response?.data?.error || err.message
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ organization }, { status: 201 })
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

    return NextResponse.json(
      { error: 'Failed to create organization', message: error.message },
      { status: 500 }
    )
  }
}

