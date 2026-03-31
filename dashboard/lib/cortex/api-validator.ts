/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { prisma } from '@/lib/prisma'

export type ApiValidationResult = {
  success: boolean
  status: number
  statusText?: string
  headers?: Record<string, string>
  contentType?: string
  elapsed: string
  parseError?: string | null
  schema?: unknown
  sampleCount?: number
  samples?: unknown
  fullDataPreview?: string
  error?: string
}

export async function validateApiSource(params: {
  projectId: string
  sourceId: string
  urlOverride?: string
  limit?: number
}): Promise<ApiValidationResult> {
  const { projectId, sourceId, urlOverride } = params
  const sampleLimit = params.limit ?? 3

  const source = await prisma.externalApiSource.findUnique({
    where: { id: sourceId },
  })

  if (!source || source.projectId !== projectId) {
    return {
      success: false,
      error: 'API source not found or access denied',
      status: 404,
      elapsed: '—',
    }
  }

  try {
    const url = urlOverride || source.url
    const method = source.method || 'GET'
    const headers: Record<string, string> = typeof source.headers === 'object' && source.headers !== null
      ? Object.fromEntries(Object.entries(source.headers as Record<string, unknown>).map(([key, value]) => [key, String(value)]))
      : {}
    const bodyPayload: string | undefined = source.body || undefined

    if (source.authType === 'bearer' && source.authValue) {
      headers.Authorization = `Bearer ${source.authValue}`
    } else if (source.authType === 'basic' && source.authValue) {
      headers.Authorization = `Basic ${source.authValue}`
    } else if (source.authType === 'apiKey' && source.authValue && source.authHeader) {
      headers[source.authHeader] = source.authValue
    }

    const startTime = Date.now()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      method,
      headers,
      body: bodyPayload && method !== 'GET' ? bodyPayload : undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    const elapsed = `${Date.now() - startTime}ms`
    const contentType = response.headers.get('content-type') || ''

    let data: unknown
    let parseError: string | null = null

    if (contentType.includes('application/json')) {
      try {
        data = await response.json()
      } catch (error: unknown) {
        parseError = `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`
        data = null
      }
    } else if (contentType.includes('text')) {
      data = await response.text()
    } else {
      data = await response.arrayBuffer()
    }

    const schema = inferSchema(data)
    const samples = extractSamples(data, sampleLimit)
    const semanticError = detectSemanticApiError(data)
    const effectiveStatus = semanticError?.status ?? response.status
    const effectiveStatusText = semanticError?.message ?? response.statusText

    return {
      success: response.ok && !semanticError,
      status: effectiveStatus,
      statusText: effectiveStatusText,
      headers: Object.fromEntries(
        Array.from(response.headers.entries()).filter(([key]) => !['set-cookie', 'authorization'].includes(key.toLowerCase()))
      ),
      contentType,
      elapsed,
      parseError,
      schema: semanticError ? null : schema,
      sampleCount: Array.isArray(samples) ? samples.length : samples ? 1 : 0,
      samples,
      fullDataPreview: truncateData(data, 500),
      error: semanticError?.message,
    }
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      status: 0,
      elapsed: '—',
    }
  }
}

function inferSchema(data: unknown): unknown {
  if (!data) return { type: 'null' }

  if (Array.isArray(data)) {
    if (data.length === 0) return { type: 'array', items: {} }
    const firstItem = data[0]
    if (typeof firstItem === 'object' && firstItem !== null) {
      const keys = Object.keys(firstItem as Record<string, unknown>)
      const fields: Record<string, string> = {}
      for (const key of keys.slice(0, 10)) {
        const value = (firstItem as Record<string, unknown>)[key]
        fields[key] = inferType(value)
      }
      return { type: 'array', items: { type: 'object', fields } }
    }
    return { type: 'array', items: { type: inferType(firstItem) } }
  }

  if (typeof data === 'object' && data !== null) {
    const fields: Record<string, string> = {}
    const keys = Object.keys(data as Record<string, unknown>).slice(0, 20)
    for (const key of keys) {
      const value = (data as Record<string, unknown>)[key]
      fields[key] = inferType(value)
    }
    return { type: 'object', fields }
  }

  return { type: inferType(data) }
}

function inferType(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date'
    if (/^https?:\/\//.test(value)) return 'url'
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email'
    return 'string'
  }
  if (Array.isArray(value)) return value.length > 0 ? `array(${inferType(value[0])})` : 'array'
  if (typeof value === 'object') return 'object'
  return 'unknown'
}

function extractSamples(data: unknown, limit: number): unknown {
  if (Array.isArray(data)) {
    return data.slice(0, limit).map((item, index) => ({ _index: index, ...(item as Record<string, unknown>) }))
  }
  if (typeof data === 'object' && data !== null) return [data]
  return null
}

function truncateData(data: unknown, maxChars: number): string {
  const str = JSON.stringify(data, null, 2)
  if (str.length > maxChars) return `${str.substring(0, maxChars)}\n... (${str.length - maxChars} chars truncated)`
  return str
}

function detectSemanticApiError(data: unknown): { status: number; message: string } | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const obj = data as Record<string, unknown>
  const errorStatus = typeof obj.error === 'number' ? obj.error : null
  const message = typeof obj.message === 'string' ? obj.message : null
  if (errorStatus && errorStatus >= 400 && message) {
    return { status: errorStatus, message }
  }
  return null
}
