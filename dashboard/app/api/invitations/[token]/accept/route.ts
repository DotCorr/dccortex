/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Accept organization invitation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = params.token

    // Find invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      )
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: 'Invitation has already been accepted' },
        { status: 400 }
      )
    }

    // Check if user email matches invitation email
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const invitedEmail = invitation.email.trim().toLowerCase()
    const currentUserEmail = (user.email || '').trim().toLowerCase()

    // Require email to match invitation email (security: invitation is for specific email)
    if (currentUserEmail !== invitedEmail) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address. Please sign in with the invited email address.' },
        { status: 403 }
      )
    }

    // Check if user is already a member
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: session.user.id,
        },
      },
    })

    if (existingMember) {
      // Mark invitation as accepted even if already member
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      })

      return NextResponse.json({
        success: true,
        organizationId: invitation.organization.id,
        organizationName: invitation.organization.name,
        message: 'You are already a member of this organization',
      })
    }

    // Create organization member
    await prisma.organizationMember.create({
      data: {
        organizationId: invitation.organizationId,
        userId: session.user.id,
        role: invitation.role,
      },
    })

    // Mark invitation as accepted
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      organizationId: invitation.organization.id,
      organizationName: invitation.organization.name,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to accept invitation', message: error.message },
      { status: 500 }
    )
  }
}

