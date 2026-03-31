/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Update member role (promote/demote)
 * Only owners can change roles
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']).optional(),
  roleId: z.string().uuid().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> | { id: string; memberId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await Promise.resolve(params)
    const organizationId = resolvedParams.id
    const memberId = resolvedParams.memberId

    // Check if requester is owner
    const requesterMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: session.user.id,
        },
      },
    })

    if (!requesterMembership || requesterMembership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the owner can change member roles' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { role, roleId } = updateRoleSchema.parse(body)

    // Get the member to update
    const member = await prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: {
        organization: true,
      },
    })

    if (!member || member.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Prevent changing owner role (owner can't demote themselves)
    if (member.role === 'owner' && member.userId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot change your own owner role' },
        { status: 400 }
      )
    }

    const updateData: { role?: string; roleId?: string | null } = {}
    if (roleId !== undefined) {
      const roleRecord = await prisma.role.findFirst({
        where: {
          id: roleId,
          OR: [
            { organizationId: null },
            { organizationId: organizationId },
          ],
        },
      })
      if (!roleRecord) {
        return NextResponse.json(
          { error: 'Role not found or not available for this organization' },
          { status: 400 }
        )
      }
      updateData.roleId = roleId
    }
    if (role !== undefined) {
      updateData.role = role
    }

    const updated = await prisma.organizationMember.update({
      where: { id: memberId },
      data: updateData,
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
    })

    return NextResponse.json({ member: updated })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update role', message: error.message },
      { status: 500 }
    )
  }
}

