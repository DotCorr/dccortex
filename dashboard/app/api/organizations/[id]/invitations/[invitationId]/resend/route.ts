/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Resend invitation email
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, hasPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { sendInvitationEmail } from '@/lib/email'

function getBaseUrl(req: NextRequest): string {
  const forwardedProto = req.headers.get('x-forwarded-proto')
  const forwardedHost = req.headers.get('x-forwarded-host')
  const host = forwardedHost || req.headers.get('host')

  if (host) {
    const isLocalHost = host.includes('localhost') || host.startsWith('127.0.0.1')
    const protocol = forwardedProto || (isLocalHost ? 'http' : 'https')
    return `${protocol}://${host}`
  }

  return process.env.NEXTAUTH_URL || 'http://localhost:3000'
}

export async function POST(
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

    // Find invitation
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!invitation || invitation.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: 'Invitation has already been accepted' },
        { status: 400 }
      )
    }

    // Check if expired
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      )
    }

    // Resend email
    const invitationLink = `${getBaseUrl(req)}/invitations/${invitation.token}`
    const normalizedEmail = invitation.email.trim().toLowerCase()
    
    try {
      await sendInvitationEmail(
        normalizedEmail,
        invitation.organization.name,
        invitationLink
      )
    } catch (emailError: any) {
      // Log email error but don't fail the request
      console.error('[Resend Invitation] Email error:', emailError.message)
      // Still return success - invitation exists and is valid, email might have issues
      return NextResponse.json({ 
        success: true, 
        message: 'Invitation link is valid. Email may not have been sent due to SMTP configuration.',
        warning: emailError.message 
      })
    }

    return NextResponse.json({ success: true, message: 'Invitation resent successfully' })
  } catch (error: any) {
    console.error('[Resend Invitation] Error:', error)
    return NextResponse.json(
      { error: 'Failed to resend invitation', message: error.message },
      { status: 500 }
    )
  }
}

