/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Cortex Threads API — GET/DELETE /api/cortex/threads
 * List conversation history, create new threads, delete threads.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = req.nextUrl.searchParams.get('organizationId')
  if (!orgId) {
    return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
  }

  const threads = await prisma.cortexThread.findMany({
    where: { userId: session.user.id, organizationId: orgId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      projectId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  })

  return NextResponse.json({ threads })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { threadId } = await req.json()
  if (!threadId) {
    return NextResponse.json({ error: 'threadId required' }, { status: 400 })
  }

  // Ensure user owns thread
  const thread = await prisma.cortexThread.findFirst({
    where: { id: threadId, userId: session.user.id },
  })
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  await prisma.cortexThread.delete({ where: { id: threadId } })
  return NextResponse.json({ deleted: true })
}
