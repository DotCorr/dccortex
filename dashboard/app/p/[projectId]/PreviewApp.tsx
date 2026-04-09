/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { Profiler, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useWebHaptics } from 'web-haptics/react'
import { RefreshCw } from 'lucide-react'
import { BuilderCanvas } from '@/components/builder/BuilderCanvas'
import { resolveBinding, resolveExpression, getDateNowMap } from '@/components/builder/bindingResolver'
import type { PublicProjectPayload } from '@/lib/public-project-cache'
import type { EventActionConfig, EventRuntimeContext } from '@/components/builder/eventHelpers'
import type { Node } from '@/components/builder/registry'
import type { ReusableDefinition } from '@/components/builder/globals'

type ScreenRow = { id: string; name: string; slug: string; layout: unknown; script?: string | null; sortOrder: number }
type StateDefinition = { id: string; name: string; initialValue: string; type?: string }
const BOOTSTRAP_MAX_AGE_MS = 5 * 60 * 1000
const SIGNATURE_CACHE_MAX_AGE_MS = 5 * 60 * 1000
const SIGNATURE_CACHE_MAX_ENTRIES = 24

function buildVarsParamForDataSources(
  dataSources: Array<{ name: string; urlParamBindings?: Record<string, string> }>,
  state: Record<string, unknown>
): string {
  const vars: Record<string, Record<string, string>> = {}
  for (const ds of dataSources) {
    if (!ds.urlParamBindings) continue
    const resolved: Record<string, string> = {}
    for (const [paramName, binding] of Object.entries(ds.urlParamBindings)) {
      if (!binding) continue
      const stateMatch = binding.match(/^\{\{state\.([^}]+)\}\}$/)
      if (stateMatch) {
        const val = state[stateMatch[1]]
        if (val !== undefined && val !== null) resolved[paramName] = String(val)
      } else {
        resolved[paramName] = binding
      }
    }
    if (Object.keys(resolved).length) vars[ds.name] = resolved
  }
  return Object.keys(vars).length ? `?vars=${encodeURIComponent(JSON.stringify(vars))}` : ''
}

type SignatureCacheMap = Record<string, { ts: number; data: Record<string, unknown> }>
type LivePerfSnapshot = {
  projectFetchMs: number
  runtimeFetchMs: number
  prefetchFetchMs: number
  projectServerTotalMs: number
  projectServerDbMs: number
  runtimeServerTotalMs: number
  runtimeServerDbMs: number
  runtimeServerApiMs: number
  resolveCallsPerSec: number
  resolveAvgMs: number
  resolveMaxMs: number
  renderCommitsPerSec: number
  renderAvgMs: number
  renderMaxMs: number
}

function parseServerTimingHeader(headerValue: string | null): Record<string, number> {
  if (!headerValue) return {}
  const out: Record<string, number> = {}
  for (const part of headerValue.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const [metricNameRaw, ...params] = trimmed.split(';').map((x) => x.trim())
    const metricName = metricNameRaw.toLowerCase()
    for (const p of params) {
      if (!p.startsWith('dur=')) continue
      const n = Number(p.slice(4))
      if (Number.isFinite(n)) out[metricName] = n
    }
  }
  return out
}

function shallowEqualRecord(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (a === b) return true
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false
  }
  return true
}

function parseComparable(v: string): string | number | boolean {
  const s = String(v ?? '').trim()
  if (s === 'true') return true
  if (s === 'false') return false
  const n = Number(s)
  return Number.isNaN(n) ? s : n
}

function evaluateEventCondition(
  condition: EventActionConfig['condition'] | undefined,
  state: Record<string, unknown>,
  event?: EventRuntimeContext
): boolean {
  if (!condition || !condition.left?.trim()) return true
  const op = condition.op ?? '=='
  const leftRaw = resolveBinding(condition.left ?? '', { state, event: event as Record<string, unknown> | undefined }).trim()
  if (op === 'empty') return leftRaw === ''
  if (op === 'notEmpty') return leftRaw !== ''
  const rightRaw = resolveBinding(condition.right ?? '', { state, event: event as Record<string, unknown> | undefined }).trim()
  if (op === 'contains') return leftRaw.includes(rightRaw)
  const left = parseComparable(leftRaw)
  const right = parseComparable(rightRaw)
  switch (op) {
    case '==': return String(left) === String(right)
    case '!=': return String(left) !== String(right)
    case '>': return Number(left) > Number(right)
    case '<': return Number(left) < Number(right)
    case '>=': return Number(left) >= Number(right)
    case '<=': return Number(left) <= Number(right)
    default: return true
  }
}

