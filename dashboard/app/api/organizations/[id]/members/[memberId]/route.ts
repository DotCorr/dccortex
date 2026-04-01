/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Remove member from organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, hasPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/audit'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> | { id: string; memberId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve params (Next.js 15 compatibility)
    const resolvedParams = await Promise.resolve(params)
    const organizationId = resolvedParams.id
    const memberId = resolvedParams.memberId

    const canManage = await hasPermission(organizationId, PERMISSIONS.ORG_MANAGE, session)
    if (!canManage) {
      await logAuditEvent({
        action: 'org.member.remove',
        status: 'denied',
        actorUserId: session.user.id,
        organizationId,
        targetType: 'organization_member',
        targetId: memberId,
        reason: 'insufficient_permissions',
        request: req,
      })
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Check if requester exists as a member for owner-specific guardrails
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
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get the member to remove
    const member = await prisma.organizationMember.findUnique({
      where: { id: memberId },
    })

    if (!member || member.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Prevent removing owner
    if (member.role === 'owner') {
      await logAuditEvent({
        action: 'org.member.remove',
        status: 'denied',
        actorUserId: session.user.id,
        organizationId,
        targetType: 'organization_member',
        targetId: member.id,
        reason: 'owner_protected',
        request: req,
      })
      return NextResponse.json(
        { error: 'Cannot remove the organization owner' },
        { status: 400 }
      )
    }

    // Prevent removing yourself (unless you're the owner)
    if (member.userId === session.user.id && requesterMembership.role !== 'owner') {
      await logAuditEvent({
        action: 'org.member.remove',
        status: 'denied',
        actorUserId: session.user.id,
        organizationId,
        targetType: 'organization_member',
        targetId: member.id,
        reason: 'self_removal_blocked',
        request: req,
      })
      return NextResponse.json(
        { error: 'You cannot remove yourself' },
        { status: 400 }
      )
    }

    // Remove member
    await prisma.organizationMember.delete({
      where: { id: memberId },
    })

    await logAuditEvent({
      action: 'org.member.remove',
      status: 'success',
      actorUserId: session.user.id,
      organizationId,
      targetType: 'organization_member',
      targetId: member.id,
      metadata: {
        removedUserId: member.userId,
        removedRole: member.role,
      },
      request: req,
    })

    return NextResponse.json({ success: true, message: 'Member removed successfully' })
  } catch (error: unknown) {
    const resolvedParams = await Promise.resolve(params)
    const message = error instanceof Error ? error.message : 'unknown_error'
    await logAuditEvent({
      action: 'org.member.remove',
      status: 'failure',
      actorUserId: null,
      organizationId: resolvedParams.id,
      targetType: 'organization_member',
      targetId: resolvedParams.memberId,
      reason: message,
      request: req,
    })
    return NextResponse.json(
      { error: 'Failed to remove member', message },
      { status: 500 }
    )
  }
}

