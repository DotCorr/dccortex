/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'
import { createHmac } from 'crypto'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; whId: string }> | { id: string; whId: string } }
) {
  const { id: projectId, whId } = await Promise.resolve(params)
  const access = await requireProjectDataAccess(projectId, true)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const webhook = await prisma.projectWebhook.findFirst({ where: { id: whId, projectId } })
  if (!webhook) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })

  const payload = {
    event: 'webhook.test',
    projectId,
    timestamp: new Date().toISOString(),
    data: { message: 'This is a test payload from DCCortex' },
  }
  const body = JSON.stringify(payload)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-DCCortex-Event': 'webhook.test',
    'X-DCCortex-Timestamp': payload.timestamp,
  }
  if (webhook.secret) {
    const sig = createHmac('sha256', webhook.secret).update(body).digest('hex')
    headers['X-DCCortex-Signature'] = `sha256=${sig}`
  }

  try {
    const res = await fetch(webhook.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) })
    return NextResponse.json({ ok: true, status: res.status, statusText: res.statusText })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 })
  }
}
