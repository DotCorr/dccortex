/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import { prisma } from '@/lib/prisma'

const EXTERNAL_API_TIMEOUT_MS = 3500
const RUNTIME_CACHE_TTL_MS = 15 * 1000
const RUNTIME_CACHE_TTL_ON_SOURCE_ERROR_MS = 3 * 1000
const MAX_SIGNATURES_TO_WARM = 12

type VarsMap = Record<string, Record<string, string>>
type RuntimeDataMap = Record<string, unknown>

type RuntimeBuildTimings = {
  totalMs: number
  dbMs: number
  apiMs: number
}

type RuntimeCacheEntry = {
  ts: number
  ttlMs: number
  data: RuntimeDataMap
  timings: RuntimeBuildTimings
}

const runtimeCache = new Map<string, RuntimeCacheEntry>()

function resolveEnvPlaceholders(input: string): string {
  return input.replace(/\{\{env\.([A-Za-z0-9_]+)\}\}/g, (_m, key: string) => process.env[key] ?? '')
}

function sourceNameAliases(name: string): string[] {
  const trimmed = String(name ?? '').trim()
  if (!trimmed) return []
  const snake = trimmed.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
  const kebab = trimmed.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  const compact = trimmed.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase()
  return Array.from(new Set([trimmed, snake, kebab, compact].filter(Boolean)))
}

function setWithAliases(target: Record<string, unknown>, sourceName: string, value: unknown) {
  for (const alias of sourceNameAliases(sourceName)) {
    if (!(alias in target)) target[alias] = value
  }
}

function normalizeVarsMap(varsMap: VarsMap): VarsMap {
  const out: VarsMap = {}
  for (const sourceName of Object.keys(varsMap).sort()) {
    const src = varsMap[sourceName] ?? {}
    const nested: Record<string, string> = {}
    for (const paramName of Object.keys(src).sort()) {
      nested[paramName] = String(src[paramName] ?? '')
    }
    out[sourceName] = nested
  }
  return out
}

function signatureFor(projectId: string, varsMap: VarsMap): string {
  const normalized = normalizeVarsMap(varsMap)
  return `${projectId}::${JSON.stringify(normalized)}`
}

function parseInitialStateValue(raw: unknown): string | number | boolean {
  const v = String(raw ?? '').trim()
  if (v === 'true') return true
  if (v === 'false') return false
  const n = Number(v)
  return Number.isNaN(n) ? v : n
}

function varsMapFromBindings(
  dataSources: Array<{ name?: string; urlParamBindings?: Record<string, string> }>,
  state: Record<string, unknown>
): VarsMap {
  const vars: VarsMap = {}
  for (const ds of dataSources) {
    const sourceName = String(ds?.name ?? '').trim()
    if (!sourceName || !ds.urlParamBindings) continue
    const resolved: Record<string, string> = {}
    for (const [paramName, binding] of Object.entries(ds.urlParamBindings)) {
      const raw = String(binding ?? '').trim()
      if (!raw) continue
      const stateMatch = raw.match(/^\{\{state\.([^}]+)\}\}$/)
      if (stateMatch) {
        const val = state[stateMatch[1]]
        if (val !== undefined && val !== null && String(val) !== '') {
          resolved[paramName] = String(val)
        }
      } else {
        resolved[paramName] = raw
      }
    }
    if (Object.keys(resolved).length > 0) vars[sourceName] = resolved
  }
  return vars
}

export function parseVarsQuery(raw: string | null): VarsMap {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: VarsMap = {}
    for (const [sourceName, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const nested: Record<string, string> = {}
      for (const [paramName, paramVal] of Object.entries(value as Record<string, unknown>)) {
        nested[paramName] = String(paramVal ?? '')
      }
      out[sourceName] = nested
    }
    return out
  } catch {
    return {}
  }
}

export async function buildRuntimeData(projectId: string, varsMap: VarsMap, opts?: { skipPublishedCheck?: boolean }): Promise<{ data: RuntimeDataMap; timings: RuntimeBuildTimings; hasSourceErrors: boolean }> {
  const totalStart = performance.now()
  const result: RuntimeDataMap = {}

  const dbStart = performance.now()
  const [project, datasources, apiSources] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true, status: true } }),
    prisma.internalDatasource.findMany({
      where: { projectId },
      include: { tables: { include: { columns: true } } },
    }),
    prisma.externalApiSource.findMany({ where: { projectId } }),
  ])

  if (!opts?.skipPublishedCheck && (!project || project.status !== 'published')) {
    throw new Error('PROJECT_NOT_PUBLISHED')
  }

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
      setWithAliases(result, table.name, mapped)
    }
  }

  const dbMs = performance.now() - dbStart

  const apiStart = performance.now()
  let hasSourceErrors = false
  await Promise.all(
    apiSources.map(async (src) => {
      try {
        const rawHeaders = ((src.headers as Record<string, string> | null) ?? {})
        const headers: Record<string, string> = Object.fromEntries(
          Object.entries(rawHeaders).map(([k, v]) => [k, resolveEnvPlaceholders(String(v ?? ''))])
        )
        const authValue = src.authValue ? resolveEnvPlaceholders(src.authValue) : src.authValue
        const requestBody = src.body ? resolveEnvPlaceholders(src.body) : src.body

        if (src.authType === 'bearer' && authValue) headers.Authorization = `Bearer ${authValue}`
        else if (src.authType === 'basic' && authValue) headers.Authorization = `Basic ${Buffer.from(authValue).toString('base64')}`
        else if (src.authType === 'apiKey' && authValue) headers[src.authHeader ?? 'X-Api-Key'] = authValue

        const fetchOptions: RequestInit = {
          method: src.method,
          headers,
          signal: AbortSignal.timeout(EXTERNAL_API_TIMEOUT_MS),
        }

        if (requestBody && !['GET', 'HEAD'].includes(src.method.toUpperCase())) {
          fetchOptions.body = requestBody
          if (!headers['content-type'] && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
        }

        let resolvedUrl = resolveEnvPlaceholders(src.url)
        const urlParamDefs = (src.urlParams as Array<{ name: string; defaultValue?: string }> | null) ?? []
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
        setWithAliases(result, src.name, data)
      } catch (err) {
        hasSourceErrors = true
        setWithAliases(result, src.name, null)
        console.warn(`[Public data] Failed to fetch source "${src.name}":`, (err as Error).message)
      }
    })
  )
  const apiMs = performance.now() - apiStart

  return {
    data: result,
    timings: {
      totalMs: performance.now() - totalStart,
      dbMs,
      apiMs,
    },
    hasSourceErrors,
  }
}

