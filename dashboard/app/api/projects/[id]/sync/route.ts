/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireProjectDataAccess } from '@/lib/project-access'
import { listPresence, subscribeProjectSync } from '@/lib/projects/live-sync'

async function getAuthorisedProjectId(params: any): Promise<{ projectId: string } | NextResponse> {
  const { id: projectId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, false)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  return { projectId: access.project.id }
}

function toSseData(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const auth = await getAuthorisedProjectId(context.params)
    if (auth instanceof NextResponse) return auth

    const { projectId } = auth
    let messageId = 0
    let heartbeat: ReturnType<typeof setInterval> | null = null
    let unsubscribe: (() => void) | null = null
    let closed = false

    const cleanup = () => {
      if (closed) return
      closed = true
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      if (heartbeat) {
        clearInterval(heartbeat)
        heartbeat = null
      }
    }

    request.signal.addEventListener('abort', cleanup)

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        const send = (payload: unknown) => {
          messageId += 1
          controller.enqueue(encoder.encode(`id: ${messageId}\n`))
          controller.enqueue(encoder.encode(toSseData(payload)))
        }

        controller.enqueue(encoder.encode(': connected\n\n'))
        controller.enqueue(encoder.encode('retry: 5000\n\n'))
        send({
          type: 'presence',
          projectId,
          payload: listPresence(projectId),
          at: Date.now(),
        })

        unsubscribe = subscribeProjectSync(projectId, (event) => {
          if (closed) return
          send(event)
        })

        heartbeat = setInterval(() => {
          if (closed) return
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        }, 20_000)

      },
      cancel() {
        cleanup()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('[sync GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
