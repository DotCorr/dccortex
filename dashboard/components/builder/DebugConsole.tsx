/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { resolveExpression } from './bindingResolver'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogLevel = 'event' | 'state' | 'log' | 'error' | 'warn'

export type LogEntry = {
  id: number
  ts: number
  level: LogLevel
  label: string
  detail?: string
}

export type DebugConsoleHandle = {
  push: (entry: Omit<LogEntry, 'id' | 'ts'>) => void
}

export type ApiLogEntry = {
  id: number
  ts: number
  source: 'axios' | 'fetch'
  method: string
  url: string
  status?: number
  ok: boolean
  durationMs?: number
  request?: unknown
  response?: unknown
  error?: string
}

type ApiRequestShape = {
  headers?: unknown
  body?: unknown
  data?: unknown
  params?: unknown
}

type ApiFilterPreset = {
  id: string
  name: string
  search: string
  method: 'all' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD'
  status: 'all' | 'ok' | 'error' | '2xx' | '3xx' | '4xx' | '5xx'
  pinnedOnly: boolean
  ignorePaths: string
}

type JsonViewerState = {
  title: string
  value: unknown
} | null

let _entryId = 0

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  runtimeState: Record<string, unknown>
  stateDefinitions: Array<{ name: string }>
  inspection?: { nodeId: string; html: string } | null
  apiLogs?: ApiLogEntry[]
  /** Ref that callers use to push log entries */
  handleRef?: (h: DebugConsoleHandle) => void
  /** Optional browser storage key to persist console UI state. */
  storageKey?: string
}

const LEVEL_COLOR: Record<LogLevel, string> = {
  event: 'text-blue-500 dark:text-blue-400',
  state: 'text-purple-500 dark:text-purple-400',
  log:   'text-gray-700 dark:text-gray-300',
  warn:  'text-amber-500 dark:text-amber-400',
  error: 'text-red-500 dark:text-red-400',
}
const LEVEL_BG: Record<LogLevel, string> = {
  event: 'bg-blue-50 dark:bg-blue-900/20',
  state: 'bg-purple-50 dark:bg-purple-900/20',
  log:   '',
  warn:  'bg-amber-50 dark:bg-amber-900/20',
  error: 'bg-red-50 dark:bg-red-900/20',
}

type Tab = 'log' | 'state' | 'repl' | 'inspect' | 'api'

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])