export async function getCachedRuntimeData(projectId: string, varsMap: VarsMap, opts?: { skipPublishedCheck?: boolean }): Promise<{ data: RuntimeDataMap; timings: RuntimeBuildTimings; cacheHit: boolean }> {
  const key = signatureFor(projectId, varsMap)
  const now = Date.now()
  const cached = runtimeCache.get(key)
  if (cached && now - cached.ts <= cached.ttlMs) {
    return { data: cached.data, timings: cached.timings, cacheHit: true }
  }
  const built = await buildRuntimeData(projectId, varsMap, opts)
  let nextData = built.data

  // If a source temporarily fails in live mode, retain the last known good value
  // for that source instead of replacing it with null.
  if (cached && built.hasSourceErrors) {
    const merged: RuntimeDataMap = { ...built.data }
    for (const [sourceName, value] of Object.entries(built.data)) {
      if (value === null && cached.data[sourceName] != null) {
        merged[sourceName] = cached.data[sourceName]
      }
    }
    nextData = merged
  }

  const ttlMs = built.hasSourceErrors ? RUNTIME_CACHE_TTL_ON_SOURCE_ERROR_MS : RUNTIME_CACHE_TTL_MS
  runtimeCache.set(key, { ts: now, ttlMs, data: nextData, timings: built.timings })
  return { data: nextData, timings: built.timings, cacheHit: false }
}

export type RuntimeWarmStats = {
  projectId: string
  signatureCount: number
  warmedCount: number
  cacheMissCount: number
  durationMs: number
  failed: boolean
  error?: string
}

export async function warmProjectRuntimeCache(projectId: string): Promise<RuntimeWarmStats> {
  const started = performance.now()
  try {
    const [screens, globals] = await Promise.all([
      prisma.appScreen.findMany({
        where: { projectId, NOT: { slug: '__globals__' } },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, layout: true },
      }),
      prisma.appScreen.findUnique({
        where: { projectId_slug: { projectId, slug: '__globals__' } },
        select: { layout: true },
      }),
    ])

    const initialState: Record<string, unknown> = {}
    const globalDefs = ((globals?.layout as any)?.globalStateDefinitions ?? []) as Array<{ name?: string; initialValue?: unknown }>
    for (const s of globalDefs) {
      const name = String(s?.name ?? '').trim()
      if (!name) continue
      initialState[name] = parseInitialStateValue(s.initialValue)
    }
    for (const sc of screens) {
      const defs = (((sc.layout as any)?.stateDefinitions ?? []) as Array<{ name?: string; initialValue?: unknown }>)
      for (const s of defs) {
        const name = String(s?.name ?? '').trim()
        if (!name || name in initialState) continue
        initialState[name] = parseInitialStateValue(s.initialValue)
      }
    }

    const signatures = new Set<string>()
    signatures.add(JSON.stringify({}))

    for (const sc of screens) {
      const dataSources = ((((sc.layout as any)?.dataSources ?? []) as Array<{ name?: string; urlParamBindings?: Record<string, string> }>))
      const varsMap = varsMapFromBindings(dataSources, initialState)
      signatures.add(JSON.stringify(normalizeVarsMap(varsMap)))
      if (signatures.size >= MAX_SIGNATURES_TO_WARM) break
    }

    let warmedCount = 0
    let cacheMissCount = 0
    for (const signatureJson of Array.from(signatures)) {
      const varsMap = JSON.parse(signatureJson) as VarsMap
      const res = await getCachedRuntimeData(projectId, varsMap)
      warmedCount += 1
      if (!res.cacheHit) cacheMissCount += 1
    }

    return {
      projectId,
      signatureCount: signatures.size,
      warmedCount,
      cacheMissCount,
      durationMs: Math.round((performance.now() - started) * 10) / 10,
      failed: false,
    }
  } catch (err) {
    const message = (err as Error).message
    console.warn('[Runtime warm] failed:', message)
    return {
      projectId,
      signatureCount: 0,
      warmedCount: 0,
      cacheMissCount: 0,
      durationMs: Math.round((performance.now() - started) * 10) / 10,
      failed: true,
      error: message,
    }
  }
}
