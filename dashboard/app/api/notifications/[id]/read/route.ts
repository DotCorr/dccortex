/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Mark notification as read
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: NextRequest,
  context: any
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: context.params.id,
        userId: session.user.id,
      },
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    const updated = await prisma.notification.update({
      where: { id: context.params.id },
      data: { isRead: true },
    })

    return NextResponse.json({ notification: updated })
  } catch (error: any) {
    console.error('[Notifications API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to mark notification as read', message: error.message },
      { status: 500 }
    )
  }
}

