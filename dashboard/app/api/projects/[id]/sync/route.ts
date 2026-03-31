/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listPresence, subscribeProjectSync } from '@/lib/projects/live-sync'

type Params = Promise<{ id: string }> | { id: string }

async function getAuthorisedProjectId(params: Params): Promise<{ projectId: string } | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await Promise.resolve(params)
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId },
        { organization: { members: { some: { userId } } } },
      ],
    },
    select: { id: true },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return { projectId: project.id }
}

function toSseData(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const auth = await getAuthorisedProjectId(params)
    if (auth instanceof NextResponse) return auth

    const { projectId } = auth
    let heartbeat: ReturnType<typeof setInterval> | null = null
    let unsubscribe: (() => void) | null = null

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()

        controller.enqueue(encoder.encode(': connected\n\n'))
        controller.enqueue(encoder.encode(toSseData({
          type: 'presence',
          projectId,
          payload: listPresence(projectId),
          at: Date.now(),
        })))

        unsubscribe = subscribeProjectSync(projectId, (event) => {
          controller.enqueue(encoder.encode(toSseData(event)))
        })

        heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        }, 20_000)

      },
      cancel() {
        if (unsubscribe) {
          unsubscribe()
          unsubscribe = null
        }
        if (heartbeat) {
          clearInterval(heartbeat)
          heartbeat = null
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[sync GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