function formatJson(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function pinKeyForApi(entry: ApiLogEntry): string {
  return `${entry.method.toUpperCase()} ${entry.url}`
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const raw = value.trim()
  if (!raw) return value
  if (!(raw.startsWith('{') || raw.startsWith('['))) return value
  try {
    return JSON.parse(raw)
  } catch {
    return value
  }
}

function parseIgnoreRules(text: string): { exactRules: string[][]; anyKeyRules: Set<string> } {
  const parts = String(text ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const exactRules: string[][] = []
  const anyKeyRules = new Set<string>()
  for (const part of parts) {
    const normalized = part.replace(/^\$\.?/, '')
    const segs = normalized.split('.').map((s) => s.trim()).filter(Boolean)
    if (!segs.length) continue
    if (segs.length === 1 && segs[0] !== '*') anyKeyRules.add(segs[0])
    exactRules.push(segs)
  }
  return { exactRules, anyKeyRules }
}

function pathMatchesRule(path: string[], rule: string[]): boolean {
  if (path.length !== rule.length) return false
  for (let i = 0; i < rule.length; i++) {
    if (rule[i] === '*') continue
    if (rule[i] !== path[i]) return false
  }
  return true
}

function stripIgnoredPaths(value: unknown, rules: { exactRules: string[][]; anyKeyRules: Set<string> }, path: string[] = []): unknown {
  if (value == null || typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map((item, idx) => stripIgnoredPaths(item, rules, [...path, String(idx)]))
  }

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = [...path, k]
    if (rules.anyKeyRules.has(k)) continue
    if (rules.exactRules.some((rule) => pathMatchesRule(nextPath, rule))) continue
    out[k] = stripIgnoredPaths(v, rules, nextPath)
  }
  return out
}

function JsonTreeNode({ name, value, depth = 0 }: { name?: string; value: unknown; depth?: number }) {
  const isObj = value != null && typeof value === 'object'
  if (!isObj) {
    const primitive = value === undefined ? 'undefined' : value === null ? 'null' : String(value)
    const color = value === null || value === undefined
      ? 'text-gray-500'
      : typeof value === 'number'
        ? 'text-blue-600 dark:text-blue-400'
        : typeof value === 'boolean'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-green-700 dark:text-green-400'
    return (
      <div className="pl-2" style={{ paddingLeft: `${depth * 12}px` }}>
        {name != null && <span className="text-purple-600 dark:text-purple-400">{name}: </span>}
        <span className={color}>{primitive}</span>
      </div>
    )
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>)

  return (
    <details open={depth < 2} className="pl-2" style={{ paddingLeft: `${depth * 12}px` }}>
      <summary className="cursor-pointer text-gray-700 dark:text-gray-200">
        {name != null ? <span className="text-purple-600 dark:text-purple-400">{name}: </span> : null}
        <span>{Array.isArray(value) ? `Array(${entries.length})` : `Object(${entries.length})`}</span>
      </summary>
      <div className="mt-1 space-y-0.5">
        {entries.map(([k, v]) => (
          <JsonTreeNode key={k} name={k} value={v} depth={depth + 1} />
        ))}
      </div>
    </details>
  )
}

function formatHtmlForInspect(rawHtml: string): string {
  const source = String(rawHtml ?? '').trim()
  if (!source) return ''
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(source, 'text/html')
    const root = doc.body.firstElementChild
    if (!root) return source

    const out: string[] = []
    const indent = (depth: number) => '  '.repeat(depth)
    const attrsToString = (el: Element) => {
      const names = el.getAttributeNames()
      if (!names.length) return ''
      return names.map((name) => ` ${name}="${el.getAttribute(name) ?? ''}"`).join('')
    }

    const walk = (el: Element, depth: number) => {
      const tag = el.tagName.toLowerCase()
      const attrs = attrsToString(el)
      const kids = Array.from(el.childNodes)
      const onlyText = kids.length === 1 && kids[0].nodeType === Node.TEXT_NODE
      const textValue = onlyText ? (kids[0].textContent ?? '').trim() : ''
      if (onlyText && textValue) {
        out.push(`${indent(depth)}<${tag}${attrs}>${textValue}</${tag}>`)
        return
      }
      if (!kids.length && VOID_TAGS.has(tag)) {
        out.push(`${indent(depth)}<${tag}${attrs} />`)
        return
      }
      out.push(`${indent(depth)}<${tag}${attrs}>`)
      for (const kid of kids) {
        if (kid.nodeType === Node.ELEMENT_NODE) {
          walk(kid as Element, depth + 1)
        } else if (kid.nodeType === Node.TEXT_NODE) {
          const text = (kid.textContent ?? '').trim()
          if (text) out.push(`${indent(depth + 1)}${text}`)
        }
      }
      out.push(`${indent(depth)}</${tag}>`)
    }

    walk(root, 0)
    return out.join('\n')
  } catch {
    return source
  }
}

