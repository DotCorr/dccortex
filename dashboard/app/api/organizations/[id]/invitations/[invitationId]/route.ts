/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Delete invitation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, hasPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/audit'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> | { id: string; invitationId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve params (Next.js 15 compatibility)
    const resolvedParams = await Promise.resolve(params)
    const organizationId = resolvedParams.id
    const invitationId = resolvedParams.invitationId

    const canManage = await hasPermission(organizationId, PERMISSIONS.ORG_MANAGE, session)
    if (!canManage) {
      await logAuditEvent({
        action: 'org.invitation.delete',
        status: 'denied',
        actorUserId: session.user.id,
        organizationId,
        targetType: 'invitation',
        targetId: invitationId,
        reason: 'insufficient_permissions',
        request: req,
      })
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Find and delete invitation
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    })

    if (!invitation || invitation.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    await prisma.invitation.delete({
      where: { id: invitationId },
    })

    await logAuditEvent({
      action: 'org.invitation.delete',
      status: 'success',
      actorUserId: session.user.id,
      organizationId,
      targetType: 'invitation',
      targetId: invitation.id,
      metadata: {
        invitedEmail: invitation.email,
      },
      request: req,
    })

    return NextResponse.json({ success: true, message: 'Invitation deleted successfully' })
  } catch (error: unknown) {
    const resolvedParams = await Promise.resolve(params)
    const message = error instanceof Error ? error.message : 'unknown_error'
    await logAuditEvent({
      action: 'org.invitation.delete',
      status: 'failure',
      actorUserId: null,
      organizationId: resolvedParams.id,
      targetType: 'invitation',
      targetId: resolvedParams.invitationId,
      reason: message,
      request: req,
    })
    return NextResponse.json(
      { error: 'Failed to delete invitation', message },
      { status: 500 }
    )
  }
}

