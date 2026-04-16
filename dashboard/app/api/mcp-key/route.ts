/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createHmac } from 'crypto'

// Key generation matches DCFlow exactly — same NEXTAUTH_SECRET, same algo.
function generateMcpKey(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || 'dcflow-dev-secret'
  return createHmac('sha256', secret).update(`mcp-user:${userId}`).digest('hex').slice(0, 32)
}

function makeApiKey(userId: string): string {
  return `${userId}:${generateMcpKey(userId)}`
}

// GET /api/mcp-key — returns the DCFlow MCP key + config for the current user
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = makeApiKey(session.user.id)

  // DCFlow is on port 3003 in dev, same host
  const host = req.headers.get('host') || 'localhost'
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  // Replace dashboard port (3000) with dcflow port (3003), or use DCFLOW_URL env
  const dcflowUrl = process.env.DCFLOW_PUBLIC_URL
    || `${proto}://${host.replace(/:3000$/, ':3003')}`

  const mcpUrl = `${dcflowUrl}/api/mcp?key=${key}`

  return NextResponse.json({
    key,
    mcpUrl,
    claudeDesktop: {
      mcpServers: {
        dcflow: {
          url: mcpUrl,
          transport: 'http',
        },
      },
    },
  })
}
