/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Invite members to organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, hasPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/audit'
import { sendInvitationEmail } from '@/lib/email'
import { z } from 'zod'
import { randomBytes } from 'crypto'

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
})

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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = params.id

    const canManage = await hasPermission(organizationId, PERMISSIONS.ORG_MANAGE, session)
    if (!canManage) {
      await logAuditEvent({
        action: 'org.invitation.create',
        status: 'denied',
        actorUserId: session.user.id,
        organizationId,
        targetType: 'invitation',
        reason: 'insufficient_permissions',
        request: req,
      })
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { email, role } = inviteSchema.parse(body)
    const normalizedEmail = email.trim().toLowerCase()

    // Check if user already member
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: {
        organizations: {
          where: {
            organizationId,
          },
        },
      },
    })

    if (existingUser?.organizations.length) {
      return NextResponse.json(
        { error: 'User is already a member' },
        { status: 400 }
      )
    }

    // Create invitation
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        email: normalizedEmail,
        organizationId,
        role,
        token,
        expiresAt,
      },
      include: {
        organization: {
          select: {
            name: true,
          },
        },
      },
    })

    // Send invitation email
    const invitationLink = `${getBaseUrl(req)}/invitations/${token}`
    const emailResult = await sendInvitationEmail(
      normalizedEmail,
      invitation.organization.name,
      invitationLink
    )
    const messageId =
      typeof emailResult === 'object' &&
      emailResult !== null &&
      'messageId' in emailResult
        ? String((emailResult as { messageId?: unknown }).messageId ?? '')
        : null

    console.log('[Invite API] Invitation email sent', {
      to: normalizedEmail,
      organizationId,
      invitationId: invitation.id,
      messageId,
    })

    await logAuditEvent({
      action: 'org.invitation.create',
      status: 'success',
      actorUserId: session.user.id,
      organizationId,
      targetType: 'invitation',
      targetId: invitation.id,
      metadata: {
        invitedEmail: normalizedEmail,
        role,
        expiresAt: invitation.expiresAt.toISOString(),
      },
      request: req,
    })

    return NextResponse.json({ invitation }, { status: 201 })
  } catch (error: unknown) {
    console.error('[Invite API] Failed to send invitation:', error)
    const organizationId = params?.id
    const message = error instanceof Error ? error.message : 'unknown_error'
    await logAuditEvent({
      action: 'org.invitation.create',
      status: 'failure',
      actorUserId: null,
      organizationId,
      targetType: 'invitation',
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
      { error: 'Failed to send invitation', message },
      { status: 500 }
    )
  }
}

