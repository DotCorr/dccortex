/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'
import { corsJson, withCors } from '@/lib/cors'

export async function OPTIONS(req: NextRequest) {
  const res = new Response(null, { status: 204 })
  return withCors(res, req.headers.get('origin'))
}

const DEFAULT_ROOT = { id: 'root', type: 'container', props: {}, children: [] }

function parsePayload(layout: unknown): Record<string, unknown> {
  if (!layout || typeof layout !== 'object') {
    return { root: DEFAULT_ROOT, stateDefinitions: [], dataSources: [], namedScripts: {} }
  }
  const l = layout as Record<string, unknown>
  // Full ScreenLayoutPayload — has a 'root' key that is a Node
  if (l.root && typeof l.root === 'object' && (l.root as Record<string, unknown>).id) {
    return {
      root: l.root,
      stateDefinitions: Array.isArray(l.stateDefinitions) ? l.stateDefinitions : [],
      dataSources: Array.isArray(l.dataSources) ? l.dataSources : [],
      namedScripts: l.namedScripts && typeof l.namedScripts === 'object' ? l.namedScripts : {},
      theme: l.theme,
      presentation: l.presentation,
      seoSettings: l.seoSettings,
      screenPropDefs: l.screenPropDefs,
      customTypes: l.customTypes,
      aiProtected: l.aiProtected,
    }
  }
  // Legacy format — layout IS the root Node
  if (l.id && l.type) {
    return { root: l, stateDefinitions: [], dataSources: [], namedScripts: {} }
  }
  return { root: DEFAULT_ROOT, stateDefinitions: [], dataSources: [], namedScripts: {} }
}

export async function GET(req: NextRequest, context: any) {
  try {
    const { id: projectId, screenId } = await Promise.resolve(context.params)
    if (!projectId || !screenId) return corsJson(req, { error: 'Project ID and screen ID required' }, 400)

    const access = await requireProjectDataAccess(projectId, false)
    if (!access.ok) return corsJson(req, { error: access.error }, access.status)

    const client = prisma as any
    let layout: unknown

    if (client.appScreen?.findFirst) {
      const screen = await client.appScreen.findFirst({ where: { id: screenId, projectId } })
      if (!screen) return corsJson(req, { error: 'Screen not found' }, 404)
      layout = screen.layout
    } else {
      const rows = await prisma.$queryRaw<{ layout: unknown }[]>(
        Prisma.sql`SELECT layout FROM app_screens WHERE id = ${screenId} AND project_id = ${projectId} LIMIT 1`
      )
      if (!rows[0]) return corsJson(req, { error: 'Screen not found' }, 404)
      layout = rows[0].layout
    }

    return corsJson(req, parsePayload(layout))
  } catch (err) {
    console.error('[edit-payload GET]', err)
    return corsJson(req, { error: err instanceof Error ? err.message : 'Failed to load screen payload' }, 500)
  }
}
