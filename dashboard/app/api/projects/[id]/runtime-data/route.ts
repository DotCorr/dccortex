/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProjectDataAccess } from '@/lib/project-access'

function resolveEnvPlaceholders(input: string): string {
  return input.replace(/\{\{env\.([A-Za-z0-9_]+)\}\}/g, (_m, key: string) => process.env[key] ?? '')
}

/**
 * Authenticated runtime-data endpoint for the editor preview panel.
 * Returns all project data sources as a flat map: { [sourceName]: data }
 * Same logic as the public endpoint, but with auth guard.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: projectId } = await Promise.resolve(params)
    const access = await requireProjectDataAccess(projectId, false)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const result: Record<string, unknown> = {}

    // ── 1. Internal DB tables ──────────────────────────────────────────────
    const datasources = await prisma.internalDatasource.findMany({
      where: { projectId },
      include: {
        tables: {
          include: { columns: true },
        },
      },
    })

    for (const ds of datasources) {
      for (const table of ds.tables) {
        const rows = await prisma.internalRow.findMany({
          where: { tableId: table.id },
          orderBy: { createdAt: 'asc' },
          take: 500,
        })
        const mapped = rows.map((r) => ({
          id: r.id,
          ...(r.data as Record<string, unknown>),
          created_at: r.createdAt,
        }))
        result[table.name] = mapped
        // Also store under lowercase key so {{data.channels}} works even if table is named "Channels"
        const lower = table.name.toLowerCase()
        if (lower !== table.name) result[lower] = mapped
      }
    }

    // ── 2. External API sources ────────────────────────────────────────────
    const apiSources = await prisma.externalApiSource.findMany({
      where: { projectId },
    })

    await Promise.all(
      apiSources.map(async (src) => {
        try {
          const rawHeaders = ((src.headers as Record<string, string> | null) ?? {})
          const headers: Record<string, string> = Object.fromEntries(
            Object.entries(rawHeaders).map(([k, v]) => [k, resolveEnvPlaceholders(String(v ?? ''))])
          )
          const authValue = src.authValue ? resolveEnvPlaceholders(src.authValue) : src.authValue
          const requestBody = src.body ? resolveEnvPlaceholders(src.body) : src.body
          if (src.authType === 'bearer' && authValue) {
            headers['Authorization'] = `Bearer ${authValue}`
          } else if (src.authType === 'basic' && authValue) {
            headers['Authorization'] = `Basic ${Buffer.from(authValue).toString('base64')}`
          } else if (src.authType === 'apiKey' && authValue) {
            headers[src.authHeader ?? 'X-Api-Key'] = authValue
          }

          const fetchOptions: RequestInit = {
            method: src.method,
            headers,
            signal: AbortSignal.timeout(10000),
          }

          // Resolve {{paramName}} template variables in URL using urlParams defaults
          let resolvedUrl = resolveEnvPlaceholders(src.url)
          // Also resolve any remaining {{name}} from query params if passed
          const passedVars = req.nextUrl.searchParams.get('vars')
          if (passedVars) {
            try {
              const vars = JSON.parse(passedVars) as Record<string, Record<string, string>>
              const sourceVars = vars[src.name] ?? {}
              for (const [k, v] of Object.entries(sourceVars)) {
                resolvedUrl = resolvedUrl.replaceAll(`{{${k}}}`, encodeURIComponent(v))
              }
            } catch { /* ignore bad JSON */ }
          }
          const urlParamDefs = (src.urlParams as Array<{name: string; defaultValue?: string}> | null) ?? []
          for (const p of urlParamDefs) {
            if (p.defaultValue !== undefined) {
              const defaultVal = resolveEnvPlaceholders(String(p.defaultValue))
              resolvedUrl = resolvedUrl.replaceAll(`{{${p.name}}}`, encodeURIComponent(defaultVal))
            }
          }
          if (requestBody && !['GET', 'HEAD'].includes(src.method.toUpperCase())) {
            fetchOptions.body = requestBody
            if (!headers['content-type'] && !headers['Content-Type']) {
              headers['Content-Type'] = 'application/json'
            }
          }

          const resp = await fetch(resolvedUrl, fetchOptions)
          const text = await resp.text()
          let data: unknown
          try { data = JSON.parse(text) } catch { data = text }
          result[src.name] = data
        } catch (err) {
          result[src.name] = null
          console.warn(`[Runtime data] Failed to fetch source "${src.name}":`, (err as Error).message)
        }
      })
    )

    return NextResponse.json({ data: result }, {
      headers: { 'Cache-Control': 'no-store, no-cache' },
    })
  } catch (err: unknown) {
    console.error('[Runtime data] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
