/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { prisma } from '@/lib/prisma'
import { invalidateRuntimeCache } from '@/lib/public-runtime-cache'

const FETCH_TIMEOUT_MS = 15_000

function resolveEnvPlaceholders(input: string): string {
  return input.replace(/\{\{env\.([A-Za-z0-9_]+)\}\}/g, (_m, key: string) => process.env[key] ?? '')
}

/**
 * Fetch a saved external API source and store the response in the DB.
 * Returns the parsed data or null on failure.
 * This is the single place where external HTTP calls occur — never at runtime.
 */
export async function fetchAndCacheApiSource(sourceId: string): Promise<{ data: unknown; error?: string }> {
  const src = await prisma.externalApiSource.findUnique({ where: { id: sourceId } })
  if (!src) return { data: null, error: 'Source not found' }

  try {
    let url = resolveEnvPlaceholders(src.url)
    const rawHeaders = (src.headers as Record<string, string> | null) ?? {}
    const headers: Record<string, string> = Object.fromEntries(
      Object.entries(rawHeaders).map(([k, v]) => [k, resolveEnvPlaceholders(String(v ?? ''))])
    )
    const authValue = src.authValue ? resolveEnvPlaceholders(src.authValue) : src.authValue
    const requestBody = src.body ? resolveEnvPlaceholders(src.body) : src.body

    // Inject auth
    if (src.authType === 'bearer' && authValue) headers['Authorization'] = `Bearer ${authValue}`
    else if (src.authType === 'basic' && authValue) headers['Authorization'] = `Basic ${Buffer.from(authValue).toString('base64')}`
    else if (src.authType === 'apiKey' && authValue) headers[src.authHeader ?? 'X-Api-Key'] = authValue

    // Resolve URL param defaults
    const urlParamDefs = (src.urlParams as Array<{ name: string; defaultValue?: string }> | null) ?? []
    for (const p of urlParamDefs) {
      if (p.defaultValue !== undefined) {
        const defaultVal = resolveEnvPlaceholders(String(p.defaultValue))
        url = url.replaceAll(`{{${p.name}}}`, encodeURIComponent(defaultVal))
      }
    }

    const fetchOptions: RequestInit = {
      method: src.method,
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }

    if (requestBody && !['GET', 'HEAD'].includes(src.method.toUpperCase())) {
      fetchOptions.body = requestBody
      if (!headers['content-type'] && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
    }

    const resp = await fetch(url, fetchOptions)
    const text = await resp.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = text }

    // Infer schema
    let schema: Array<{ name: string; type: string }> | null = null
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0]) {
      schema = Object.entries(data[0]).map(([k, v]) => ({
        name: k,
        type: v === null ? 'string' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string',
      }))
    } else if (data && typeof data === 'object' && !Array.isArray(data)) {
      schema = Object.entries(data as Record<string, unknown>).map(([k, v]) => ({
        name: k,
        type: v === null ? 'string' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string',
      }))
    }

    // Persist to DB
    await prisma.externalApiSource.update({
      where: { id: sourceId },
      data: {
        cachedResponse: data as any,
        cachedAt: new Date(),
        ...(schema ? { schema: schema as any } : {}),
      },
    })

    // Bust in-memory cache so next request picks up fresh DB data
    invalidateRuntimeCache(src.projectId)

    return { data }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[fetchAndCacheApiSource] Failed for "${src.name}" (${sourceId}):`, message)
    return { data: null, error: message }
  }
}
