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

/** Proxy-test a saved or unsaved external API source. */
export async function POST(
  req: NextRequest,
  context: any
) {
  const { id: projectId } = context.params
  const access = await requireProjectDataAccess(projectId, false)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = await req.json().catch(() => ({}))
  const {
    sourceId,
    url: rawUrl,
    method: rawMethod,
    headers: rawHeaders,
    body: rawBody,
    authType,
    authValue,
    authHeader,
  } = body as {
    sourceId?: string
    url?: string
    method?: string
    headers?: Record<string, string>
    body?: string
    authType?: string
    authValue?: string
    authHeader?: string
  }

  // If sourceId given, load saved source; otherwise use provided params
  let url = rawUrl ?? ''
  let method = rawMethod ?? 'GET'
  let headers: Record<string, string> = rawHeaders ?? {}
  let reqBody = rawBody
  let auth = authType ?? 'none'
  let authVal = authValue ?? ''
  let authHdr = authHeader ?? 'X-Api-Key'

  if (sourceId) {
    const source = await prisma.externalApiSource.findFirst({ where: { id: sourceId, projectId } })
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    url = source.url
    method = source.method
    headers = (source.headers as Record<string, string> | null) ?? {}
    reqBody = source.body ?? undefined
    auth = source.authType
    authVal = source.authValue ?? ''
    authHdr = source.authHeader ?? 'X-Api-Key'
  }

  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  url = resolveEnvPlaceholders(url)
  headers = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, resolveEnvPlaceholders(String(v ?? ''))]))
  reqBody = reqBody ? resolveEnvPlaceholders(reqBody) : reqBody
  authVal = authVal ? resolveEnvPlaceholders(authVal) : authVal

  // Inject auth header
  const outHeaders: Record<string, string> = { ...headers }
  if (auth === 'bearer' && authVal) outHeaders['Authorization'] = `Bearer ${authVal}`
  else if (auth === 'basic' && authVal) outHeaders['Authorization'] = `Basic ${Buffer.from(authVal).toString('base64')}`
  else if (auth === 'apiKey' && authVal) outHeaders[authHdr || 'X-Api-Key'] = authVal

  try {
    const fetchOptions: RequestInit = { method, headers: outHeaders, signal: AbortSignal.timeout(15000) }
    if (reqBody && !['GET', 'HEAD'].includes(method.toUpperCase())) {
      fetchOptions.body = reqBody
      if (!outHeaders['content-type'] && !outHeaders['Content-Type']) {
        outHeaders['Content-Type'] = 'application/json'
      }
    }

    const resp = await fetch(url, fetchOptions)
    const text = await resp.text()
    let json: unknown = null
    try { json = JSON.parse(text) } catch { /* non-JSON */ }

    // Infer schema from first item if array
    let schema: Array<{ name: string; type: string }> | null = null
    if (Array.isArray(json) && json.length > 0 && typeof json[0] === 'object' && json[0]) {
      schema = Object.entries(json[0]).map(([k, v]) => ({
        name: k,
        type: v === null ? 'string' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string',
      }))
    } else if (json && typeof json === 'object' && !Array.isArray(json)) {
      // wrap in array-like
      const entries = Object.entries(json as Record<string, unknown>)
      schema = entries.map(([k, v]) => ({
        name: k,
        type: v === null ? 'string' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string',
      }))
    }

    return NextResponse.json({
      status: resp.status,
      statusText: resp.statusText,
      data: json ?? text,
      rawText: text.slice(0, 20000),
      schema,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 502 })
  }
}