function highlightHtmlLine(line: string) {
  const leading = line.match(/^\s*/)?.[0] ?? ''
  const trimmed = line.slice(leading.length)

  if (!trimmed.startsWith('<')) {
    return (
      <>
        <span>{leading}</span>
        <span className="text-gray-700 dark:text-gray-300">{trimmed}</span>
      </>
    )
  }

  if (trimmed.startsWith('<!--')) {
    return (
      <>
        <span>{leading}</span>
        <span className="text-gray-500 dark:text-gray-400">{trimmed}</span>
      </>
    )
  }

  const bracketOpen = trimmed.startsWith('</') ? '</' : '<'
  const closeBracket = trimmed.endsWith('/>') ? '/>' : '>'
  const inner = trimmed.slice(bracketOpen.length, trimmed.length - closeBracket.length).trim()
  const match = inner.match(/^([a-zA-Z0-9:-]+)(.*)$/)
  if (!match) {
    return (
      <>
        <span>{leading}</span>
        <span className="text-gray-700 dark:text-gray-300">{trimmed}</span>
      </>
    )
  }
  const tagName = match[1]
  const attrChunk = (match[2] ?? '').trim()
  const attrs: Array<{ name: string; value?: string }> = []
  const attrRe = /([^\s=\/>"]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g
  let m: RegExpExecArray | null
  while ((m = attrRe.exec(attrChunk)) !== null) {
    attrs.push({ name: m[1], value: m[2] })
  }

  return (
    <>
      <span>{leading}</span>
      <span className="text-gray-500 dark:text-gray-400">{bracketOpen}</span>
      <span className="text-blue-600 dark:text-blue-400">{tagName}</span>
      {attrs.map((a, idx) => (
        <span key={`${a.name}-${idx}`}>
          <span> </span>
          <span className="text-amber-600 dark:text-amber-400">{a.name}</span>
          {a.value != null && (
            <>
              <span className="text-gray-500 dark:text-gray-400">=</span>
              <span className="text-green-700 dark:text-green-400">{a.value}</span>
            </>
          )}
        </span>
      ))}
      <span className="text-gray-500 dark:text-gray-400">{closeBracket}</span>
    </>
  )
}

export function DebugConsole({ runtimeState, stateDefinitions, inspection, apiLogs = [], handleRef, storageKey }: Props) {
  const [open, setOpen] = useState(false)
  const [height, setHeight] = useState(220)
  const [tab, setTab] = useState<Tab>('log')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [replInput, setReplInput] = useState('')
  const [replHistory, setReplHistory] = useState<{ expr: string; result: string }[]>([])
  const [filter, setFilter] = useState<LogLevel | 'all'>('all')
  const [apiSearch, setApiSearch] = useState('')
  const [apiMethodFilter, setApiMethodFilter] = useState<'all' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD'>('all')
  const [apiStatusFilter, setApiStatusFilter] = useState<'all' | 'ok' | 'error' | '2xx' | '3xx' | '4xx' | '5xx'>('all')
  const [apiPinnedOnly, setApiPinnedOnly] = useState(false)
  const [apiPinnedKeys, setApiPinnedKeys] = useState<Set<string>>(new Set())
  const [apiIgnorePaths, setApiIgnorePaths] = useState('id,createdAt,updatedAt,timestamp')
  const [presetName, setPresetName] = useState('')
  const [apiPresets, setApiPresets] = useState<ApiFilterPreset[]>([])
  const [diffLeftId, setDiffLeftId] = useState<number | null>(null)
  const [diffRightId, setDiffRightId] = useState<number | null>(null)
  const [jsonViewer, setJsonViewer] = useState<JsonViewerState>(null)

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as { open?: boolean; height?: number }
      if (typeof parsed.open === 'boolean') setOpen(parsed.open)
      if (typeof parsed.height === 'number' && Number.isFinite(parsed.height)) {
        setHeight(Math.min(600, Math.max(120, parsed.height)))
      }
    } catch {}
  }, [storageKey])

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ open, height }))
    } catch {}
  }, [storageKey, open, height])
  const [copiedCurlId, setCopiedCurlId] = useState<number | null>(null)
  const [copiedExportKind, setCopiedExportKind] = useState<'json' | 'csv' | null>(null)
  const logBottomRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartH = useRef(0)

  // Expose push handle to parent
  const push = useCallback((entry: Omit<LogEntry, 'id' | 'ts'>) => {
    setEntries((prev) => {
      const next = [...prev, { ...entry, id: ++_entryId, ts: Date.now() }]
      return next.length > 600 ? next.slice(-600) : next
    })
  }, [])

  useEffect(() => {
    if (handleRef) handleRef({ push })
  }, [handleRef, push])

  // Auto-scroll log to bottom
  useEffect(() => {
    if (open && tab === 'log') {
      logBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [entries, open, tab])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('dccortex:debug-api-pins')
      if (!raw) return
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        setApiPinnedKeys(new Set(arr.map((v) => String(v))))
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('dccortex:debug-api-pins', JSON.stringify(Array.from(apiPinnedKeys)))
    } catch {}
  }, [apiPinnedKeys])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('dccortex:debug-api-presets')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setApiPresets(parsed as ApiFilterPreset[])
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('dccortex:debug-api-presets', JSON.stringify(apiPresets))
    } catch {}
  }, [apiPresets])

  // Drag-to-resize handle
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    dragStartY.current = e.clientY
    dragStartH.current = height
    e.preventDefault()
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = dragStartY.current - e.clientY
      setHeight(Math.min(600, Math.max(120, dragStartH.current + delta)))
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const evalRepl = () => {
    const expr = replInput.trim()
    if (!expr) return
    try {
      const result = resolveExpression(expr, { state: runtimeState })
      setReplHistory((h) => [...h, { expr, result }])
    } catch (err) {
      setReplHistory((h) => [...h, { expr, result: String(err) }])
    }
    setReplInput('')
  }

  const visibleEntries = filter === 'all' ? entries : entries.filter((e) => e.level === filter)
  const stateKeys = stateDefinitions.map((d) => d.name).filter(Boolean)
  const inspectHtml = inspection ? formatHtmlForInspect(inspection.html) : ''
  const apiRows = [...apiLogs]
    .slice(-400)
    .filter((entry) => {
      if (apiMethodFilter !== 'all' && entry.method.toUpperCase() !== apiMethodFilter) return false
      if (apiPinnedOnly && !apiPinnedKeys.has(pinKeyForApi(entry))) return false
      if (apiStatusFilter !== 'all') {
        const st = Number(entry.status ?? 0)
        if (apiStatusFilter === 'ok' && !entry.ok) return false
        if (apiStatusFilter === 'error' && entry.ok) return false
        if (apiStatusFilter === '2xx' && (st < 200 || st >= 300)) return false
        if (apiStatusFilter === '3xx' && (st < 300 || st >= 400)) return false
        if (apiStatusFilter === '4xx' && (st < 400 || st >= 500)) return false
        if (apiStatusFilter === '5xx' && (st < 500 || st >= 600)) return false
      }
      if (!apiSearch.trim()) return true
      const q = apiSearch.toLowerCase()
      const hay = `${entry.method} ${entry.url} ${entry.status ?? ''} ${entry.error ?? ''} ${formatJson(entry.request)} ${formatJson(entry.response)}`.toLowerCase()
      return hay.includes(q)
    })
    .reverse()

  const ignoreRules = parseIgnoreRules(apiIgnorePaths)

  const diffLeft = diffLeftId == null ? null : apiRows.find((r) => r.id === diffLeftId) ?? null
  const diffRight = diffRightId == null ? null : apiRows.find((r) => r.id === diffRightId) ?? null
  const diffLeftJson = diffLeft ? formatJson(stripIgnoredPaths(tryParseJson(diffLeft.response), ignoreRules)) : ''
  const diffRightJson = diffRight ? formatJson(stripIgnoredPaths(tryParseJson(diffRight.response), ignoreRules)) : ''

  const exportFilteredJson = () => {
    const payload = apiRows.map((entry) => ({
      ts: new Date(entry.ts).toISOString(),
      source: entry.source,
      method: entry.method,
      url: entry.url,
      status: entry.status ?? null,
      ok: entry.ok,
      durationMs: entry.durationMs ?? null,
      request: entry.request ?? null,
      response: entry.response ?? null,
      error: entry.error ?? null,
    }))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dccortex-api-logs-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setCopiedExportKind('json')
    setTimeout(() => setCopiedExportKind((k) => (k === 'json' ? null : k)), 1200)
  }

  const exportFilteredCsv = () => {
    const head = ['ts', 'source', 'method', 'url', 'status', 'ok', 'durationMs', 'error', 'request', 'response']
    const rows = apiRows.map((entry) => [
      new Date(entry.ts).toISOString(),
      entry.source,
      entry.method,
      entry.url,
      entry.status ?? '',
      entry.ok,
      entry.durationMs ?? '',
      entry.error ?? '',
      formatJson(entry.request),
      formatJson(entry.response),
    ])
    const csv = [head.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dccortex-api-logs-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    setCopiedExportKind('csv')
    setTimeout(() => setCopiedExportKind((k) => (k === 'csv' ? null : k)), 1200)
  }

  const toHeaderPairs = (raw: unknown): Array<[string, string]> => {
    if (!raw) return []
    if (Array.isArray(raw)) {
      return raw
        .filter((v): v is [string, string] => Array.isArray(v) && v.length >= 2)
        .map(([k, v]) => [String(k), String(v)])
    }
    if (typeof Headers !== 'undefined' && raw instanceof Headers) {
      return Array.from(raw.entries()).map(([k, v]) => [String(k), String(v)])
    }
    if (raw && typeof raw === 'object') {
      return Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
    }
    return []
  }

  const toCurl = (entry: ApiLogEntry): string => {
    const req = (entry.request ?? {}) as ApiRequestShape
    const headers = toHeaderPairs(req.headers)
    const bodyValue = req.body ?? req.data
    const bodyString = bodyValue == null
      ? ''
      : typeof bodyValue === 'string'
        ? bodyValue
        : JSON.stringify(bodyValue)
    const curlParts: string[] = []
    curlParts.push(`curl -X ${entry.method.toUpperCase()} '${entry.url}'`)
    for (const [k, v] of headers) {
      curlParts.push(`  -H '${k.replace(/'/g, "'\\''")}: ${v.replace(/'/g, "'\\''")}'`)
    }
    if (bodyString) {
      const hasContentType = headers.some(([k]) => k.toLowerCase() === 'content-type')
      if (!hasContentType) {
        curlParts.push(`  -H 'Content-Type: application/json'`)
      }
      curlParts.push(`  --data '${bodyString.replace(/'/g, "'\\''")}'`)
    }
    return curlParts.join(' \\\n')
  }

  const copyCurl = async (entry: ApiLogEntry) => {
    const cmd = toCurl(entry)
    try {
      await navigator.clipboard.writeText(cmd)
      setCopiedCurlId(entry.id)
      setTimeout(() => setCopiedCurlId((current) => (current === entry.id ? null : current)), 1500)
    } catch {
      push({ level: 'warn', label: 'Clipboard write failed', detail: 'Could not copy cURL command' })
    }
  }

  const togglePin = (entry: ApiLogEntry) => {
    const key = pinKeyForApi(entry)
    setApiPinnedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const savePreset = () => {
    const name = presetName.trim()
    if (!name) return
    const next: ApiFilterPreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      search: apiSearch,
      method: apiMethodFilter,
      status: apiStatusFilter,
      pinnedOnly: apiPinnedOnly,
      ignorePaths: apiIgnorePaths,
    }
    setApiPresets((prev) => [next, ...prev].slice(0, 30))
    setPresetName('')
  }

  const applyPreset = (presetId: string) => {
    const preset = apiPresets.find((p) => p.id === presetId)
    if (!preset) return
    setApiSearch(preset.search)
    setApiMethodFilter(preset.method)
    setApiStatusFilter(preset.status)
    setApiPinnedOnly(preset.pinnedOnly)
    setApiIgnorePaths(preset.ignorePaths)
  }

  const deletePreset = (presetId: string) => {
    setApiPresets((prev) => prev.filter((p) => p.id !== presetId))
  }

  const fmt = (ts: number) => {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0')}`
  }

  return (
    <div className="shrink-0 border-t border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117] select-none">
      {/* ── Collapsed tab bar ── */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#161b22]"
        onMouseDown={open ? onMouseDown : undefined}
        style={{ cursor: open ? 'n-resize' : 'default' }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-mono"
        >
          <span className={`transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}>▾</span>
          <span className="font-semibold">Debug Console</span>
          {entries.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[9px] font-mono">{entries.length}</span>
          )}
          {entries.filter((e) => e.level === 'error').length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[9px] font-mono">
              {entries.filter((e) => e.level === 'error').length} err
            </span>
          )}
        </button>
        {open && (
          <div className="flex items-center gap-1 ml-3">
            {(['log', 'state', 'repl', 'inspect', 'api'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={(e) => { e.stopPropagation(); setTab(t) }}
                className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${tab === t ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}
              >
                {t === 'log' ? 'Events' : t === 'state' ? 'State' : t === 'repl' ? 'REPL' : t === 'inspect' ? 'Inspect' : 'API'}
              </button>
            ))}
          </div>
        )}
        {open && (
          <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
            {tab === 'log' && (
              <>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as LogLevel | 'all')}
                  className="text-[10px] border border-gray-200 dark:border-[#30363d] rounded px-1 py-0.5 bg-white dark:bg-[#161b22] text-gray-600 dark:text-gray-400"
                >
                  <option value="all">All</option>
                  <option value="event">Events</option>
                  <option value="state">State</option>
                  <option value="log">Log</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                </select>
                <button
                  type="button"
                  onClick={() => setEntries([])}
                  className="text-[10px] px-2 py-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      {open && (
        <div style={{ height }} className="overflow-hidden flex flex-col border-t border-gray-100 dark:border-[#21262d]">

          {/* Events log */}
          {tab === 'log' && (
            <div className="flex-1 overflow-y-auto font-mono text-[11px]">
              {visibleEntries.length === 0 && (
                <div className="text-center text-gray-400 py-8 text-xs font-sans">
                  No events yet — interact with the preview to see logs here.
                </div>
              )}
              {visibleEntries.map((entry) => (
                <div key={entry.id} className={`flex gap-2 px-3 py-1 border-b border-gray-50 dark:border-[#161b22] items-start ${LEVEL_BG[entry.level]}`}>
                  <span className="text-gray-300 dark:text-gray-600 shrink-0 mt-px">{fmt(entry.ts)}</span>
                  <span className={`shrink-0 w-12 font-bold uppercase text-[9px] mt-px ${LEVEL_COLOR[entry.level]}`}>{entry.level}</span>
                  <span className={`flex-1 ${LEVEL_COLOR[entry.level]}`}>{entry.label}</span>
                  {entry.detail && (
                    <span className="text-gray-400 dark:text-gray-500 text-[10px] truncate max-w-[280px]" title={entry.detail}>{entry.detail}</span>
                  )}
                </div>
              ))}
              <div ref={logBottomRef} />
            </div>
          )}

          {/* State viewer */}
          {tab === 'state' && (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid gap-1.5">
                {stateKeys.length === 0 && (
                  <p className="text-xs text-gray-400 font-sans">No state definitions found.</p>
                )}
                {stateKeys.map((key) => {
                  const val = runtimeState[key]
                  const display = val === undefined ? 'undefined' : JSON.stringify(val)
                  const type = val === null ? 'null' : typeof val
                  return (
                    <div key={key} className="flex items-center gap-2 font-mono text-[11px] bg-gray-50 dark:bg-[#161b22] rounded px-2 py-1">
                      <span className="text-purple-600 dark:text-purple-400 font-semibold shrink-0">{key}</span>
                      <span className="text-gray-300 dark:text-gray-600">=</span>
                      <span className={`flex-1 truncate ${typeof val === 'string' ? 'text-green-600 dark:text-green-400' : typeof val === 'number' ? 'text-blue-600 dark:text-blue-400' : typeof val === 'boolean' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300'}`}>
                        {display}
                      </span>
                      <span className="text-gray-300 dark:text-gray-600 text-[9px] shrink-0">{type}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* REPL / expression evaluator */}
          {tab === 'repl' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1">
                {replHistory.length === 0 && (
                  <p className="text-xs text-gray-400 font-sans">
                    Type any expression below — use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{`{{state.x}}`}</code> to reference state.
                  </p>
                )}
                {replHistory.map((h, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="text-blue-500 dark:text-blue-400"><span className="text-gray-400">&gt; </span>{h.expr}</div>
                    <div className="text-green-600 dark:text-green-400 pl-4">{h.result}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 dark:border-[#21262d] flex items-center gap-1 px-2 py-1.5">
                <span className="text-gray-400 font-mono text-xs">&gt;</span>
                <input
                  type="text"
                  value={replInput}
                  onChange={(e) => setReplInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') evalRepl() }}
                  placeholder={`{{state.direction}} === 'row' ? 'column' : 'row'`}
                  className="flex-1 bg-transparent font-mono text-[11px] text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={evalRepl}
                  className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-[#21262d] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#30363d]"
                >
                  Run
                </button>
                {replHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setReplHistory([])}
                    className="text-[10px] px-2 py-0.5 rounded text-gray-400 hover:text-red-500"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Selected component inspection */}
          {tab === 'inspect' && (
            <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px]">
              {!inspection ? (
                <p className="text-xs text-gray-400 font-sans">Select a component on the canvas to inspect its DOM snapshot.</p>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-sans text-gray-500 dark:text-gray-400">Node: <span className="font-mono">{inspection.nodeId}</span></div>
                  <pre className="whitespace-pre bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-2 max-h-[50vh] overflow-auto leading-5">
                    {inspectHtml.split('\n').map((line, idx) => (
                      <div key={idx}>{highlightHtmlLine(line)}</div>
                    ))}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* API logs */}
          {tab === 'api' && (
            <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-2">
              <div className="sticky top-0 z-10 bg-white dark:bg-[#0d1117] pb-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={apiSearch}
                    onChange={(e) => setApiSearch(e.target.value)}
                    placeholder="Search URL, status, payload, error..."
                    className="min-w-[220px] flex-1 text-[11px] border border-gray-200 dark:border-[#30363d] rounded px-2 py-1 bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300"
                  />
                  <select
                    value={apiMethodFilter}
                    onChange={(e) => setApiMethodFilter(e.target.value as typeof apiMethodFilter)}
                    className="text-[11px] border border-gray-200 dark:border-[#30363d] rounded px-2 py-1 bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300"
                  >
                    <option value="all">All methods</option>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                    <option value="OPTIONS">OPTIONS</option>
                    <option value="HEAD">HEAD</option>
                  </select>
                  <select
                    value={apiStatusFilter}
                    onChange={(e) => setApiStatusFilter(e.target.value as typeof apiStatusFilter)}
                    className="text-[11px] border border-gray-200 dark:border-[#30363d] rounded px-2 py-1 bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300"
                  >
                    <option value="all">All status</option>
                    <option value="ok">OK</option>
                    <option value="error">Error</option>
                    <option value="2xx">2xx</option>
                    <option value="3xx">3xx</option>
                    <option value="4xx">4xx</option>
                    <option value="5xx">5xx</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setApiPinnedOnly((v) => !v)}
                    className={`text-[10px] px-2 py-1 rounded border ${apiPinnedOnly ? 'border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 dark:border-[#30363d] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}
                    title="Show only pinned requests"
                  >
                    {apiPinnedOnly ? 'Pinned only' : 'All + pinned'}
                  </button>
                  <button
                    type="button"
                    onClick={exportFilteredJson}
                    className="text-[10px] px-2 py-1 rounded text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-200 dark:border-[#30363d]"
                    title="Export filtered API logs as JSON"
                  >
                    {copiedExportKind === 'json' ? 'JSON saved' : 'Export JSON'}
                  </button>
                  <button
                    type="button"
                    onClick={exportFilteredCsv}
                    className="text-[10px] px-2 py-1 rounded text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-200 dark:border-[#30363d]"
                    title="Export filtered API logs as CSV"
                  >
                    {copiedExportKind === 'csv' ? 'CSV saved' : 'Export CSV'}
                  </button>
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name"
                    className="text-[11px] border border-gray-200 dark:border-[#30363d] rounded px-2 py-1 bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300 min-w-[120px]"
                  />
                  <button
                    type="button"
                    onClick={savePreset}
                    className="text-[10px] px-2 py-1 rounded text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-200 dark:border-[#30363d]"
                    title="Save current API filters as a preset"
                  >
                    Save preset
                  </button>
                  <button
                    type="button"
                    onClick={() => { setApiSearch(''); setApiMethodFilter('all'); setApiStatusFilter('all'); setApiPinnedOnly(false) }}
                    className="text-[10px] px-2 py-1 rounded text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-200 dark:border-[#30363d]"
                  >
                    Reset
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={apiIgnorePaths}
                    onChange={(e) => setApiIgnorePaths(e.target.value)}
                    placeholder="Ignore paths for diff, comma-separated (e.g. id,meta.timestamp,items.*.updatedAt)"
                    className="min-w-[280px] flex-1 text-[11px] border border-gray-200 dark:border-[#30363d] rounded px-2 py-1 bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300"
                  />
                  {apiPresets.length > 0 && (
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (!e.target.value) return
                        applyPreset(e.target.value)
                        e.currentTarget.value = ''
                      }}
                      className="text-[11px] border border-gray-200 dark:border-[#30363d] rounded px-2 py-1 bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300"
                    >
                      <option value="">Apply preset...</option>
                      {apiPresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>{preset.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                {apiPresets.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {apiPresets.slice(0, 8).map((preset) => (
                      <div key={preset.id} className="inline-flex items-center border border-gray-200 dark:border-[#30363d] rounded bg-gray-50 dark:bg-[#161b22]">
                        <button
                          type="button"
                          onClick={() => applyPreset(preset.id)}
                          className="text-[10px] px-2 py-0.5 text-gray-700 dark:text-gray-300"
                          title="Apply preset"
                        >
                          {preset.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePreset(preset.id)}
                          className="text-[10px] px-1.5 py-0.5 text-gray-400 hover:text-red-500"
                          title="Delete preset"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-gray-500">{apiRows.length} matching request{apiRows.length === 1 ? '' : 's'}</div>
              </div>

              {(diffLeft || diffRight) && (
                <div className="border border-gray-200 dark:border-[#30363d] rounded bg-white dark:bg-[#0d1117] p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-[10px] uppercase text-gray-500">Response diff</div>
                    <button
                      type="button"
                      onClick={() => { setDiffLeftId(null); setDiffRightId(null) }}
                      className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-[#30363d] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      Clear diff
                    </button>
                  </div>
                  {(!diffLeft || !diffRight) ? (
                    <div className="text-[11px] text-gray-500">Pick two rows with Left and Right to compare responses side-by-side.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {[{ side: 'left', entry: diffLeft, mineText: diffLeftJson, otherText: diffRightJson }, { side: 'right', entry: diffRight, mineText: diffRightJson, otherText: diffLeftJson }].map(({ side, entry, mineText, otherText }) => {
                        const mine = mineText.split('\n')
                        const other = otherText.split('\n')
                        const max = Math.max(mine.length, other.length)
                        return (
                          <div key={side} className="border border-gray-200 dark:border-[#30363d] rounded overflow-hidden">
                            <div className="px-2 py-1 text-[10px] uppercase bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-[#30363d] text-gray-500">
                              {side} · {entry.method} · {entry.status ?? 'n/a'}
                            </div>
                            <pre className="max-h-52 overflow-auto text-[10px] leading-4 p-2 bg-white dark:bg-[#0d1117]">
                              {Array.from({ length: max }).map((_, i) => {
                                const line = mine[i] ?? ''
                                const changed = line !== (other[i] ?? '')
                                return (
                                  <div key={i} className={changed ? 'bg-amber-50 dark:bg-amber-900/20' : ''}>
                                    <span className="text-gray-400 mr-2 inline-block w-7 text-right">{i + 1}</span>
                                    <span>{line}</span>
                                  </div>
                                )
                              })}
                            </pre>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {apiRows.length === 0 && (
                <p className="text-xs text-gray-400 font-sans">No API activity yet. Trigger preview actions or reload data to populate logs.</p>
              )}
              {apiRows.map((entry) => {
                const statusColor = entry.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                const pinned = apiPinnedKeys.has(pinKeyForApi(entry))
                return (
                  <div key={entry.id} className="border border-gray-200 dark:border-[#30363d] rounded bg-gray-50 dark:bg-[#161b22]">
                    <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-200 dark:border-[#30363d]">
                      <span className="text-gray-400">{fmt(entry.ts)}</span>
                      <span className="px-1 py-0.5 rounded bg-gray-200 dark:bg-[#30363d] text-gray-700 dark:text-gray-300 text-[10px] uppercase">{entry.source}</span>
                      <span className="text-blue-600 dark:text-blue-400 uppercase">{entry.method}</span>
                      <span className={`font-semibold ${statusColor}`}>{entry.status ?? (entry.ok ? 'ok' : 'error')}</span>
                      {entry.durationMs != null && <span className="text-gray-500">{entry.durationMs.toFixed(1)}ms</span>}
                      <button
                        type="button"
                        onClick={() => togglePin(entry)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${pinned ? 'border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                        title="Pin this request signature"
                      >
                        {pinned ? 'Pinned' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiffLeftId(entry.id)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${diffLeftId === entry.id ? 'border-blue-300 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                        title="Set as left side for diff"
                      >
                        Left
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiffRightId(entry.id)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${diffRightId === entry.id ? 'border-blue-300 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                        title="Set as right side for diff"
                      >
                        Right
                      </button>
                      <button
                        type="button"
                        onClick={() => copyCurl(entry)}
                        className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]"
                        title="Copy this request as cURL"
                      >
                        {copiedCurlId === entry.id ? 'Copied' : 'Copy cURL'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setJsonViewer({ title: `${entry.method} ${entry.url}`, value: tryParseJson(entry.response) })}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]"
                        title="Open response in full-screen collapsible JSON viewer"
                      >
                        View JSON
                      </button>
                    </div>
                    <div className="px-2 py-1.5 break-all text-gray-700 dark:text-gray-300">{entry.url}</div>
                    {entry.error && (
                      <div className="px-2 pb-1.5 text-red-600 dark:text-red-400">{entry.error}</div>
                    )}
                    {(entry.request != null || entry.response != null) && (
                      <details className="px-2 pb-2">
                        <summary className="cursor-pointer text-gray-500">payload</summary>
                        {entry.request != null && (
                          <div className="mt-1">
                            <div className="text-[10px] uppercase text-gray-500">request</div>
                            <pre className="whitespace-pre-wrap break-all bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] p-2">{formatJson(entry.request)}</pre>
                          </div>
                        )}
                        {entry.response != null && (
                          <div className="mt-1">
                            <div className="text-[10px] uppercase text-gray-500">response</div>
                            <pre className="whitespace-pre-wrap break-all bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] p-2">{formatJson(entry.response)}</pre>
                          </div>
                        )}
                      </details>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {jsonViewer && (
        <div className="fixed inset-0 z-[999] bg-black/65 flex items-center justify-center p-4" onClick={() => setJsonViewer(null)}>
          <div className="w-full max-w-6xl h-[88vh] bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] rounded-lg overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-2 border-b border-gray-200 dark:border-[#30363d] flex items-center gap-2">
              <div className="text-xs text-gray-500 uppercase">JSON viewer</div>
              <div className="text-sm text-gray-700 dark:text-gray-200 truncate">{jsonViewer.title}</div>
              <button
                type="button"
                onClick={() => setJsonViewer(null)}
                className="ml-auto text-xs px-2 py-1 rounded border border-gray-200 dark:border-[#30363d] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 font-mono text-[11px]">
              <JsonTreeNode value={jsonViewer.value} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
