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
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    // Check if requester is owner or admin
    const requesterMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: session.user.id,
        },
      },
    })

    if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
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
      return NextResponse.json(
        { error: 'Cannot remove the organization owner' },
        { status: 400 }
      )
    }

    // Prevent removing yourself (unless you're the owner)
    if (member.userId === session.user.id && requesterMembership.role !== 'owner') {
      return NextResponse.json(
        { error: 'You cannot remove yourself' },
        { status: 400 }
      )
    }

    // Remove member
    await prisma.organizationMember.delete({
      where: { id: memberId },
    })

    return NextResponse.json({ success: true, message: 'Member removed successfully' })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to remove member', message: error.message },
      { status: 500 }
    )
  }
}

