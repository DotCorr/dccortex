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
import { authOptions, hasPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/audit'
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

    const canManage = await hasPermission(organizationId, PERMISSIONS.ORG_MANAGE, session)
    if (!canManage) {
      await logAuditEvent({
        action: 'org.member.role.update',
        status: 'denied',
        actorUserId: session.user.id,
        organizationId,
        targetType: 'organization_member',
        targetId: memberId,
        reason: 'insufficient_permissions',
        request: req,
      })
      return NextResponse.json(
        { error: 'Insufficient permissions to change member roles' },
        { status: 403 }
      )
    }

    // Load requester membership for owner-only safeguards
    const requesterMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: session.user.id,
        },
      },
    })

    if (!requesterMembership) {
      return NextResponse.json(
        { error: 'Insufficient permissions to change member roles' },
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

    if ((role === 'owner' || member.role === 'owner') && requesterMembership.role !== 'owner') {
      await logAuditEvent({
        action: 'org.member.role.update',
        status: 'denied',
        actorUserId: session.user.id,
        organizationId,
        targetType: 'organization_member',
        targetId: member.id,
        reason: 'owner_role_change_forbidden',
        request: req,
      })
      return NextResponse.json(
        { error: 'Only the owner can assign or change owner role' },
        { status: 403 }
      )
    }

    // Prevent changing owner role (owner can't demote themselves)
    if (member.role === 'owner' && member.userId === session.user.id) {
      await logAuditEvent({
        action: 'org.member.role.update',
        status: 'denied',
        actorUserId: session.user.id,
        organizationId,
        targetType: 'organization_member',
        targetId: member.id,
        reason: 'self_owner_demote_blocked',
        request: req,
      })
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

    await logAuditEvent({
      action: 'org.member.role.update',
      status: 'success',
      actorUserId: session.user.id,
      organizationId,
      targetType: 'organization_member',
      targetId: member.id,
      metadata: {
        previousRole: member.role,
        previousRoleId: member.roleId,
        nextRole: updated.role,
        nextRoleId: updated.roleId,
      },
      request: req,
    })

    return NextResponse.json({ member: updated })
  } catch (error: unknown) {
    const resolvedParams = await Promise.resolve(params)
    const message = error instanceof Error ? error.message : 'unknown_error'
    await logAuditEvent({
      action: 'org.member.role.update',
      status: 'failure',
      actorUserId: null,
      organizationId: resolvedParams.id,
      targetType: 'organization_member',
      targetId: resolvedParams.memberId,
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
      { error: 'Failed to update role', message },
      { status: 500 }
    )
  }
}

