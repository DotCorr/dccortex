/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'

/**
 * Server-Sent Events endpoint for real-time DB data streaming.
 * GET /api/projects/[id]/runtime-data/stream?pollMs=2000
 *
 * The server polls the DB at the configured interval and pushes row snapshots
 * to the client over a single persistent SSE connection — no repeated HTTP
 * requests from the browser, no WebSocket infrastructure needed.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id: projectId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, false)
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error }), {
      status: access.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const pollMs = Math.max(500, Math.min(30000, Number(req.nextUrl.searchParams.get('pollMs') || '2000')))

  // Build the initial snapshot
  async function fetchSnapshot(): Promise<Record<string, unknown>> {
    const datasources = await prisma.internalDatasource.findMany({
      where: { projectId },
      include: { tables: { include: { columns: true } } },
    })
    const result: Record<string, unknown> = {}
    for (const ds of datasources) {
      for (const table of ds.tables) {
        const rows = await prisma.internalRow.findMany({
          where: { tableId: table.id },
          orderBy: { createdAt: 'asc' },
          take: 500,
        })
        result[table.name] = rows.map((r) => ({
          id: r.id,
          ...(r.data as Record<string, unknown>),
          created_at: r.createdAt,
        }))
      }
    }
    return result
  }

  const encoder = new TextEncoder()
  let lastJson = ''
  let timer: ReturnType<typeof setTimeout> | null = null
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      async function sendSnapshot() {
        if (closed) return
        try {
          const snapshot = await fetchSnapshot()
          const json = JSON.stringify(snapshot)
          // Only push if data has changed (deduplicate)
          if (json !== lastJson) {
            lastJson = json
            controller.enqueue(encoder.encode(`data: ${json}\n\n`))
          }
        } catch (err) {
          // If DB is gone or project deleted, close gracefully
          if (!closed) {
            closed = true
            try { controller.close() } catch {}
          }
          return
        }
        if (!closed) {
          timer = setTimeout(sendSnapshot, pollMs)
        }
      }

      // Send initial snapshot immediately
      await sendSnapshot()
    },
    cancel() {
      closed = true
      if (timer) clearTimeout(timer)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  })
}
