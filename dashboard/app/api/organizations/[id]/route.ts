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
import { logAuditEvent } from '@/lib/audit'
import axios from 'axios'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve params (Next.js 15 compatibility)
    const resolvedParams = await Promise.resolve(params)

    // Step 1: check the org exists at all (gives proper 404 vs 403)
    const orgExists = await prisma.organization.findUnique({
      where: { id: resolvedParams.id },
      select: { id: true, ownerId: true },
    })
    if (!orgExists) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Step 2: check user has access (owner OR member), self-heal if owner lacks member row
    const isMember = await prisma.organizationMember.findFirst({
      where: { organizationId: resolvedParams.id, userId: session.user.id },
      select: { id: true },
    })
    const isOwner = orgExists.ownerId === session.user.id
    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'You do not have access to this organization' }, { status: 403 })
    }
    // Self-heal: owner has no member row (can happen after DB migration or rollback edge case)
    if (isOwner && !isMember) {
      await prisma.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: resolvedParams.id, userId: session.user.id } },
        create: { organizationId: resolvedParams.id, userId: session.user.id, role: 'owner' },
        update: {},
      })
    }

    // Step 3: fetch full data now that access is confirmed
    const organization = await prisma.organization.findUnique({
      where: { id: resolvedParams.id },
      include: {
        projects: {
          orderBy: {
            updatedAt: 'desc',
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
            roleRef: {
              select: {
                id: true,
                name: true,
                permissions: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        invitations: {
          where: {
            acceptedAt: null,
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            projects: true,
            members: true,
          },
        },
      },
    })

    const platformApiUrl = process.env.PLATFORM_API_URL || 'http://localhost:3001'
    let liveContainer: any = null
    try {
      const response = await axios.get(`${platformApiUrl}/api/v1/apps/organizations/${resolvedParams.id}/container`, { timeout: 2000 })
      liveContainer = response.data?.container ?? null
    } catch {
      liveContainer = null
    }

    const mergedOrganization = liveContainer
      ? {
          ...organization,
          metadata: {
            ...((organization?.metadata as Record<string, unknown> | null) ?? {}),
            containerStatus: liveContainer.status,
            containerBackend: liveContainer.backend,
            containerProvisionedAt: liveContainer.provisionedAt,
            containerRequestedAt: liveContainer.requestedAt,
            containerLastError: liveContainer.lastError,
          },
        }
      : organization

    return NextResponse.json({ organization: mergedOrganization })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/organizations/[id] - Delete organization and ALL related data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve params (Next.js 15 compatibility)
    const resolvedParams = await Promise.resolve(params)
    const organizationId = resolvedParams.id

    let body: any = {}
    try {
      body = await request.json()
    } catch (e) {
      // Body might be empty or invalid JSON
      console.warn('[Organizations API] Could not parse request body:', e)
    }
    const { verificationName } = body

    console.log(`[Organizations API] DELETE request for org: ${organizationId}, verification: ${verificationName}`)

    // Get organization and verify ownership
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        ownerId: session.user.id, // Only owner can delete
      },
      include: {
        projects: true,
      },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found or you are not the owner' }, { status: 404 })
    }

    // Verify organization name matches (trim whitespace)
    const trimmedVerification = verificationName?.trim() || ''
    const trimmedOrgName = organization.name.trim()
    
    if (!verificationName || trimmedVerification !== trimmedOrgName) {
      console.error(`[Organizations API] Verification failed: expected "${trimmedOrgName}", got "${trimmedVerification}"`)
      return NextResponse.json(
        { error: `Verification failed. Organization name does not match. Expected: "${trimmedOrgName}"` },
        { status: 400 }
      )
    }
    
    console.log(`[Organizations API] ✅ Verification passed, proceeding with deletion...`)

    // Step 1: Request container teardown for this organization workspace.
    const platformApiUrl = process.env.PLATFORM_API_URL || 'http://localhost:3001'
    try {
      await axios.delete(`${platformApiUrl}/api/v1/apps/organizations/${organization.id}/container`)
      console.log(`[Organizations API] ✅ Deleted container for organization: ${organization.id}`)
    } catch (error: any) {
      // Log but continue - container might not exist
      console.warn(`[Organizations API] Could not delete container (may not exist):`, error.message)
    }

    // Step 2: Delete all projects (cascades to builds, etc.)
    // Prisma will handle cascading deletes based on schema
    await prisma.project.deleteMany({
      where: {
        organizationId: organization.id,
      },
    })

    // Step 3: Delete all organization members
    await prisma.organizationMember.deleteMany({
      where: {
        organizationId: organization.id,
      },
    })

    // Step 4: Delete all invitations
    await prisma.invitation.deleteMany({
      where: {
        organizationId: organization.id,
      },
    })

    // Step 5: Delete the organization itself
    await prisma.organization.delete({
      where: {
        id: organization.id,
      },
    })

    console.log(`[Organizations API] ✅ Deleted organization and all related data: ${organization.id}`)
    console.log(`[Organizations API] Deleted ${organization.projects?.length || 0} projects`)

    await logAuditEvent({
      action: 'organization.delete',
      status: 'success',
      actorUserId: session.user.id,
      organizationId: organization.id,
      targetType: 'organization',
      targetId: organization.id,
      metadata: {
        organizationName: organization.name,
        deletedProjects: organization.projects?.length || 0,
      },
      request,
    })

    return NextResponse.json({ 
      success: true,
      message: 'Organization and all related data deleted successfully',
      deletedOrganizationId: organization.id
    })
  } catch (error: any) {
    console.error('[Organizations API] Error deleting organization:', error)
    await logAuditEvent({
      action: 'organization.delete',
      status: 'failure',
      actorUserId: null,
      targetType: 'organization',
      reason: error?.message || 'unknown_error',
      request,
    })
    return NextResponse.json(
      { error: 'Failed to delete organization', message: error.message },
      { status: 500 }
    )
  }
}

// PUT /api/organizations/[id] - Update organization
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve params (Next.js 15 compatibility)
    const resolvedParams = await Promise.resolve(params)
    const organizationId = resolvedParams.id

    const body = await request.json()
    const { name, description, metadata } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
    }

    // Get organization and verify ownership or membership
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        OR: [
          { ownerId: session.user.id },
          {
            members: {
              some: {
                userId: session.user.id,
              },
            },
          },
        ],
      },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Only owner can update organization
    if (organization.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Only the owner can update the organization' }, { status: 403 })
    }

    // Update organization
    const updateData: any = {
      name: name.trim(),
      description: description?.trim() || null,
    }
    
    // Update metadata if provided (merge with existing)
    if (metadata !== undefined) {
      const existing = organization as any
      updateData.metadata = {
        ...(existing.metadata || {}),
        ...metadata,
      }
    }

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: updateData,
    })

    console.log(`[Organizations API] ✅ Updated organization: ${organizationId}`)

    return NextResponse.json({ organization: updated })
  } catch (error: any) {
    console.error('[Organizations API] Error updating organization:', error)
    return NextResponse.json(
      { error: 'Failed to update organization', message: error.message },
      { status: 500 }
    )
  }
}