export default function PreviewApp({ projectId, initialProject, initialData }: { projectId: string; initialProject?: PublicProjectPayload | null; initialData?: Record<string, unknown> | null }) {
  const [isDesktopShell, setIsDesktopShell] = useState(false)
  const initialHomeScreenId = useMemo(() => {
    const rows = initialProject?.screens ?? []
    return rows.find((s) => s.slug === 'home')?.id ?? rows[0]?.id ?? null
  }, [initialProject])
  const [status, setStatus] = useState<'loading' | 'notPublished' | 'error' | 'ready'>(initialProject ? 'ready' : 'loading')
  const [projectName, setProjectName] = useState(initialProject?.project.name ?? '')
  const [screens, setScreens] = useState<ScreenRow[]>(initialProject?.screens ?? [])
  const [globals, setGlobals] = useState<Record<string, unknown>>(initialProject?.globals ?? {})
  const [currentScreenId, setCurrentScreenId] = useState<string | null>(initialHomeScreenId)
  const screenHistoryRef = useRef<string[]>([])
  const [runtimeState, setRuntimeState] = useState<Record<string, unknown>>({})
  const [runtimeData, setRuntimeData] = useState<Record<string, unknown>>(initialData ?? {})
  const runtimeDataCacheKey = useMemo(() => `dccortex:runtime-data:${projectId}`, [projectId])
  const runtimeDataSignatureCacheKey = useMemo(() => `dccortex:runtime-data-signatures:${projectId}`, [projectId])
  const previewBootstrapCacheKey = useMemo(() => `dccortex:preview-bootstrap:${projectId}`, [projectId])
  const stateCacheKey = useMemo(() => `dccortex:state-cache:${projectId}`, [projectId])
  const runtimeDataRequestIdRef = useRef(0)
  const lastRuntimeVarsSignatureRef = useRef<string | null>(initialData ? '' : null)
  const hasFetchedRuntimeDataRef = useRef(!!initialData)
  const runtimeDataMemoryCacheRef = useRef<Map<string, Record<string, unknown>>>(new Map())
  const prefetchedSignaturesRef = useRef<Set<string>>(new Set())
  const resolvePerfRef = useRef({ calls: 0, totalMs: 0, maxMs: 0 })
  const renderPerfRef = useRef({ commits: 0, totalMs: 0, maxMs: 0 })
  const networkPerfRef = useRef({
    projectFetchMs: 0,
    runtimeFetchMs: 0,
    prefetchFetchMs: 0,
    projectServerTotalMs: 0,
    projectServerDbMs: 0,
    runtimeServerTotalMs: 0,
    runtimeServerDbMs: 0,
    runtimeServerApiMs: 0,
  })
  const [showPerfHud, setShowPerfHud] = useState(false)
  const [livePerf, setLivePerf] = useState<LivePerfSnapshot>({
    projectFetchMs: 0,
    runtimeFetchMs: 0,
    prefetchFetchMs: 0,
    projectServerTotalMs: 0,
    projectServerDbMs: 0,
    runtimeServerTotalMs: 0,
    runtimeServerDbMs: 0,
    runtimeServerApiMs: 0,
    resolveCallsPerSec: 0,
    resolveAvgMs: 0,
    resolveMaxMs: 0,
    renderCommitsPerSec: 0,
    renderAvgMs: 0,
    renderMaxMs: 0,
  })
  const { trigger: triggerHaptic } = useWebHaptics()
  const [systemDark, setSystemDark] = useState(false)

  const readSignatureCache = useCallback((): SignatureCacheMap => {
    try {
      const raw = localStorage.getItem(runtimeDataSignatureCacheKey)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? (parsed as SignatureCacheMap) : {}
    } catch {
      return {}
    }
  }, [runtimeDataSignatureCacheKey])

  const writeSignatureCacheEntry = useCallback((signature: string, data: Record<string, unknown>) => {
    if (!signature) return
    try {
      const now = Date.now()
      const existing = readSignatureCache()
      const pruned: SignatureCacheMap = {}
      for (const [sig, entry] of Object.entries(existing)) {
        if (!entry || typeof entry !== 'object') continue
        if (now - Number(entry.ts ?? 0) <= SIGNATURE_CACHE_MAX_AGE_MS) pruned[sig] = entry
      }
      pruned[signature] = { ts: now, data }
      const keys = Object.keys(pruned)
      if (keys.length > SIGNATURE_CACHE_MAX_ENTRIES) {
        keys.sort((a, b) => Number(pruned[b].ts) - Number(pruned[a].ts))
        const trimmed: SignatureCacheMap = {}
        for (const k of keys.slice(0, SIGNATURE_CACHE_MAX_ENTRIES)) trimmed[k] = pruned[k]
        localStorage.setItem(runtimeDataSignatureCacheKey, JSON.stringify(trimmed))
        return
      }
      localStorage.setItem(runtimeDataSignatureCacheKey, JSON.stringify(pruned))
    } catch {}
  }, [readSignatureCache, runtimeDataSignatureCacheKey])

  const readSignatureCacheEntry = useCallback((signature: string): Record<string, unknown> | null => {
    if (!signature) return null
    const cache = readSignatureCache()
    const entry = cache[signature]
    if (!entry) return null
    if (Date.now() - Number(entry.ts ?? 0) > SIGNATURE_CACHE_MAX_AGE_MS) return null
    return entry.data && typeof entry.data === 'object' ? entry.data : null
  }, [readSignatureCache])

  useEffect(() => {
    try {
      const qsPerf = new URLSearchParams(window.location.search).get('perf')
      const lsPerf = localStorage.getItem('dccortex:live-perf')
      setShowPerfHud(qsPerf === '1' || lsPerf === '1')
    } catch {}
  }, [])

  useEffect(() => {
    if (!showPerfHud) return
    const t = setInterval(() => {
      const resolveCalls = resolvePerfRef.current.calls
      const resolveTotal = resolvePerfRef.current.totalMs
      const resolveMax = resolvePerfRef.current.maxMs
      const renderCommits = renderPerfRef.current.commits
      const renderTotal = renderPerfRef.current.totalMs
      const renderMax = renderPerfRef.current.maxMs

      setLivePerf({
        projectFetchMs: Number(networkPerfRef.current.projectFetchMs.toFixed(1)),
        runtimeFetchMs: Number(networkPerfRef.current.runtimeFetchMs.toFixed(1)),
        prefetchFetchMs: Number(networkPerfRef.current.prefetchFetchMs.toFixed(1)),
        projectServerTotalMs: Number(networkPerfRef.current.projectServerTotalMs.toFixed(1)),
        projectServerDbMs: Number(networkPerfRef.current.projectServerDbMs.toFixed(1)),
        runtimeServerTotalMs: Number(networkPerfRef.current.runtimeServerTotalMs.toFixed(1)),
        runtimeServerDbMs: Number(networkPerfRef.current.runtimeServerDbMs.toFixed(1)),
        runtimeServerApiMs: Number(networkPerfRef.current.runtimeServerApiMs.toFixed(1)),
        resolveCallsPerSec: resolveCalls,
        resolveAvgMs: Number((resolveCalls > 0 ? resolveTotal / resolveCalls : 0).toFixed(3)),
        resolveMaxMs: Number(resolveMax.toFixed(3)),
        renderCommitsPerSec: renderCommits,
        renderAvgMs: Number((renderCommits > 0 ? renderTotal / renderCommits : 0).toFixed(3)),
        renderMaxMs: Number(renderMax.toFixed(3)),
      })

      resolvePerfRef.current = { calls: 0, totalMs: 0, maxMs: 0 }
      renderPerfRef.current = { commits: 0, totalMs: 0, maxMs: 0 }
    }, 1000)
    return () => clearInterval(t)
  }, [showPerfHud])

  const applyRuntimeData = useCallback((payload: unknown, varsSignature = '') => {
    if (!payload || typeof payload !== 'object') return
    const next = payload as Record<string, unknown>
    if (varsSignature) runtimeDataMemoryCacheRef.current.set(varsSignature, next)
    if (varsSignature) writeSignatureCacheEntry(varsSignature, next)
    setRuntimeData((prev) => (shallowEqualRecord(prev, next) ? prev : next))
    hasFetchedRuntimeDataRef.current = true
    try { localStorage.setItem(runtimeDataCacheKey, JSON.stringify(next)) } catch {}
  }, [runtimeDataCacheKey, writeSignatureCacheEntry])

  const [isRefreshing, setIsRefreshing] = useState(false)
  const handleManualRefresh = useCallback(() => {
    setIsRefreshing(true)
    const requestId = ++runtimeDataRequestIdRef.current
    const start = performance.now()
    fetch(`/api/p/${projectId}/data`, { cache: 'no-store' })
      .then((r) => {
        networkPerfRef.current.runtimeFetchMs = performance.now() - start
        return r.ok ? r.json() : null
      })
      .then((d) => {
        if (requestId !== runtimeDataRequestIdRef.current) return
        if (d?.data) {
          lastRuntimeVarsSignatureRef.current = ''
          applyRuntimeData(d.data, '')
        }
      })
      .catch(() => {})
      .finally(() => setIsRefreshing(false))
  }, [projectId, applyRuntimeData])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(runtimeDataCacheKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        setRuntimeData(parsed as Record<string, unknown>)
      }
    } catch {}
  }, [runtimeDataCacheKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as unknown as { __TAURI__?: unknown; electronAPI?: { isElectron?: boolean } }
    setIsDesktopShell(!!w.__TAURI__ || !!w.electronAPI?.isElectron)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(mq.matches)
    const h = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  useEffect(() => {
    if (initialProject) return
    // Warm-start from recent cached payload so refresh paints immediately.
    try {
      const bootRaw = localStorage.getItem(previewBootstrapCacheKey)
      if (bootRaw) {
        const boot = JSON.parse(bootRaw) as {
          ts?: number
          projectName?: string
          screens?: ScreenRow[]
          globals?: Record<string, unknown>
          currentScreenId?: string
        }
        const ageMs = Date.now() - Number(boot.ts ?? 0)
        if (Array.isArray(boot.screens) && boot.screens.length > 0 && Number.isFinite(ageMs) && ageMs <= BOOTSTRAP_MAX_AGE_MS) {
          setProjectName(String(boot.projectName ?? ''))
          setScreens(boot.screens)
          setGlobals((boot.globals ?? {}) as Record<string, unknown>)
          const fallbackScreenId = boot.screens.find((s) => s.slug === 'home')?.id ?? boot.screens[0]?.id ?? null
          setCurrentScreenId(boot.currentScreenId && boot.screens.some((s) => s.id === boot.currentScreenId) ? boot.currentScreenId : fallbackScreenId)
          setStatus('ready')
        }
      }
    } catch {}

    // Warm-start state from cache before network resolves.
    try {
      const stateRaw = localStorage.getItem(stateCacheKey)
      if (stateRaw) {
        const parsed = JSON.parse(stateRaw)
        if (parsed && typeof parsed === 'object') {
          setRuntimeState(parsed as Record<string, unknown>)
        }
      }
    } catch {}

    const ac = new AbortController()

    // Skip runtime data preload when SSR already provided data
    if (!initialData) {
      const preloadRequestId = ++runtimeDataRequestIdRef.current
      const preloadStart = performance.now()
      fetch(`/api/p/${projectId}/data`, { signal: ac.signal, cache: 'no-store' })
        .then(async (r) => {
          const st = parseServerTimingHeader(r.headers.get('server-timing'))
          if (st.total !== undefined) networkPerfRef.current.runtimeServerTotalMs = st.total
          if (st.db !== undefined) networkPerfRef.current.runtimeServerDbMs = st.db
          if (st.api !== undefined) networkPerfRef.current.runtimeServerApiMs = st.api
          if (!r.ok) return null
          return r.json()
        })
        .then((d) => {
          networkPerfRef.current.runtimeFetchMs = performance.now() - preloadStart
          if (preloadRequestId !== runtimeDataRequestIdRef.current) return
          if (d?.data) {
            lastRuntimeVarsSignatureRef.current = ''
            applyRuntimeData(d.data, '')
          }
        })
        .catch(() => {})
    }

    const projectFetchStart = performance.now()
    fetch(`/api/p/${projectId}`, { signal: ac.signal })
      .then(async (r) => {
        networkPerfRef.current.projectFetchMs = performance.now() - projectFetchStart
        const st = parseServerTimingHeader(r.headers.get('server-timing'))
        if (st.total !== undefined) networkPerfRef.current.projectServerTotalMs = st.total
        if (st.db !== undefined) networkPerfRef.current.projectServerDbMs = st.db
        if (r.status === 404) { setStatus('notPublished'); return }
        if (!r.ok) { setStatus('error'); return }
        const data = await r.json()
        const rows: ScreenRow[] = data.screens ?? []
        setProjectName(data.project?.name ?? '')
        setScreens(rows)
        // Inject favicon if project has one
        if (data.project?.faviconUrl) {
          let link = document.querySelector('link[rel~="icon"]') as HTMLLinkElement | null
          if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
          link.href = data.project.faviconUrl
        }
        // The deployed DB may not have the metadata column yet, so the server returns
        // empty globals. Fall back to whatever the browser cached from the editor.
        let resolvedGlobals: Record<string, unknown> = data.globals ?? {}
        const hasGlobals = Object.keys(resolvedGlobals).length > 0
        if (!hasGlobals && typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem(`dccortex:project-globals:${projectId}`)
            if (cached) resolvedGlobals = JSON.parse(cached)
          } catch {}
        }
        setGlobals(resolvedGlobals)
        // Store project seoDefaults in globals for SEO injection
        if (data.project?.seoDefaults) {
          resolvedGlobals = { ...resolvedGlobals, seoDefaults: data.project.seoDefaults }
          setGlobals(resolvedGlobals)
        }
        // Pick home or first screen
        const home = rows.find((s) => s.slug === 'home') ?? rows[0]
        setCurrentScreenId(home?.id ?? null)
        try {
          localStorage.setItem(previewBootstrapCacheKey, JSON.stringify({
            ts: Date.now(),
            projectName: data.project?.name ?? '',
            screens: rows,
            globals: resolvedGlobals,
            currentScreenId: home?.id ?? null,
          }))
        } catch {}
        // Init runtime state from all screen layouts + globals
        const rawGlobalDefs = resolvedGlobals?.globalStateDefinitions
        const stateDefs: StateDefinition[] = [
          ...(Array.isArray(rawGlobalDefs) ? rawGlobalDefs : []),
        ]
        // Also collect screen-level state definitions from layouts
        for (const sc of rows) {
          const lay = sc.layout as any
          const defs: StateDefinition[] = Array.isArray(lay?.stateDefinitions) ? lay.stateDefinitions : []
          for (const d of defs) {
            if (!stateDefs.some((x) => x.name === d.name)) stateDefs.push(d)
          }
        }
        const initial: Record<string, unknown> = {}
        const dateMap = getDateNowMap()
        const resolveDateNow = (val: string) =>
          val.replace(/\{\{dateNow\.(\w+)\}\}/g, (_, key: string) => {
            const v = dateMap[key]
            return v === undefined ? '' : String(v)
          })
        // Collect custom types from all layouts for constructor resolution
        const allCustomTypes: Array<{ name: string; fields: Array<{ name: string; type: string; defaultValue?: string }> }> = []
        for (const sc of rows) {
          const lay = sc.layout as any
          if (Array.isArray(lay?.customTypes)) {
            for (const ct of lay.customTypes) {
              if (ct.name && !allCustomTypes.some((x) => x.name === ct.name)) allCustomTypes.push(ct)
            }
          }
        }
        const resolveConstructor = (val: string): unknown | undefined => {
          const m2 = val.match(/^(\w+)\(\)$/)
          if (!m2) return undefined
          const ct = allCustomTypes.find((c) => c.name === m2[1])
          if (!ct) return undefined
          const obj: Record<string, unknown> = {}
          for (const f of ct.fields) {
            if (!f.name) continue
            const dv = resolveDateNow(f.defaultValue?.trim() ?? '')
            if (f.type === 'number') obj[f.name] = dv ? (Number.isNaN(Number(dv)) ? 0 : Number(dv)) : 0
            else if (f.type === 'boolean') obj[f.name] = dv === 'true' || dv === '1'
            else if (f.type === 'date') obj[f.name] = dv || resolveDateNow('{{dateNow.datetime}}')
            else obj[f.name] = dv
          }
          return obj
        }
        for (const s of stateDefs) {
          if (!s.name?.trim()) continue
          const raw = s.initialValue ?? ''
          const constructed = resolveConstructor(raw)
          if (constructed !== undefined) { initial[s.name] = constructed; continue }
          const v = resolveDateNow(raw)
          const typ = s.type ?? 'string'
          if (typ === 'number') initial[s.name] = Number.isNaN(Number(v)) ? 0 : Number(v)
          else if (typ === 'boolean') initial[s.name] = v === 'true' || v === '1'
          else if (typ === 'date') initial[s.name] = v || resolveDateNow('{{dateNow.datetime}}')
          else initial[s.name] = v
        }
        // Try to restore cached state from previous session
        try {
          const cached = localStorage.getItem(stateCacheKey)
          if (cached) {
            const parsed = JSON.parse(cached)
            // Merge cached values (only for keys that exist in current definitions)
            const merged = { ...initial }
            if (parsed && typeof parsed === 'object') {
              for (const key of Object.keys(initial)) {
                if (key in parsed) merged[key] = parsed[key]
              }
            }
            setRuntimeState(merged)
          } else {
            setRuntimeState(initial)
          }
        } catch {
          setRuntimeState(initial)
        }
        setStatus('ready')
      })
      .catch((e) => { if (e?.name !== 'AbortError') setStatus('error') })
    return () => ac.abort()
  }, [projectId, applyRuntimeData, previewBootstrapCacheKey, stateCacheKey, initialProject, initialData])

  const currentScreen = useMemo(() => screens.find((s) => s.id === currentScreenId) ?? null, [screens, currentScreenId])

  // Extract dataSources for the current screen (carry urlParamBindings)
  const screenDataSources = useMemo(() => {
    const lay = currentScreen?.layout as any
    return (Array.isArray(lay?.dataSources) ? lay.dataSources : []) as Array<{ id: string; name: string; urlParamBindings?: Record<string, string> }>
  }, [currentScreen])

  const runtimeVarsParam = useMemo(() => {
    return buildVarsParamForDataSources(screenDataSources, runtimeState)
  }, [screenDataSources, runtimeState])
  const runtimeSourceStatus = useMemo(() => {
    const pending: string[] = []
    const resolved: string[] = []
    // Track sources listed in the screen layout
    for (const source of screenDataSources) {
      const name = String(source?.name ?? '').trim()
      if (!name) continue
      if (Object.prototype.hasOwnProperty.call(runtimeData, name)) resolved.push(name)
      else pending.push(name)
    }
    // Also include all runtimeData keys as resolved so suspense loading
    // signals work even when the screen layout has an empty dataSources array.
    for (const key of Object.keys(runtimeData)) {
      if (!resolved.includes(key)) resolved.push(key)
    }
    return { pending, resolved }
  }, [screenDataSources, runtimeData])

  // Re-fetch runtime data only when the resolved vars signature changes.
  // First fetch is immediate; subsequent state-driven refreshes are lightly debounced.
  // This avoids work for unrelated state updates.
  useEffect(() => {
    if (status !== 'ready') return
    const varsParam = runtimeVarsParam
    const varsSignature = runtimeVarsParam || ''
    if (hasFetchedRuntimeDataRef.current && lastRuntimeVarsSignatureRef.current === varsSignature) return

    const cached = runtimeDataMemoryCacheRef.current.get(varsSignature)
    if (cached) {
      setRuntimeData((prev) => (shallowEqualRecord(prev, cached) ? prev : cached))
    } else {
      const persisted = readSignatureCacheEntry(varsSignature)
      if (persisted) {
        runtimeDataMemoryCacheRef.current.set(varsSignature, persisted)
        setRuntimeData((prev) => (shallowEqualRecord(prev, persisted) ? prev : persisted))
      }
    }

    const ac = new AbortController()
    const requestId = ++runtimeDataRequestIdRef.current
    const delayMs = hasFetchedRuntimeDataRef.current ? 120 : 0
    const timer = setTimeout(() => {
      const fetchStart = performance.now()
      fetch(`/api/p/${projectId}/data${varsParam}`, { signal: ac.signal, cache: 'no-store' })
        .then(async (r) => {
          const st = parseServerTimingHeader(r.headers.get('server-timing'))
          if (st.total !== undefined) networkPerfRef.current.runtimeServerTotalMs = st.total
          if (st.db !== undefined) networkPerfRef.current.runtimeServerDbMs = st.db
          if (st.api !== undefined) networkPerfRef.current.runtimeServerApiMs = st.api
          if (!r.ok) return null
          return r.json()
        })
        .then((d) => {
          networkPerfRef.current.runtimeFetchMs = performance.now() - fetchStart
          if (requestId !== runtimeDataRequestIdRef.current) return
          if (!d?.data) return
          lastRuntimeVarsSignatureRef.current = varsSignature
          applyRuntimeData(d.data, varsSignature)
        })
        .catch(() => {})
    }, delayMs)
    return () => { clearTimeout(timer); ac.abort() }
  }, [status, projectId, runtimeVarsParam, applyRuntimeData, readSignatureCacheEntry])

  // Realtime polling for data sources that have realtime: true
  useEffect(() => {
    if (status !== 'ready') return
    const realtimeSources = screenDataSources.filter((ds: any) => ds.realtime)
    if (realtimeSources.length === 0) return
    const interval = Math.max(500, Math.min(...realtimeSources.map((ds: any) => ds.realtimeInterval ?? 3000)))
    const ac = new AbortController()
    const poll = setInterval(() => {
      const requestId = ++runtimeDataRequestIdRef.current
      fetch(`/api/p/${projectId}/data`, { signal: ac.signal, cache: 'no-store' })
        .then(async (r) => {
          const st = parseServerTimingHeader(r.headers.get('server-timing'))
          if (st.total !== undefined) networkPerfRef.current.runtimeServerTotalMs = st.total
          if (st.db !== undefined) networkPerfRef.current.runtimeServerDbMs = st.db
          if (st.api !== undefined) networkPerfRef.current.runtimeServerApiMs = st.api
          if (!r.ok) return null
          return r.json()
        })
        .then((d) => {
          if (requestId !== runtimeDataRequestIdRef.current) return
          if (d?.data) applyRuntimeData(d.data)
        })
        .catch(() => {})
    }, interval)
    return () => { clearInterval(poll); ac.abort() }
  }, [status, projectId, screenDataSources, applyRuntimeData])

  // SEO: update document.title and meta tags when screen changes
  const projectSeoDefaults = useMemo(() => {
    const g = globals as any
    return (g?.seoDefaults ?? {}) as Record<string, string>
  }, [globals])

  useEffect(() => {
    if (status !== 'ready' || !currentScreen) return
    const lay = currentScreen.layout as any
    const screenSeo = (lay?.seoSettings ?? {}) as Record<string, string>
    const screenName = currentScreen.name ?? ''
    const resolve = (t?: string) => (t ?? '').replace('{{screenName}}', screenName).replace('{{projectName}}', projectName)

    const title = resolve(screenSeo.title ?? projectSeoDefaults.title) || `${screenName} — ${projectName}`
    document.title = title

    const setMeta = (name: string, content: string, useProperty = false) => {
      const sel = useProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`
      let el = document.querySelector(sel) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        if (useProperty) el.setAttribute('property', name)
        else el.setAttribute('name', name)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }
    const desc = resolve(screenSeo.description ?? projectSeoDefaults.description)
    if (desc) setMeta('description', desc)
    const ogTitle = resolve(screenSeo.ogTitle ?? screenSeo.title ?? projectSeoDefaults.title) || title
    setMeta('og:title', ogTitle, true)
    const ogDesc = resolve(screenSeo.ogDescription ?? screenSeo.description ?? projectSeoDefaults.description)
    if (ogDesc) setMeta('og:description', ogDesc, true)
    const ogImage = screenSeo.ogImage ?? projectSeoDefaults.ogImage ?? ''
    if (ogImage) setMeta('og:image', ogImage, true)
    const robots = screenSeo.robots ?? projectSeoDefaults.robots ?? 'index,follow'
    setMeta('robots', robots)
    // canonical
    const canonical = screenSeo.canonical
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
      if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link) }
      link.href = canonical
    }
    // custom head
    const customHead = screenSeo.customHead
    if (customHead) {
      const existing = document.getElementById('dccortex-custom-head')
      if (existing) existing.remove()
      const el = document.createElement('div')
      el.id = 'dccortex-custom-head'
      el.innerHTML = customHead
      document.head.appendChild(el)
    }
  }, [currentScreen?.id, status, projectName, projectSeoDefaults])

  const reusablesById = useMemo(() => {
    const rawReusables = globals.globalReusables
    const reusables = Array.isArray(rawReusables) ? rawReusables as ReusableDefinition[] : []
    return new Map(reusables.map((r) => [r.id, r]))
  }, [globals])

  const namedScripts = useMemo(() => {
    const layout = currentScreen?.layout as any
    return (layout?.namedScripts ?? {}) as Record<string, string>
  }, [currentScreen])

  const runScript = useCallback((scriptName: string): unknown => {
    const body = namedScripts[scriptName]
    if (!body || typeof body !== 'string') return undefined
    try {
      const fn = new Function('state', 'data', 'return (' + body.trim() + ')')
      return fn(runtimeState, runtimeData)
    } catch { return undefined }
  }, [namedScripts, runtimeState])

  const resolveBindingFn = useCallback(
    (raw: string, propsCtx?: Record<string, unknown>) => {
      const t0 = performance.now()
      const out = resolveExpression(raw, { state: runtimeState, data: runtimeData, runScript, props: propsCtx })
      const dt = performance.now() - t0
      resolvePerfRef.current.calls += 1
      resolvePerfRef.current.totalMs += dt
      if (dt > resolvePerfRef.current.maxMs) resolvePerfRef.current.maxMs = dt
      return out
    },
    [runtimeState, runtimeData, runScript]
  )

  const handleCanvasProfilerRender = useCallback((
    _id: string,
    _phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number
  ) => {
    renderPerfRef.current.commits += 1
    renderPerfRef.current.totalMs += actualDuration
    if (actualDuration > renderPerfRef.current.maxMs) renderPerfRef.current.maxMs = actualDuration
  }, [])

  const stateTypeByKey = useMemo(() => {
    const m: Record<string, 'string' | 'number' | 'boolean'> = {}
    const globalDefs = Array.isArray(globals.globalStateDefinitions) ? globals.globalStateDefinitions as StateDefinition[] : []
    const localDefs = Array.isArray((currentScreen?.layout as any)?.stateDefinitions) ? (currentScreen?.layout as any).stateDefinitions as StateDefinition[] : []
    for (const s of [...globalDefs, ...localDefs]) {
      if (s.name?.trim()) m[s.name] = (s.type ?? 'string') as 'string' | 'number' | 'boolean'
    }
    return m
  }, [globals, currentScreen])

  const handleRunEvent = useCallback((config: EventActionConfig, eventCtx?: EventRuntimeContext) => {
    const action = String((config as { action?: string }).action ?? '')
    const setStateValue = (key: string, value: unknown) => {
      setRuntimeState((prev) => ({ ...prev, [key]: value }))
    }

    if ((action === 'setState' || action === 'setGlobalState') && config.stateKey) {
      const key = config.stateKey
      const rawValue = (config.value ?? '').trim()
      const exactSelf = `{{state.${key}}}`
      const normalized = rawValue.replace(/\s+/g, ' ').trim()
      const isIncrement = normalized === exactSelf || normalized === `${exactSelf} + 1` || normalized === `${exactSelf}+ 1` || normalized === `${exactSelf} +1` || normalized === `${exactSelf}+1`
      if (isIncrement) {
        setRuntimeState((prev) => {
          if (!evaluateEventCondition(config.condition, prev, eventCtx)) return prev
          const n = Number(prev[key])
          const newState = { ...prev, [key]: Number.isNaN(n) ? 1 : n + 1 }
          if (config.cacheValue) {
            try { localStorage.setItem(`dccortex:state-cache:${projectId}`, JSON.stringify(newState)) } catch {}
          }
          return newState
        })
        return
      }
      setRuntimeState((prev) => {
        if (!evaluateEventCondition(config.condition, prev, eventCtx)) return prev
        const resolved = resolveExpression(rawValue, { state: prev, event: eventCtx as Record<string, unknown> | undefined, runScript })
        const typ = stateTypeByKey[key] ?? 'string'
        let value: unknown = resolved
        if (typ === 'number') { const n = Number(resolved); value = Number.isNaN(n) ? 0 : n }
        else if (typ === 'boolean') { value = resolved === 'true' || resolved === '1' || resolved.toLowerCase() === 'yes' }
        const newState = { ...prev, [key]: value }
        if (config.cacheValue) {
          try { localStorage.setItem(`dccortex:state-cache:${projectId}`, JSON.stringify(newState)) } catch {}
        }
        return newState
      })
      return
    }
    if (action === 'mutateState' && config.stateKey) {
      const key = config.stateKey
      const op = (config as any).mutationOp ?? 'increment'
      const amt = (config as any).mutationAmount ?? '1'
      setRuntimeState((prev) => {
        if (!evaluateEventCondition(config.condition, prev, eventCtx)) return prev
        const current = prev[key]
        let value: unknown = current
        if (op === 'increment') {
          const n = Number(current)
          value = Number.isNaN(n) ? 1 : n + 1
        } else if (op === 'decrement') {
          const n = Number(current)
          value = Number.isNaN(n) ? -1 : n - 1
        } else if (op === 'toggle') {
          value = current === true || current === 'true' ? false : true
        } else if (op === 'multiply') {
          const n = Number(current)
          const m = Number(amt)
          value = Number.isNaN(n) || Number.isNaN(m) ? 0 : n * m
        } else if (op === 'append') {
          value = String(current ?? '') + String(amt ?? '')
        }
        const newState = { ...prev, [key]: value }
        if (config.cacheValue) {
          try { localStorage.setItem(`dccortex:state-cache:${projectId}`, JSON.stringify(newState)) } catch {}
        }
        return newState
      })
      return
    }
    if (action === 'runScript') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      if (config.scriptName && config.scriptName !== '__inline__') { runScript(config.scriptName); return }
      if (config.customScript?.trim()) {
        try {
          const fn = new Function('state', 'event', 'data', 'setState', 'setGlobalState', 'alert', 'log', config.customScript)
          fn(
            runtimeState,
            eventCtx ?? {},
            runtimeData,
            (key: string, value: unknown) => setStateValue(String(key), value),
            (key: string, value: unknown) => setStateValue(String(key), value),
            (msg: unknown) => window.alert(String(msg ?? '')),
            (...args: unknown[]) => console.log('[CustomScript]', ...args)
          )
        } catch {}
      }
      return
    }
    if (action === 'navigate') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const compatConfig = config as EventActionConfig & { screenId?: string; screen?: string; slug?: string; id?: string }
      const rawTarget =
        config.targetScreenId?.trim()
        || compatConfig.screenId?.trim()
        || compatConfig.screen?.trim()
        || compatConfig.slug?.trim()
        || compatConfig.id?.trim()
      if (rawTarget) {
        const targetScreen = screens.find((s) => s.id === rawTarget)
          ?? screens.find((s) => s.slug === rawTarget)
          ?? screens.find((s) => s.name.toLowerCase() === rawTarget.toLowerCase())
        const targetId = targetScreen?.id
        if (!targetId) {
          console.warn('[PreviewApp] Ignoring invalid navigation target:', rawTarget)
          return
        }
        if (currentScreenId) screenHistoryRef.current.push(currentScreenId)
        setCurrentScreenId(targetId)
        return
      }
      const url = resolveBinding(config.url ?? '', { state: runtimeState, event: eventCtx as Record<string, unknown> | undefined })
      if (url) window.open(url, '_blank')
      return
    }
    if (action === 'goBack') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const prev = screenHistoryRef.current.pop()
      if (prev) setCurrentScreenId(prev)
      return
    }
    if (action === 'uploadFile') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const files = eventCtx?.value as FileList | null
      if (!files || files.length === 0) return
      const stateKey = (config as any).uploadStateKey?.trim()
      if (!stateKey) return
      const loadingKey = (config as any).uploadLoadingStateKey?.trim()
      const endpoint = (config as any).uploadUrl?.trim() || `/api/p/${projectId}/assets`
      const isLocalAssets = !(config as any).uploadUrl?.trim()
      if (loadingKey) setRuntimeState((prev) => ({ ...prev, [loadingKey]: true }))
      ;(async () => {
        try {
          const urls: string[] = []
          for (const file of Array.from(files)) {
            const fd = new FormData()
            fd.append('file', file)
            const res = await fetch(endpoint, { method: 'POST', body: fd })
            if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
            const json = await res.json()
            const url = isLocalAssets ? json?.asset?.url : (json?.url ?? json?.asset?.url ?? json?.Location ?? json?.location ?? '')
            if (url) urls.push(url)
          }
          const result = files.length === 1 ? (urls[0] ?? '') : urls
          setRuntimeState((prev) => ({ ...prev, [stateKey]: result }))
        } catch {
          setRuntimeState((prev) => ({ ...prev, [stateKey]: '' }))
        } finally {
          if (loadingKey) setRuntimeState((prev) => ({ ...prev, [loadingKey]: false }))
        }
      })()
      return
    }
    if (action === 'custom' && config.customScript?.trim()) {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      try {
        const fn = new Function('state', 'event', 'data', 'setState', 'setGlobalState', 'alert', 'log', config.customScript)
        fn(
          runtimeState,
          eventCtx ?? {},
          runtimeData,
          (key: string, value: unknown) => setStateValue(String(key), value),
          (key: string, value: unknown) => setStateValue(String(key), value),
          (msg: unknown) => window.alert(String(msg ?? '')),
          (...args: unknown[]) => console.log('[CustomScript]', ...args)
        )
      } catch {}
    }

    if (action === 'alert') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const msg = resolveBinding(config.message ?? '', { state: runtimeState, event: eventCtx as Record<string, unknown> | undefined })
      window.alert(msg)
      return
    }

    if (action === 'log') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const msg = resolveBinding(config.message ?? '', { state: runtimeState, event: eventCtx as Record<string, unknown> | undefined })
      console.log('[Log]', msg)
      return
    }

    if (action === 'haptic') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const preset = config.hapticPreset ?? 'medium'
      try {
        if (preset === 'custom' && config.hapticCustom?.trim()) {
          const parsed = JSON.parse(config.hapticCustom)
          triggerHaptic(parsed)
        } else {
          triggerHaptic(preset)
        }
      } catch { triggerHaptic('medium') }
      return
    }

    if (action === 'speak') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const text = resolveBinding(config.speakText ?? '', { state: runtimeState, event: eventCtx as Record<string, unknown> | undefined })
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utt = new SpeechSynthesisUtterance(text)
        if (config.speakRate) utt.rate = parseFloat(config.speakRate) || 1
        if (config.speakPitch) utt.pitch = parseFloat(config.speakPitch) || 1
        window.speechSynthesis.speak(utt)
      }
      return
    }

    if (action === 'playAudio') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const url = resolveBinding(config.audioUrl ?? '', { state: runtimeState, event: eventCtx as Record<string, unknown> | undefined })
      if (url) {
        try { new Audio(url).play() } catch {}
      }
      return
    }

    // ── CRUD actions: insertRow / updateRow / deleteRow ──────────────────
    if (action === 'insertRow' || action === 'updateRow' || action === 'deleteRow') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const tbl = resolveBinding(config.tableName ?? '', { state: runtimeState, event: eventCtx as Record<string, unknown> | undefined })
      if (!tbl) return
      const rowId = config.rowId ? resolveBinding(config.rowId, { state: runtimeState, event: eventCtx as Record<string, unknown> | undefined }) : undefined
      let rowData: Record<string, unknown> | undefined
      if (config.rowData) {
        const resolved = resolveExpression(config.rowData, { state: runtimeState, data: runtimeData, event: eventCtx as Record<string, unknown> | undefined, runScript })
        try { rowData = typeof resolved === 'string' ? JSON.parse(resolved) : resolved as Record<string, unknown> } catch { rowData = undefined }
      }
      ;(async () => {
        try {
          const res = await fetch(`/api/p/${projectId}/data/mutate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, table: tbl, data: rowData, rowId }),
          })
          const json = await res.json()
          if (config.resultStateKey) {
            setRuntimeState((prev) => ({ ...prev, [config.resultStateKey!]: json.ok ? (json.row ?? json.deleted ?? true) : false }))
          }
          // Auto-refresh data after mutation
          if (config.refreshStateKey) {
            setRuntimeState((prev) => ({ ...prev, [config.refreshStateKey!]: (Number(prev[config.refreshStateKey!]) || 0) + 1 }))
          }
          // Always trigger a data re-fetch so bindings update
          const requestId = ++runtimeDataRequestIdRef.current
          fetch(`/api/p/${projectId}/data`, { cache: 'no-store' })
            .then((r) => r.ok ? r.json() : null)
            .then((d) => {
              if (requestId !== runtimeDataRequestIdRef.current) return
              if (d?.data) applyRuntimeData(d.data)
            })
            .catch(() => {})
        } catch (err) {
          console.error(`[CRUD ${action}] Error:`, err)
        }
      })()
      return
    }

    if (action) {
      console.warn('[PreviewApp] Unsupported event action:', action, config)
    }
  }, [stateTypeByKey, runScript, runtimeState, runtimeData, triggerHaptic, currentScreenId, projectId, screens, applyRuntimeData])

  const theme = useMemo(() => {
    const globalTheme = (globals.globalTheme ?? {}) as Record<string, string> & { colorMode?: string; customCss?: string }
    const screenTheme = ((currentScreen?.layout as any)?.theme ?? {}) as Record<string, string> & { colorMode?: string; customCss?: string }
    return { ...globalTheme, ...screenTheme }
  }, [globals, currentScreen])

  const fullRadius = useMemo(() => {
    const raw = String(theme.borderRadius ?? '').trim().toLowerCase()
    if (raw === '0' || raw === '0px' || raw === '0rem' || raw === '0em' || raw === '0%') return '0px'
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) && parsed === 0 ? '0px' : '9999px'
  }, [theme.borderRadius])

  const canvasRoot = useMemo((): Node | null => {
    if (!currentScreen) return null
    const lay = currentScreen.layout as any
    return (lay?.root ?? lay ?? null) as Node | null
  }, [currentScreen])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-500 animate-spin" />
      </div>
    )
  }

  if (status === 'notPublished') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-semibold text-gray-800 mb-2">404</div>
          <div className="text-gray-500 text-sm">This app is not published.</div>
        </div>
      </div>
    )
  }

  if (status === 'error' || !canvasRoot) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-800 font-medium mb-2">Unable to load app</div>
          <button type="button" onClick={() => window.location.reload()} className="text-sm text-blue-600 underline">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div
      data-desktop-runtime={isDesktopShell ? 'true' : undefined}
      className={`h-full flex flex-col overflow-y-auto ${
        theme.colorMode === 'dark' || (theme.colorMode === 'adaptive' && systemDark) ? 'dark' : ''
      }`}
      onDragStartCapture={(e) => {
        if (!isDesktopShell) return
        const target = e.target as HTMLElement | null
        if (!target) return
        if (target.closest('input, textarea, select, option, [contenteditable="true"], [draggable="true"], [data-allow-native-drag="true"]')) return
        e.preventDefault()
      }}
      style={{
        '--primary': theme.primary ?? '#2563eb',
        '--background': theme.background ?? '#ffffff',
        '--text': theme.text ?? '#1f2937',
        '--surface': theme.surface ?? '#f9fafb',
        '--border-color': theme.borderColor ?? '#e5e7eb',
        '--radius': theme.borderRadius ?? '8px',
        '--radius-sm': theme.borderRadiusSm ?? '4px',
        '--radius-lg': theme.borderRadiusLg ?? '12px',
        '--border-radius': theme.borderRadius ?? '8px',
        '--border-radius-sm': theme.borderRadiusSm ?? '4px',
        '--border-radius-lg': theme.borderRadiusLg ?? '12px',
        '--border-radius-full': fullRadius,
        backgroundColor: theme.background ?? '#ffffff',
        color: theme.text ?? '#1f2937',
      } as React.CSSProperties}
    >
      {theme.customCss && <style dangerouslySetInnerHTML={{ __html: theme.customCss }} />}
      <Profiler id="live-canvas" onRender={handleCanvasProfilerRender}>
        <BuilderCanvas
          root={canvasRoot}
          selectedId={null}
          onSelect={() => {}}
          onUpdate={() => {}}
          previewMode={true}
          resolveBinding={resolveBindingFn}
          theme={theme as any}
          onMove={() => {}}
          onRunEvent={handleRunEvent}
          reusables={Array.from(reusablesById.values())}
          runtimePendingSources={runtimeSourceStatus.pending}
          runtimeResolvedSources={runtimeSourceStatus.resolved}
        />
      </Profiler>
      {showPerfHud && (
        <div
          style={{
            position: 'fixed',
            right: 8,
            bottom: 8,
            zIndex: 9999,
            background: 'rgba(17, 24, 39, 0.88)',
            color: '#f9fafb',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11,
            lineHeight: 1.35,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.18)',
            minWidth: 240,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Live Perf</div>
          <div>project fetch: {livePerf.projectFetchMs}ms</div>
          <div>project server total/db: {livePerf.projectServerTotalMs}ms / {livePerf.projectServerDbMs}ms</div>
          <div>runtime fetch: {livePerf.runtimeFetchMs}ms</div>
          <div>runtime server total/db/api: {livePerf.runtimeServerTotalMs}ms / {livePerf.runtimeServerDbMs}ms / {livePerf.runtimeServerApiMs}ms</div>
          <div>prefetch fetch: {livePerf.prefetchFetchMs}ms</div>
          <div>resolve: {livePerf.resolveCallsPerSec}/s avg {livePerf.resolveAvgMs}ms max {livePerf.resolveMaxMs}ms</div>
          <div>render: {livePerf.renderCommitsPerSec}/s avg {livePerf.renderAvgMs}ms max {livePerf.renderMaxMs}ms</div>
        </div>
      )}
      <button
        type="button"
        onClick={handleManualRefresh}
        disabled={isRefreshing}
        title="Force refresh runtime data immediately (default cache: 15s)"
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 9998,
          width: 44,
          height: 44,
          padding: 10,
          borderRadius: 8,
          border: '1px solid rgba(0, 0, 0, 0.15)',
          backgroundColor: '#ffffff',
          color: '#1f2937',
          cursor: isRefreshing ? 'not-allowed' : 'pointer',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isRefreshing ? 0.6 : 1,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!isRefreshing) {
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
            e.currentTarget.style.backgroundColor = '#f3f4f6'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.12)'
          e.currentTarget.style.backgroundColor = '#ffffff'
        }}
      >
        <RefreshCw size={20} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </button>
    </div>
  )
}
