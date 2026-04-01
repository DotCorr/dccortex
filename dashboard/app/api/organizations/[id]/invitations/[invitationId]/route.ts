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

    return NextResponse.json({ success: true, message: 'Invitation deleted successfully' })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete invitation', message: error.message },
      { status: 500 }
    )
  }
}

