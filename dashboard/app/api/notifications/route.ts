/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Notifications API endpoints
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { corsJson, withCors } from '@/lib/cors'

export async function OPTIONS(req: NextRequest) {
  const res = new Response(null, { status: 204 })
  return withCors(res, req.headers.get('origin'))
}

// GET /api/notifications - Get user's notifications
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return corsJson(req, { error: 'Unauthorized' }, 401)
    }

    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    return corsJson(req, { notifications })
  } catch (error: any) {
    console.error('[Notifications API] Error:', error)
    return corsJson(req, {
      error: 'Failed to fetch notifications',
      message: error.message,
    }, 500)
  }
}

// POST /api/notifications - Create notification (supports internal API key)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, type, title, message, metadata } = body

    const internalApiKey = req.headers.get('x-internal-api-key')
    const isInternal = internalApiKey === process.env.INTERNAL_API_KEY

    let targetUserId = userId

    if (!isInternal) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return corsJson(req, { error: 'Unauthorized' }, 401)
      }
      targetUserId = session.user.id
    }

    if (!targetUserId || !type || !title || !message) {
      return corsJson(req, {
        error: 'Missing required fields: userId, type, title, message',
      }, 400)
    }

    const notification = await prisma.notification.create({
      data: {
        userId: targetUserId,
        type,
        title,
        message,
        metadata: metadata || {},
        isRead: false,
      },
    })

    return corsJson(req, { notification }, 201)
  } catch (error: any) {
    console.error('[Notifications API] Error creating notification:', error)
    return corsJson(req, {
      error: 'Failed to create notification',
      message: error.message,
    }, 500)
  }
}

