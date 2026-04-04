/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useWebHaptics } from 'web-haptics/react'
import { BuilderCanvas } from '@/components/builder/BuilderCanvas'
import { resolveBinding, resolveExpression, getDateNowMap } from '@/components/builder/bindingResolver'
import type { EventActionConfig, EventRuntimeContext } from '@/components/builder/eventHelpers'
import type { Node } from '@/components/builder/registry'
import type { ReusableDefinition } from '@/components/builder/globals'

type ScreenRow = { id: string; name: string; slug: string; layout: unknown; script?: string | null; sortOrder: number }
type StateDefinition = { id: string; name: string; initialValue: string; type?: string }

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

export default function PreviewApp({ projectId }: { projectId: string }) {
  const [isDesktopShell, setIsDesktopShell] = useState(false)
  const [status, setStatus] = useState<'loading' | 'notPublished' | 'error' | 'ready'>('loading')
  const [projectName, setProjectName] = useState('')
  const [screens, setScreens] = useState<ScreenRow[]>([])
  const [globals, setGlobals] = useState<Record<string, unknown>>({})
  const [currentScreenId, setCurrentScreenId] = useState<string | null>(null)
  const screenHistoryRef = useRef<string[]>([])
  const [runtimeState, setRuntimeState] = useState<Record<string, unknown>>({})
  const [runtimeData, setRuntimeData] = useState<Record<string, unknown>>({})
  const { trigger: triggerHaptic } = useWebHaptics()
  const [systemDark, setSystemDark] = useState(false)
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
    const ac = new AbortController()
    fetch(`/api/p/${projectId}`, { signal: ac.signal })
      .then(async (r) => {
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
          const cacheKey = `dccortex:state-cache:${projectId}`
          const cached = localStorage.getItem(cacheKey)
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
        // Fetch runtime data (API sources + internal DB tables) in background
        fetch(`/api/p/${projectId}/data`, { signal: ac.signal })
          .then((r) => r.ok ? r.json() : null)
          .then((d) => { if (d?.data) setRuntimeData(d.data) })
          .catch(() => {/* data fetch failure is non-fatal */})
      })
      .catch((e) => { if (e?.name !== 'AbortError') setStatus('error') })
    return () => ac.abort()
  }, [projectId])

  const currentScreen = useMemo(() => screens.find((s) => s.id === currentScreenId) ?? null, [screens, currentScreenId])

  // Extract dataSources for the current screen (carry urlParamBindings)
  const screenDataSources = useMemo(() => {
    const lay = currentScreen?.layout as any
    return (Array.isArray(lay?.dataSources) ? lay.dataSources : []) as Array<{ id: string; name: string; urlParamBindings?: Record<string, string> }>
  }, [currentScreen])

  // Re-fetch runtime data when screen or state changes (debounced 400ms)
  // Builds a vars param so {{param}} templates resolve against live state
  useEffect(() => {
    if (status !== 'ready') return
    const vars: Record<string, Record<string, string>> = {}
    for (const ds of screenDataSources) {
      if (!ds.urlParamBindings) continue
      const resolved: Record<string, string> = {}
      for (const [paramName, binding] of Object.entries(ds.urlParamBindings)) {
        if (!binding) continue
        const stateMatch = binding.match(/^\{\{state\.([^}]+)\}\}$/)
        if (stateMatch) {
          const val = runtimeState[stateMatch[1]]
          if (val !== undefined && val !== null) resolved[paramName] = String(val)
        } else {
          resolved[paramName] = binding
        }
      }
      if (Object.keys(resolved).length) vars[ds.name] = resolved
    }
    const varsParam = Object.keys(vars).length ? `?vars=${encodeURIComponent(JSON.stringify(vars))}` : ''
    const ac = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/p/${projectId}/data${varsParam}`, { signal: ac.signal })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d?.data) setRuntimeData(d.data) })
        .catch(() => {})
    }, 400)
    return () => { clearTimeout(timer); ac.abort() }
  }, [status, projectId, screenDataSources, runtimeState])

  // Realtime polling for data sources that have realtime: true
  useEffect(() => {
    if (status !== 'ready') return
    const realtimeSources = screenDataSources.filter((ds: any) => ds.realtime)
    if (realtimeSources.length === 0) return
    const interval = Math.max(500, Math.min(...realtimeSources.map((ds: any) => ds.realtimeInterval ?? 3000)))
    const ac = new AbortController()
    const poll = setInterval(() => {
      fetch(`/api/p/${projectId}/data`, { signal: ac.signal })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d?.data) setRuntimeData(d.data) })
        .catch(() => {})
    }, interval)
    return () => { clearInterval(poll); ac.abort() }
  }, [status, projectId, screenDataSources])

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
    (raw: string, propsCtx?: Record<string, unknown>) =>
      resolveExpression(raw, { state: runtimeState, data: runtimeData, runScript, props: propsCtx }),
    [runtimeState, runtimeData, runScript]
  )

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
          fetch(`/api/p/${projectId}/data`)
            .then((r) => r.ok ? r.json() : null)
            .then((d) => { if (d?.data) setRuntimeData(d.data) })
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
  }, [stateTypeByKey, runScript, runtimeState, runtimeData, triggerHaptic, currentScreenId, projectId, screens])

  const theme = useMemo(() => (globals.globalTheme ?? {}) as Record<string, string> & { colorMode?: string; customCss?: string }, [globals])

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
        backgroundColor: theme.background ?? '#ffffff',
        color: theme.text ?? '#1f2937',
      } as React.CSSProperties}
    >
      {theme.customCss && <style dangerouslySetInnerHTML={{ __html: theme.customCss }} />}
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
      />
    </div>
  )
}
