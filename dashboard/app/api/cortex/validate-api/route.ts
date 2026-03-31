/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * POST /api/cortex/validate-api (internal use by Cortex chat)
 * 
 * Test an external API source in real-time and return:
 * - HTTP status code
 * - Response schema (inferred from sample response)
 * - First 3 sample records (if array)
 * - Error details (if fails)
 * - Execution time
 * 
 * This gives Cortex AI transparency into API behavior before generating screens.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { validateApiSource } from '@/lib/cortex/api-validator'

interface ValidateApiRequest {
  projectId: string
  sourceId: string
  urlOverride?: string
  limit?: number
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ValidateApiRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { projectId, sourceId, urlOverride } = body

  if (!projectId || !sourceId) {
    return NextResponse.json({ error: 'projectId and sourceId required' }, { status: 400 })
  }

  try {
    const result = await validateApiSource({
      projectId,
      sourceId,
      urlOverride,
      limit: body.limit ?? 3,
    })
    return NextResponse.json(result)
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        status: 0,
        elapsed: '—',
      },
      { status: 200 } // Return 200 even on error so client can see details
    )
  }
}
