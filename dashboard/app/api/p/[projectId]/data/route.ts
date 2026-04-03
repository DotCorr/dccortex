/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const EXTERNAL_API_TIMEOUT_MS = 3500

function resolveEnvPlaceholders(input: string): string {
  return input.replace(/\{\{env\.([A-Za-z0-9_]+)\}\}/g, (_m, key: string) => process.env[key] ?? '')
}

/**
 * Public (unauthenticated) runtime-data endpoint.
 * Returns all project data sources as a flat map: { [sourceName]: data }
 *   - ExternalApiSource records → server-side proxied HTTP fetch
 *   - InternalDatasource tables → all rows from Prisma
 * Used by PreviewApp to populate {{data.*}} bindings at runtime.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> | { projectId: string } }
) {
  try {
    const { projectId } = await Promise.resolve(params)

    // Parse optional vars override: ?vars={"sourceName":{"paramName":"value"}}
    const passedVars = _req.nextUrl.searchParams.get('vars')
    let varsMap: Record<string, Record<string, string>> = {}
    if (passedVars) {
      try { varsMap = JSON.parse(passedVars) } catch { /* ignore malformed */ }
    }

    // Only serve published projects
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    })
    if (!project || project.status !== 'published') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

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
          take: 500, // safety limit
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
          // Inject auth
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
            signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS),
          }
          if (requestBody && !['GET', 'HEAD'].includes(src.method.toUpperCase())) {
            fetchOptions.body = requestBody
            if (!headers['content-type'] && !headers['Content-Type']) {
              headers['Content-Type'] = 'application/json'
            }
          }

          // Resolve {{paramName}} template variables in URL
          let resolvedUrl = resolveEnvPlaceholders(src.url)
          const urlParamDefs = (src.urlParams as Array<{ name: string; defaultValue?: string }> | null) ?? []
          // Apply caller-supplied overrides FIRST so they win over defaults.
          const sourceVars = varsMap[src.name] ?? {}
          for (const [k, v] of Object.entries(sourceVars)) {
            resolvedUrl = resolvedUrl.replaceAll(`{{${k}}}`, encodeURIComponent(v))
          }
          for (const p of urlParamDefs) {
            if (p.defaultValue !== undefined) {
              const defaultVal = resolveEnvPlaceholders(String(p.defaultValue))
              resolvedUrl = resolvedUrl.replaceAll(`{{${p.name}}}`, encodeURIComponent(defaultVal))
            }
          }

          const resp = await fetch(resolvedUrl, fetchOptions)
          const text = await resp.text()
          let data: unknown
          try { data = JSON.parse(text) } catch { data = text }

          result[src.name] = data
        } catch (err) {
          result[src.name] = null
          console.warn(`[Public data] Failed to fetch source "${src.name}":`, (err as Error).message)
        }
      })
    )

    return NextResponse.json({ data: result }, {
      headers: {
        'Cache-Control': 'no-store, no-cache',
      },
    })
  } catch (err: unknown) {
    console.error('[Public data] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
