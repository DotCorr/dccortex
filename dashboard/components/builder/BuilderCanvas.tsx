/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import React, { useCallback, useState, useEffect, useMemo, Fragment } from 'react'
import type { Node } from './registry'
import { createNode, nodePropsToStyle, getDomId } from './registry'
import type { ScreenTheme } from './PropertyPanel'
import { parseEventSteps, type EventActionConfig, type EventRuntimeContext } from './eventHelpers'
import type { ReusableDefinition } from './globals'
import { BuilderChart } from './BuilderCharts'
import type { AnimationSequenceConfig } from './AnimationSequenceBuilder'
import { clearBuilderDragPayload, getBuilderDragPayload, setBuilderDragPayload } from './drag-payload'

export type ResolveBindingFn = (raw: string, propsCtx?: Record<string, unknown>) => string

/** Error boundary that catches render errors in canvas nodes and shows a fallback instead of crashing the entire editor. */
class NodeErrorBoundary extends React.Component<
  { nodeId: string; children: React.ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null }
  static getDerivedStateFromError(err: Error) {
    return { error: err.message || 'Render error' }
  }
  componentDidCatch(err: Error) {
    console.error(`[BuilderCanvas] Render error in node ${this.props.nodeId}:`, err)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 8, border: '1px dashed #e53e3e', borderRadius: 4, background: '#fff5f5', color: '#c53030', fontSize: 12 }}>
          ⚠ Render error: {this.state.error}
          <button onClick={() => this.setState({ error: null })} style={{ marginLeft: 8, textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: '#c53030', fontSize: 12 }}>
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/** Maps hamburgerBreakpoint values to max-width px thresholds */
const HAMBURGER_BPS: Record<string, number> = { always: 99999, sm: 640, md: 768, lg: 1024, xl: 1280, never: 0 }

/** Collapsible aside — renders hamburger overlay in both edit & preview mode so style changes are live. */
function CollapsibleAsidePreview({
  node,
  baseStyle,
  domId,
  children,
  runConfiguredEvent,
  previewMode,
  isSelected,
  onEditSelect,
}: {
  node: Node
  baseStyle: React.CSSProperties
  domId: string
  children: React.ReactNode
  runConfiguredEvent: (e: React.MouseEvent<HTMLElement>) => void
  previewMode?: boolean
  isSelected?: boolean
  onEditSelect?: (e: React.MouseEvent) => void
}) {
  const [open, setOpen] = useState(false)
  const drawerWidth = baseStyle.width ?? '240px'
  const p = node.props as Record<string, unknown>
  const hTop = Number(p.hamburgerTop ?? 10)
  const hLeft = Number(p.hamburgerLeft ?? 10)
  const hBg = String(p.hamburgerBg ?? 'rgba(255,255,255,0.9)')
  const hColor = String(p.hamburgerColor ?? '#000000')
  const hBorder = String(p.hamburgerBorder ?? '1px solid rgba(0,0,0,0.15)')
  const hRadius = String(p.hamburgerRadius ?? '0px')
  const hIcon = String(p.hamburgerIcon ?? '')
  const hIconSize = Number(p.hamburgerIconSize ?? 20)
  const breakpoint = String(p.hamburgerBreakpoint ?? 'always')
  const maxPx = HAMBURGER_BPS[breakpoint] ?? 99999

  // Track whether the hamburger should be active for the current viewport size
  const [isHamburgerMode, setIsHamburgerMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    if (breakpoint === 'never') return false
    if (breakpoint === 'always') return true
    return window.innerWidth <= maxPx
  })

  useEffect(() => {
    if (breakpoint === 'always') { setIsHamburgerMode(true); return }
    if (breakpoint === 'never') { setIsHamburgerMode(false); return }
    const mq = window.matchMedia(`(max-width: ${maxPx}px)`)
    const handler = (e: MediaQueryListEvent) => setIsHamburgerMode(e.matches)
    setIsHamburgerMode(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint, maxPx])

  // Close drawer when switching to non-hamburger mode
  useEffect(() => { if (!isHamburgerMode) setOpen(false) }, [isHamburgerMode])

  // ── Normal in-layout render (viewport ≥ breakpoint) ──────────────────────
  if (!isHamburgerMode) {
    return (
      <aside
        id={domId}
        data-node-id={node.id}
        onClick={previewMode ? runConfiguredEvent : (e) => { e.stopPropagation(); onEditSelect?.(e) }}
        className={`box-border ${!previewMode ? `border-2 border-dashed ${isSelected ? 'border-[var(--primary)]' : 'border-gray-200 dark:border-[#30363d]'}` : ''}`}
        style={{ ...baseStyle, overflow: 'auto', flexShrink: 0, position: 'relative' }}
      >
        {isSelected && !previewMode && (
          <span className="absolute top-0 left-0 z-50 bg-[var(--primary)] text-white text-[10px] font-semibold px-1.5 py-0.5 pointer-events-none leading-none">
            aside
          </span>
        )}
        {children}
      </aside>
    )
  }

  // ── Hamburger overlay render (viewport ≤ breakpoint) ─────────────────────
  // In edit mode, drawer auto-shows when the node is selected so style changes are immediately visible
  const drawerVisible = previewMode ? open : (open || !!isSelected)
  return (
    <>
      {/* Hamburger button — absolutely positioned, zero layout impact */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (previewMode) setOpen(true)
          else { onEditSelect?.(e); setOpen(o => !o) }
        }}
        title={previewMode ? 'Open sidebar' : 'Aside (collapsible) — click to select'}
        style={{
          position: 'absolute',
          top: hTop,
          left: hLeft,
          zIndex: 30,
          padding: '7px 8px',
          background: hBg,
          border: isSelected && !previewMode ? '2px solid var(--primary)' : hBorder,
          borderRadius: hRadius,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {hIcon && hIcon.includes(':') ? (
          <img
            src={`https://api.iconify.design/${hIcon.split(':')[0]}/${hIcon.split(':').slice(1).join(':')}.svg?color=${encodeURIComponent(hColor || '#000000')}`}
            alt=""
            width={hIconSize}
            height={hIconSize}
            style={{ display: 'block' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          [0,1,2].map(i => (
            <span key={i} style={{ display: 'block', width: '16px', height: '2px', background: hColor }} />
          ))
        )}
      </button>

      {/* Backdrop — preview only */}
      {previewMode && open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }}
        />
      )}

      {/* Drawer — slides in from left as overlay */}
      <aside
        id={domId}
        data-node-id={node.id}
        onClick={previewMode
          ? runConfiguredEvent
          : (e) => { e.stopPropagation(); onEditSelect?.(e) }}
        className={`box-border ${!previewMode ? `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-gray-200 dark:border-[#30363d] border-dashed'}` : ''}`}
        style={{
          ...baseStyle,
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: drawerWidth,
          zIndex: 50,
          transform: drawerVisible ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'auto',
          flexShrink: 0,
        }}
      >
        {isSelected && !previewMode && (
          <span className="absolute top-0 left-0 z-[52] bg-[var(--primary)] text-white text-[10px] font-semibold px-1.5 py-0.5 pointer-events-none leading-none">
            aside
          </span>
        )}
        {previewMode && (
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false) }}
            title="Close sidebar"
            style={{
              position: 'absolute', top: '10px', right: '10px', zIndex: 51,
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '4px', lineHeight: 1, fontSize: '18px', opacity: 0.6,
            }}
          >
            ✕
          </button>
        )}
        {children}
      </aside>
    </>
  )
}

type Props = {
  root: Node
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdate: (root: Node) => void
  previewMode?: boolean
  /** Hide root-only edit outline/label chrome (useful inside framed previews). */
  suppressRootChrome?: boolean
  /** Resolve {{state.x}} etc. so UI shows value not variable name */
  resolveBinding?: ResolveBindingFn
  /** Global theme (CSS vars set by parent wrapper) */
  theme?: ScreenTheme
  /** When in preview, force light/dark so parent can apply .dark */
  previewTheme?: 'light' | 'dark'
  /** When dropping a tree node (nodeId) onto canvas, reparent it */
  onMove?: (nodeId: string, targetParentId: string, index: number) => void
  /** In preview mode, run event (e.g. setState) when user clicks/fires action */
  onRunEvent?: (config: EventActionConfig, eventCtx?: EventRuntimeContext) => void
  reusables?: ReusableDefinition[]
  /** Optional prop context used when rendering reusable source in edit mode. */
  reusablePropsCtx?: Record<string, unknown>
  /** Source names currently being fetched by runtime-data. */
  runtimePendingSources?: string[]
  /** Source names that currently have resolved non-null data in runtimeData. */
  runtimeResolvedSources?: string[]
}

/** Resolve {{state.x}} / {{data.x}} so state works for all components. Use for every bindable prop (see registry bindableProps). */
function resolve(raw: unknown, fn?: ResolveBindingFn, propsCtx?: Record<string, unknown>): string {
  const s = raw === undefined || raw === null ? '' : String(raw)
  return fn ? fn(s, propsCtx) : s
}

function parseComparable(v: string): string | number | boolean {
  const s = v.trim()
  if (s === 'true') return true
  if (s === 'false') return false
  // Strip surrounding quotes from string literals: 'overview' → overview, "hello" → hello
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1)
  }
  const n = Number(s)
  return Number.isNaN(n) ? s : n
}

function evaluateVisibleWhen(raw: unknown, fn?: ResolveBindingFn): boolean {
  const resolved = resolve(raw, fn).trim()
  if (!resolved) return true
  const ops = ['===', '!==', '>=', '<=', '==', '!=', '>', '<'] as const
  for (const op of ops) {
    const idx = resolved.indexOf(op)
    if (idx > -1) {
      const left = parseComparable(resolved.slice(0, idx))
      const right = parseComparable(resolved.slice(idx + op.length))
      switch (op) {
        case '===': return left === right
        case '!==': return left !== right
        case '==': return String(left) === String(right)
        case '!=': return String(left) !== String(right)
        case '>': return (left as number) > (right as number)
        case '<': return (left as number) < (right as number)
        case '>=': return (left as number) >= (right as number)
        case '<=': return (left as number) <= (right as number)
      }
    }
  }
  const lower = typeof resolved === 'string' ? resolved.toLowerCase() : String(resolved).toLowerCase()
  return !(lower === 'false' || lower === '0' || lower === 'null' || lower === 'undefined' || lower === '')
}

function extractGradientColors(gradient: string): string[] {
  const matches = gradient.match(/#[0-9a-fA-F]{3,8}|rgba?\([^\)]+\)|hsla?\([^\)]+\)/g)
  if (!matches || matches.length === 0) return ['#22d3ee', '#6366f1']
  return matches.slice(0, 6)
}

const GENERIC_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'emoji',
  'math',
  'fangsong',
])

function extractWebFontFamilies(raw: unknown): string[] {
  const value = String(raw ?? '').trim()
  if (!value || value.includes('{{')) return []
  return value
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter((family) => family && !GENERIC_FONT_FAMILIES.has(family.toLowerCase()))
}

function ensureBunnyFontLoaded(family: string) {
  if (typeof document === 'undefined') return
  const encoded = family.replace(/\s+/g, '+')
  const id = `bunny-font-${encoded}`
  if (!document.getElementById('bunny-preconnect')) {
    const pc = document.createElement('link')
    pc.id = 'bunny-preconnect'
    pc.rel = 'preconnect'
    pc.href = 'https://fonts.bunny.net'
    document.head.appendChild(pc)
  }
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.bunny.net/css?family=${encoded}:400,500,600,700`
  document.head.appendChild(link)
}

function resolveWithProps(raw: unknown, fn?: ResolveBindingFn, propsCtx?: Record<string, unknown>): string {
  if (!propsCtx) return resolve(raw, fn)
  if (fn) {
    let source = typeof raw === 'string' ? raw : String(raw ?? '')
    // Flatten nested bindings like {{data.source.{{state.key}}}} before evaluating the full expression.
    if (/\{\{[^{}]*\{\{[^{}]+\}\}[^{}]*\}\}/.test(source)) {
      for (let i = 0; i < 6; i++) {
        let changed = false
        source = source.replace(/\{\{([^{}]+)\}\}/g, (match, inner) => {
          const token = `{{${String(inner).trim()}}}`
          const next = fn(token, propsCtx)
          if (next !== match) changed = true
          return next
        })
        if (!changed || !source.includes('{{')) break
      }
    }
    let resolved = fn(source, propsCtx)
    // Support chained bindings where a prop value itself contains bindings.
    for (let i = 0; i < 3; i++) {
      if (!resolved.includes('{{')) break
      const next = fn(resolved, propsCtx)
      if (next === resolved) break
      resolved = next
    }
    return resolved
  }
  const str = typeof raw === 'string' ? raw : String(raw ?? '')
  return str.replace(/\{\{\s*prop\.([a-zA-Z0-9_.$-]+)\s*\}\}/g, (_, keyPath) => {
    const keys = String(keyPath).split('.')
    let cur: unknown = propsCtx
    for (const k of keys) {
      if (cur == null || typeof cur !== 'object') return ''
      cur = (cur as Record<string, unknown>)[k]
    }
    return cur == null ? '' : String(cur)
  })
}

function normalizeRepeaterItems(source: unknown): unknown[] {
  if (Array.isArray(source)) return source
  if (!source || typeof source !== 'object') return []

  const entries = Object.entries(source as Record<string, unknown>)
  if (entries.length === 0) return []

  const allArrays = entries.every(([, value]) => Array.isArray(value))
  if (allArrays) {
    const lengths = entries.map(([, value]) => (value as unknown[]).length)
    const maxLen = lengths.length > 0 ? Math.max(...lengths) : 0
    const rows: Record<string, unknown>[] = []
    for (let idx = 0; idx < maxLen; idx++) {
      const row: Record<string, unknown> = {}
      for (const [key, value] of entries) {
        row[key] = (value as unknown[])[idx]
      }
      rows.push(row)
    }
    return rows
  }

  return entries.map(([key, value]) => ({ key, value }))
}

function normalizeSourceKey(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

function extractDataSourcesFromUnknown(input: unknown): string[] {
  const out = new Set<string>()
  const walk = (value: unknown, depth = 0) => {
    if (depth > 5 || value == null) return
    if (typeof value === 'string') {
      const tokenMatches = value.match(/\{\{\s*data\.([a-zA-Z0-9_-]+)/g) ?? []
      for (const m of tokenMatches) {
        const source = m.replace(/\{\{\s*data\./, '').trim()
        if (source) out.add(normalizeSourceKey(source))
      }
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1)
      return
    }
    if (typeof value === 'object') {
      for (const child of Object.values(value as Record<string, unknown>)) walk(child, depth + 1)
    }
  }
  walk(input)
  return Array.from(out)
}

const BUILDER_CHART_TYPES = new Set([
  'lineChart', 'barChart', 'pieChart', 'areaChart', 'doughnutChart', 'horizontalBarChart',
  'stackedBarChart', 'scatterChart', 'radarChart', 'gaugeChart', 'funnelChart', 'stepLineChart',
  'heatmapChart', 'bubbleChart',
])

const MissingReusableWarningContext = React.createContext(true)
const LoadingSignalContext = React.createContext<{ pending: Set<string>; resolved: Set<string> }>({
  pending: new Set<string>(),
  resolved: new Set<string>(),
})

const reusableCloneCache = new WeakMap<Node, Map<string, Node>>()

function cloneForReusableInstance(node: Node, namespace: string): Node {
  return {
    ...node,
    id: `${namespace}-${node.id}`,
    children: (node.children ?? []).map((c) => cloneForReusableInstance(c, namespace)),
  }
}

function cloneForReusableInstanceCached(node: Node, namespace: string): Node {
  let nsMap = reusableCloneCache.get(node)
  if (!nsMap) {
    nsMap = new Map<string, Node>()
    reusableCloneCache.set(node, nsMap)
  }
  const cached = nsMap.get(namespace)
  if (cached) return cached
  const cloned = cloneForReusableInstance(node, namespace)
  nsMap.set(namespace, cloned)
  return cloned
}

function NodeRenderer({
  node,
  selectedId,
  onSelect,
  onUpdate,
  onAddChild,
  onMove,
  onRunEvent,
  isRoot,
  previewMode,
  resolveBinding: resolveBindingFn,
  reusablesById,
  reusablePropsCtx,
  draggingNodeId,
  onDragStartNode,
  onDragEndNode,
  suppressRootChrome,
}: {
  node: Node
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdate: (root: Node) => void
  onAddChild: (parent: Node, type: string, reusableId?: string) => void
  onMove?: (nodeId: string, targetParentId: string, index: number) => void
  onRunEvent?: (config: EventActionConfig, eventCtx?: EventRuntimeContext) => void
  isRoot?: boolean
  previewMode?: boolean
  resolveBinding?: ResolveBindingFn
  reusablesById?: Map<string, ReusableDefinition>
  reusablePropsCtx?: Record<string, unknown>
  draggingNodeId?: string | null
  onDragStartNode?: (id: string) => void
  onDragEndNode?: () => void
  suppressRootChrome?: boolean
}) {
  const isSelected = !previewMode && selectedId === node.id
  const canDragNode = !previewMode && !isRoot && !!onMove
  const showMissingReusableWarning = React.useContext(MissingReusableWarningContext)
  const loadingSignals = React.useContext(LoadingSignalContext)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (previewMode) return
      e.preventDefault()
      e.stopPropagation()
      try {
        const raw = e.dataTransfer.getData('application/json')
        const data = raw ? JSON.parse(raw) : null
        const payload = getBuilderDragPayload()
        const nodeId = data?.nodeId ?? (payload?.kind === 'tree-node' ? payload.nodeId : undefined)
        const type = data?.type ?? (payload?.kind === 'component' ? payload.type : undefined)
        const reusableId = data?.reusableId ?? (payload?.kind === 'component' ? payload.reusableId : undefined)
        if (nodeId && onMove) {
          if (nodeId !== node.id) onMove(nodeId, node.id, 0)
          return
        }
        if (type) {
          onAddChild(node, type, reusableId)
        }
      } catch (_) {}
    },
    [node, onAddChild, onMove, previewMode]
  )
  const handleDragOver = (e: React.DragEvent) => {
    if (previewMode) return
    if (draggingNodeId === node.id) return
    e.preventDefault()
    const payload = getBuilderDragPayload()
    const isTreeMove = e.dataTransfer.types.includes('application/x-builder-tree-node') || payload?.kind === 'tree-node'
    e.dataTransfer.dropEffect = isTreeMove ? 'move' : 'copy'
  }
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!canDragNode) return
    e.dataTransfer.setData('application/json', JSON.stringify({ nodeId: node.id }))
    e.dataTransfer.setData('application/x-builder-tree-node', node.id)
    e.dataTransfer.effectAllowed = 'move'
    setBuilderDragPayload({ kind: 'tree-node', nodeId: node.id })
    onDragStartNode?.(node.id)
  }, [canDragNode, node.id, onDragStartNode])
  const handleDragEnd = useCallback(() => {
    clearBuilderDragPayload()
    onDragEndNode?.()
  }, [onDragEndNode])

  const semanticLayoutTypes = ['header', 'main', 'footer', 'nav', 'aside', 'article'] as const
  const hasLayout = ['container', 'suspense', 'section', 'stackV', 'stackH', 'card', 'formWrapper', 'dataRepeater', 'tabs', 'tooltip', 'modal', ...semanticLayoutTypes].includes(node.type as any)
  // Resolve all string props (e.g. {{state.direction}}) before computing styles so edit canvas matches preview layout.
  const resolvedNodeProps = resolveBindingFn
    ? Object.fromEntries(
        Object.entries(node.props).map(([k, v]) => [k, typeof v === 'string' ? resolveBindingFn(v) : v])
      )
    : node.props
  const baseStyle = nodePropsToStyle(resolvedNodeProps, hasLayout)
  const style = { ...baseStyle }
  // In the builder canvas, viewport units should be relative to the canvas viewport,
  // not the browser window; convert vh/vw to percentages to preserve expected framing.
  const viewportSizeKeys = ['height', 'minHeight', 'maxHeight', 'width', 'minWidth', 'maxWidth'] as const
  for (const key of viewportSizeKeys) {
    const raw = style[key]
    if (typeof raw !== 'string') continue
    style[key] = raw
      .replace(/(-?\d*\.?\d+)vh\b/g, '$1%')
      .replace(/(-?\d*\.?\d+)vw\b/g, '$1%')
  }
  // Inject theme border-radius as default for components that render visually
  // (skip structural/invisible types where border-radius makes no sense, and skip root)
  const noBorderRadiusTypes = ['divider', 'spacer', 'dataRepeater', 'gestureDetector']
  if (!style.borderRadius && !noBorderRadiusTypes.includes(node.type) && !isRoot) {
    ;(style as Record<string, unknown>).borderRadius = 'var(--border-radius, 0px)'
  }
  // In editor mode, position:fixed elements are contained within the canvas root
  // via CSS `contain: layout` on the wrapper — no rewriting needed.
  // We only need to ensure z-index is bounded so fixed elements don't escape the canvas visually.
  if (!previewMode && (style as Record<string, unknown>).position === 'fixed') {
    const z = Number((style as Record<string, unknown>).zIndex) || 0
    ;(style as Record<string, unknown>).zIndex = Math.min(z, 999)
  }
  if (isRoot && hasLayout) {
    ;(style as Record<string, unknown>).height = '100%'
    if (!(style as Record<string, unknown>).width) {
      ;(style as Record<string, unknown>).width = '100%'
    }
  }
  // Semantic block elements (header, footer, nav, main…) should fill the parent width unless the user explicitly set a width
  if (semanticLayoutTypes.includes(node.type as any) && !style.width) {
    (style as Record<string, unknown>).width = '100%'
  }
  // reusableInstance: apply explicit flex/size props the user set via the Layout tab.
  // If instance width/height are not set, inherit source reusable root dimensions before fallback.
  if (node.type === 'reusableInstance') {
    const p = resolvedNodeProps as Record<string, unknown>
    const reusableId = typeof p.reusableId === 'string' ? p.reusableId : ''
    const reusableRootProps = (reusableId ? reusablesById?.get(reusableId)?.root?.props : undefined) as Record<string, unknown> | undefined
    const explicitFlex = p.flex != null && String(p.flex).trim()
    const explicitWidth = p.width != null && String(p.width).trim()
    const inheritedWidth = reusableRootProps?.width != null && String(reusableRootProps.width).trim()
    // Width must win over auto-grow: when explicit width exists, neutralize flex expansion.
    if (explicitFlex && !explicitWidth) (style as Record<string, unknown>).flex = String(p.flex).trim()
    if (explicitWidth) (style as Record<string, unknown>).flex = '0 0 auto'
    if (explicitWidth) (style as Record<string, unknown>).width = /^\d+$/.test(String(p.width).trim()) ? `${p.width}px` : String(p.width)
    else if (inheritedWidth) (style as Record<string, unknown>).width = /^\d+$/.test(String(reusableRootProps?.width).trim()) ? `${reusableRootProps?.width}px` : String(reusableRootProps?.width)
    else if (!explicitFlex) (style as Record<string, unknown>).width = '100%'

    const explicitHeight = p.height != null && String(p.height).trim()
    const inheritedHeight = reusableRootProps?.height != null && String(reusableRootProps.height).trim()
    if (explicitHeight) (style as Record<string, unknown>).height = /^\d+$/.test(String(p.height).trim()) ? `${p.height}px` : String(p.height)
    else if (inheritedHeight) (style as Record<string, unknown>).height = /^\d+$/.test(String(reusableRootProps?.height).trim()) ? `${reusableRootProps?.height}px` : String(reusableRootProps?.height)

    if (p.alignSelf != null && String(p.alignSelf).trim()) (style as Record<string, unknown>).alignSelf = String(p.alignSelf)
  }

  const domId = getDomId(node)

  const fireConfiguredEvent = useCallback(
    (ev: string, payload?: EventRuntimeContext) => {
      if (!previewMode || !onRunEvent) return
      const raw = node.props[ev]
      const steps = parseEventSteps(raw)
      for (const step of steps) {
        // Pre-resolve any {{prop.*}} bindings in the step so that items inside
        // a dataRepeater can pass their own fields (e.g. {{prop.item.id}}) to
        // setState/runScript actions that run outside the repeater's prop context.
        const resolvedStep: typeof step = reusablePropsCtx
          ? {
              ...step,
              ...(step.value != null ? { value: resolveWithProps(String(step.value), resolveBindingFn, reusablePropsCtx) } : {}),
              ...(step.stateKey != null ? { stateKey: resolveWithProps(String(step.stateKey), resolveBindingFn, reusablePropsCtx) } : {}),
              ...(step.customScript != null ? { customScript: resolveWithProps(String(step.customScript), resolveBindingFn, reusablePropsCtx) } : {}),
            }
          : step
        onRunEvent(resolvedStep, { type: ev, targetId: domId, ...(payload ?? {}) })
      }
    },
    [previewMode, onRunEvent, node.props, domId, resolveBindingFn, reusablePropsCtx]
  )
  const runConfiguredEvent = useCallback(
    (ev: 'onClick', e: React.MouseEvent) => {
      const raw = node.props[ev]
      const steps = parseEventSteps(raw)
      if (steps.length > 0) {
        e.stopPropagation()
        if (previewMode && onRunEvent) {
          for (const step of steps) {
            // Pre-resolve any {{prop.*}} bindings (same fix as fireConfiguredEvent above)
            const resolvedStep: typeof step = reusablePropsCtx
              ? {
                  ...step,
                  ...(step.value != null ? { value: resolveWithProps(String(step.value), resolveBindingFn, reusablePropsCtx) } : {}),
                  ...(step.stateKey != null ? { stateKey: resolveWithProps(String(step.stateKey), resolveBindingFn, reusablePropsCtx) } : {}),
                  ...(step.customScript != null ? { customScript: resolveWithProps(String(step.customScript), resolveBindingFn, reusablePropsCtx) } : {}),
                }
              : step
            onRunEvent(resolvedStep, { type: ev, targetId: domId })
          }
        }
      }
    },
    [node.props, previewMode, onRunEvent, domId, resolveBindingFn, reusablePropsCtx]
  )

  // Keep all hooks at component top-level to preserve hook call order across renders.
  const inputValue = resolveWithProps(String(node.props.value ?? ''), resolveBindingFn, reusablePropsCtx) || ''
  const [localInputVal, setLocalInputVal] = useState(inputValue)
  useEffect(() => {
    if (node.type === 'input' || node.type === 'textInput') {
      setLocalInputVal(inputValue)
    }
  }, [node.type, inputValue])

  const numberValueResolved = resolveWithProps(String(node.props.value ?? ''), resolveBindingFn, reusablePropsCtx)
  const numVal = numberValueResolved === '' || numberValueResolved === ' ' ? '' : Number(numberValueResolved)
  const safeNum = numVal === '' || Number.isNaN(numVal as number) ? '' : (numVal as number)
  const [localNumVal, setLocalNumVal] = useState(safeNum === '' ? '' : String(safeNum))
  useEffect(() => {
    if (node.type === 'numberInput') {
      setLocalNumVal(safeNum === '' ? '' : String(safeNum))
    }
  }, [node.type, safeNum])

  const textareaValue = resolveWithProps(String(node.props.value ?? ''), resolveBindingFn, reusablePropsCtx)
  const [localTextareaVal, setLocalTextareaVal] = useState(textareaValue)
  useEffect(() => {
    if (node.type === 'textarea') {
      setLocalTextareaVal(textareaValue)
    }
  }, [node.type, textareaValue])

  const sliderResolvedValue = Number(resolveWithProps(String(node.props.value ?? 50), resolveBindingFn, reusablePropsCtx))
  const safeSliderVal = Number.isNaN(sliderResolvedValue) ? 50 : sliderResolvedValue
  const [localSliderVal, setLocalSliderVal] = useState(safeSliderVal)
  useEffect(() => {
    if (node.type === 'slider') {
      setLocalSliderVal(safeSliderVal)
    }
  }, [node.type, safeSliderVal])

  const tabsActiveIdx = Number(resolveWithProps(String(node.props.activeTab ?? 0), resolveBindingFn, reusablePropsCtx)) || 0
  const [localActive, setLocalActive] = useState(tabsActiveIdx)
  useEffect(() => {
    if (node.type === 'tabs') {
      setLocalActive(tabsActiveIdx)
    }
  }, [node.type, tabsActiveIdx])

  const accordionDefaultOpen = String(node.props.defaultOpen ?? '0').split(',').map(Number)
  const [openIdxs, setOpenIdxs] = useState<number[]>(accordionDefaultOpen)
  const accordionDefaultOpenKey = accordionDefaultOpen.join(',')
  useEffect(() => {
    if (node.type === 'accordion') {
      setOpenIdxs(accordionDefaultOpen)
    }
  }, [node.type, accordionDefaultOpenKey])

  const [tableSearch, setTableSearch] = useState('')
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)

  const rawToggleChecked = node.props.checked
  const toggleCheckedBinding = typeof rawToggleChecked === 'string' && /\{\{[^}]+\}\}/.test(rawToggleChecked)
  const toggleResolvedOn = toggleCheckedBinding
    ? (() => { const r = resolveWithProps(String(rawToggleChecked), resolveBindingFn, reusablePropsCtx); return r === 'true' || r === '1' })()
    : !!rawToggleChecked
  const [toggleOn, setToggleOn] = useState(toggleResolvedOn)
  useEffect(() => {
    if (node.type === 'toggle') {
      setToggleOn(toggleResolvedOn)
    }
  }, [node.type, toggleResolvedOn])

  const [ttVisible, setTtVisible] = useState(false)

  const _visibleWhenRaw = node.props?.visibleWhen != null ? String(node.props.visibleWhen).trim() : ''
  const _visibleWhenVisible = !_visibleWhenRaw || evaluateVisibleWhen(resolveWithProps(node.props.visibleWhen, resolveBindingFn, reusablePropsCtx), resolveBindingFn)
  const _visibleWhenMode = String(node.props?.visibleWhenMode ?? 'remove')
  const _shouldAnimateVisibleWhen = previewMode && node.type !== 'modal' && _visibleWhenMode === 'animate'

  if (_shouldAnimateVisibleWhen) {
    const durRaw = String(node.props?.visibleWhenDuration ?? '0.25s').trim()
    const easingRaw = String(node.props?.visibleWhenEasing ?? 'ease').trim()
    const dur = durRaw || '0.25s'
    const easing = easingRaw || 'ease'
    const offsetNum = Number(node.props?.visibleWhenOffset ?? 8)
    const offset = Number.isFinite(offsetNum) ? offsetNum : 8
    const styleObj = style as Record<string, unknown>
    const existingTransition = String(styleObj.transition ?? '').trim()
    const visTransition = `opacity ${dur} ${easing}, transform ${dur} ${easing}, filter ${dur} ${easing}`
    styleObj.transition = existingTransition ? `${existingTransition}, ${visTransition}` : visTransition

    const baseTransform = String(styleObj.transform ?? '').trim()
    if (_visibleWhenVisible) {
      styleObj.opacity = 1
      styleObj.transform = baseTransform || 'none'
      styleObj.visibility = 'visible'
      styleObj.filter = 'none'
    } else {
      styleObj.opacity = 0
      styleObj.transform = `${baseTransform}${baseTransform ? ' ' : ''}translateY(${offset}px)`
      styleObj.visibility = 'hidden'
      styleObj.pointerEvents = 'none'
      styleObj.filter = 'blur(1px)'
    }
  }

  // Modal handles its own visibility via `open` prop and/or `visibleWhen` — skip the generic kill here.
  if (previewMode && !_visibleWhenVisible && node.type !== 'modal' && !_shouldAnimateVisibleWhen) return null
  // In edit mode: if the condition is set and would hide this node, show it at 40% opacity so the builder can still select it.
  // Also zero out position/zIndex/inset so full-screen overlays (modals, backdrops) don't block the rest of the canvas.
  if (!previewMode && _visibleWhenRaw && !_visibleWhenVisible) {
    ;(style as Record<string, unknown>).opacity = 0.4
    ;(style as Record<string, unknown>).outline = '2px dashed #f59e0b'
    ;(style as Record<string, unknown>).pointerEvents = 'none'
    // If this was a fixed/absolute full-screen overlay, collapse it so it doesn't blanket the canvas
    const pos = (style as Record<string, unknown>).position
    if (pos === 'fixed' || pos === 'absolute') {
      ;(style as Record<string, unknown>).position = 'relative'
      ;(style as Record<string, unknown>).top = 'auto'
      ;(style as Record<string, unknown>).bottom = 'auto'
      ;(style as Record<string, unknown>).left = 'auto'
      ;(style as Record<string, unknown>).right = 'auto'
      ;(style as Record<string, unknown>).inset = 'auto'
      ;(style as Record<string, unknown>).zIndex = 'auto'
      ;(style as Record<string, unknown>).width = '100%'
      ;(style as Record<string, unknown>).height = 'auto'
      ;(style as Record<string, unknown>).minHeight = 0
      ;(style as Record<string, unknown>).backdropFilter = 'none'
    }
  }

  const suspenseEnabled = Boolean(node.props?.suspenseEnabled)
  const suspenseSmart = node.props?.suspenseSmart !== false
  const suspenseWhen = String(node.props?.suspenseWhen ?? '').trim()
  const suspenseVariant = String(node.props?.suspenseVariant ?? 'skeleton')
  const suspenseDirection = String(node.props?.suspenseDirection ?? 'horizontal')
  const suspenseLabel = String(node.props?.suspenseLabel ?? 'Loading...')
  const suspenseManualActive = suspenseWhen
    ? evaluateVisibleWhen(resolveWithProps(suspenseWhen, resolveBindingFn, reusablePropsCtx), resolveBindingFn)
    : false
  const suspenseReferencedSources = suspenseSmart ? extractDataSourcesFromUnknown(node.props) : []
  const suspenseAutoActive = suspenseReferencedSources.some(
    (source) => loadingSignals.pending.has(source) && !loadingSignals.resolved.has(source)
  )
  const showSuspenseFallback = suspenseEnabled && (
    (Boolean(previewMode) && (suspenseManualActive || suspenseAutoActive))
    || (!previewMode && suspenseManualActive)
  )

  if (showSuspenseFallback) {
    const widthRaw = style?.width == null ? '' : String(style.width).trim()
    const heightRaw = style?.height == null ? '' : String(style.height).trim()
    const constrainedSize = (widthRaw && widthRaw !== 'auto') || (heightRaw && heightRaw !== 'auto')
    const parsedWidth = Number.parseFloat(widthRaw)
    const parsedHeight = Number.parseFloat(heightRaw)
    const widthPx = Number.isFinite(parsedWidth) ? parsedWidth : null
    const heightPx = Number.isFinite(parsedHeight) ? parsedHeight : null
    const spinnerBoxSize = constrainedSize
      ? Math.max(24, Math.floor(Math.min(widthPx ?? heightPx ?? 56, heightPx ?? widthPx ?? 56) * 0.72))
      : 32
    const showSpinnerLabel = !constrainedSize || Math.min(widthPx ?? 9999, heightPx ?? 9999) >= 72
    const shellCls = `${constrainedSize ? 'w-full h-full' : 'inline-flex'} box-border min-w-0 min-h-0 text-gray-600 dark:text-gray-300`
    const bodyFrameCls = constrainedSize ? 'w-full h-full min-w-0 min-h-0' : 'inline-flex'
    const bodyPadCls = constrainedSize ? 'p-1.5' : 'p-2.5'
    const fallbackBody =
      suspenseVariant === 'spinner' ? (
        <div className={`${bodyFrameCls} flex ${constrainedSize ? 'items-center justify-center' : 'flex-col items-center justify-center gap-1.5'} ${bodyPadCls} overflow-visible`}>
          <svg
            className="animate-spin"
            style={{ width: spinnerBoxSize, height: spinnerBoxSize, color: '#2563eb', flexShrink: 0 }}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            role="img"
            aria-label="Loading"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {showSpinnerLabel && (
            <span className="text-[11px] font-medium tracking-wide uppercase text-gray-500 dark:text-gray-400 leading-tight max-w-full truncate">
              {suspenseLabel}
            </span>
          )}
        </div>
      ) : suspenseVariant === 'line' ? (
        <div className={`${bodyFrameCls} ${suspenseDirection === 'vertical' ? 'flex-col' : 'flex-row'} flex gap-1.5 ${bodyPadCls} overflow-hidden`}>
          <span className="bg-gray-200 dark:bg-[#21262d] animate-pulse rounded-md flex-1 min-w-0" />
          <span className="bg-gray-200 dark:bg-[#21262d] animate-pulse rounded-md flex-1 min-w-0" />
          <span className="bg-gray-200 dark:bg-[#21262d] animate-pulse rounded-md flex-1 min-w-0" />
        </div>
      ) : suspenseVariant === 'dots' ? (
        <div className={`${bodyFrameCls} flex items-center justify-center gap-1.5 ${bodyPadCls} overflow-hidden`}>
          <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-[#30363d] animate-pulse" />
          <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-[#30363d] animate-pulse [animation-delay:120ms]" />
          <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-[#30363d] animate-pulse [animation-delay:240ms]" />
        </div>
      ) : suspenseVariant === 'custom' ? (
        <div className={`${bodyFrameCls} flex items-center justify-center text-xs px-2 text-center overflow-hidden`}>
          <span className="max-w-full truncate">{suspenseLabel || 'Loading...'}</span>
        </div>
      ) : (
        <div className={`${bodyFrameCls} flex flex-col ${bodyPadCls} space-y-1.5 overflow-hidden`}>
          <div className="h-3 w-3/5 bg-gray-200 dark:bg-[#21262d] animate-pulse rounded" />
          <div className="h-3 w-4/5 bg-gray-200 dark:bg-[#21262d] animate-pulse rounded" />
          <div className="h-3 w-2/5 bg-gray-200 dark:bg-[#21262d] animate-pulse rounded" />
        </div>
      )

    return (
      <div
        id={domId}
        data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'}
        onDragStart={canDragNode ? handleDragStart : undefined}
        onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e: React.MouseEvent) => runConfiguredEvent('onClick', e) : (e: React.MouseEvent) => { e.stopPropagation(); onSelect(node.id) }}
          className={shellCls}
        style={{
          ...style,
          backgroundColor: (style as React.CSSProperties).backgroundColor ?? 'transparent',
          overflow: 'visible',
        }}
      >
        {fallbackBody}
      </div>
    )
  }

  if (node.type === 'reusableInstance') {
    const reusableId = String(node.props.reusableId ?? '')
    const reusable = reusableId ? reusablesById?.get(reusableId) : undefined
    if (!reusable) {
      if (!showMissingReusableWarning) return null
      return (
        <div className="text-xs px-2 py-1 rounded border border-dashed border-amber-400 text-amber-600">
          Missing reusable: {reusableId || 'unknown'}
        </div>
      )
    }
    const propBindings = (node.props.reusableProps ?? {}) as Record<string, unknown>
    const runtimeProps = Object.fromEntries(
      Object.entries(propBindings).map(([k, v]) => [k, resolveWithProps(v, resolveBindingFn, reusablePropsCtx)])
    )
    const namespacedRoot = cloneForReusableInstanceCached(reusable.root, `ri-${node.id}`)
    const handleReusableInternalSelect = (selectedNodeId: string | null) => {
      if (!previewMode) {
        onSelect(node.id)
        return
      }
      onSelect(selectedNodeId)
    }
    return (
      <div
        id={domId}
        data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'}
        onDragStart={canDragNode ? handleDragStart : undefined}
        onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e: React.MouseEvent) => runConfiguredEvent('onClick', e) : (e: React.MouseEvent) => { e.stopPropagation(); onSelect(node.id) }}
        className={previewMode ? 'rounded' : `rounded outline outline-2 ${isSelected ? 'outline-[var(--primary)]' : 'outline-transparent'}`}
        style={style}
      >
        <NodeRenderer
          node={namespacedRoot}
          selectedId={selectedId}
          onSelect={handleReusableInternalSelect}
          onUpdate={() => {}}
          onAddChild={onAddChild}
          onMove={onMove}
          onRunEvent={onRunEvent}
          isRoot={false}
          previewMode={previewMode}
          resolveBinding={resolveBindingFn}
          reusablesById={reusablesById}
          reusablePropsCtx={runtimeProps}
          draggingNodeId={draggingNodeId}
          onDragStartNode={onDragStartNode}
          onDragEndNode={onDragEndNode}
        />
      </div>
    )
  }

  if (node.type === 'container' || node.type === 'suspense' || semanticLayoutTypes.includes(node.type as any)) {
    // — Collapsible aside (preview + edit mode) —
    if (node.type === 'aside' && node.props?.collapsible) {
      const asideChildren = node.children.map((child) => (
        <NodeRenderer
          key={`${child.id}:${child.type}`}
          node={child}
          selectedId={selectedId}
          onSelect={onSelect}
          onUpdate={(updated) => {
            const newChildren = node.children.map((c) => (c.id === updated.id ? updated : c))
            onUpdate({ ...node, children: newChildren })
          }}
          onAddChild={onAddChild}
          onMove={onMove}
          onRunEvent={onRunEvent}
          isRoot={false}
          previewMode={previewMode}
          resolveBinding={resolveBindingFn}
          reusablesById={reusablesById}
          reusablePropsCtx={reusablePropsCtx}
          draggingNodeId={draggingNodeId}
          onDragStartNode={onDragStartNode}
          onDragEndNode={onDragEndNode}
        />
      ))
      return (
        <CollapsibleAsidePreview
          node={node}
          baseStyle={style}
          domId={domId}
          previewMode={previewMode}
          isSelected={isSelected}
          onEditSelect={(e) => { e.stopPropagation(); onSelect(node.id) }}
          runConfiguredEvent={(e) => runConfiguredEvent('onClick', e)}
        >
          {asideChildren}
        </CollapsibleAsidePreview>
      )
    }

    const semanticTagMap: Record<string, keyof JSX.IntrinsicElements> = {
      header: 'header',
      main: 'main',
      footer: 'footer',
      nav: 'nav',
      aside: 'aside',
      article: 'article',
    }
    const Tag = (semanticTagMap[node.type] ?? 'div') as any
    const hasCustomBg = previewMode ? false : !!(node.props?.backgroundColor != null && String(node.props.backgroundColor).trim())
    // If a collapsible aside is among my children, I need position:relative so the overlay drawer is contained.
    // For 'always' breakpoint: add static paddingLeft to clear the hamburger button.
    // For specific breakpoints: emit a scoped <style> tag so clearance applies only at the right viewport width.
    const collapsibleAsideChild = node.children.find(c => c.type === 'aside' && c.props?.collapsible)
    const hasCollapsibleAside = !!collapsibleAsideChild
    const hBpRaw = hasCollapsibleAside ? String((collapsibleAsideChild!.props as Record<string,unknown>).hamburgerBreakpoint ?? 'always') : 'never'
    const hamburgerClearance = hasCollapsibleAside
      ? Number((collapsibleAsideChild!.props as Record<string,unknown>).hamburgerLeft ?? 10) + 48
      : 0
    const bpMaxPx = HAMBURGER_BPS[hBpRaw] ?? 99999
    const containerStyle: React.CSSProperties = hasCollapsibleAside && hBpRaw !== 'never'
      ? { ...style, position: 'relative', ...(hBpRaw === 'always' ? { paddingLeft: hamburgerClearance } : {}) }
      : style
    const rootEditOutlineStyle: React.CSSProperties = !previewMode && isRoot && !suppressRootChrome
      ? {
          outline: isSelected ? '2px solid var(--primary)' : '2px dashed #111827',
          outlineOffset: '-2px',
        }
      : {}
    // Scoped clearance style for breakpoint-based hamburgers
    const clearanceStyleTag = hasCollapsibleAside && hBpRaw !== 'always' && hBpRaw !== 'never'
      ? `@media (max-width: ${bpMaxPx}px) { #${domId} { padding-left: ${hamburgerClearance}px !important; } }`
      : null
    const handleContainerEditSelect = (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation()
      const target = e.target as HTMLElement | null
      const hitNode = target?.closest?.('[data-node-id]') as HTMLElement | null
      const hitNodeId = hitNode?.getAttribute('data-node-id')
      if (hitNodeId && hitNodeId !== node.id) return
      onSelect(node.id)
    }
    return (
      <Tag
        id={domId}
        data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'}
        onDragStart={canDragNode ? handleDragStart : undefined}
        onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e: React.MouseEvent<HTMLElement>) => runConfiguredEvent('onClick', e) : handleContainerEditSelect}
        onDrop={previewMode ? undefined : handleDrop}
        onDragOver={previewMode ? undefined : handleDragOver}
        className={previewMode ? 'rounded box-border' : `relative ${isRoot ? 'rounded box-border' : `border-2 ${isSelected ? (hasCustomBg ? 'border-[var(--primary)]' : 'border-[var(--primary)] bg-[var(--primary)]/5') : 'border-gray-200 dark:border-[#30363d] border-dashed'} rounded box-border`}`}
        style={{ ...containerStyle, ...rootEditOutlineStyle }}
      >
        {/* Scoped clearance style: adds padding-left only when viewport ≤ breakpoint (hamburger visible) */}
        {clearanceStyleTag && <style>{clearanceStyleTag}</style>}
        {isSelected && !previewMode && !(isRoot && suppressRootChrome) && (
          <span className="absolute top-0 left-0 z-50 bg-[var(--primary)] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-br pointer-events-none leading-none">
            {node.type}
          </span>
        )}

        {node.children.length === 0 && !previewMode ? (
          <div
            className="text-xs text-gray-400 dark:text-gray-500 py-4 px-2 text-center min-h-[48px] flex items-center justify-center"
            onDragOver={previewMode ? undefined : (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
          >
            Drop components here
          </div>
        ) : (
            node.children.map((child) => (
              <NodeRenderer
                key={`${child.id}:${child.type}`}
                node={child}
                selectedId={selectedId}
                onSelect={onSelect}
                onUpdate={(updated) => {
                  const newChildren = node.children.map((c) => (c.id === updated.id ? updated : c))
                  onUpdate({ ...node, children: newChildren })
                }}
                onAddChild={onAddChild}
                onMove={onMove}
                onRunEvent={onRunEvent}
                isRoot={false}
                previewMode={previewMode}
                resolveBinding={resolveBindingFn}
                reusablesById={reusablesById}
                reusablePropsCtx={reusablePropsCtx}
                draggingNodeId={draggingNodeId}
                onDragStartNode={onDragStartNode}
                onDragEndNode={onDragEndNode}
              />
            ))
        )}
      </Tag>
    )
  }

  if (node.type === 'gestureDetector') {
    const behavior = String(node.props.behavior ?? 'opacity')
    const makeEventHandler =
      (ev: 'onClick' | 'onDoubleClick' | 'onMouseEnter' | 'onMouseLeave' | 'onPressIn' | 'onPressOut') =>
        (e: React.MouseEvent) => {
          e.stopPropagation()
          fireConfiguredEvent(ev, {
            pressed: ev === 'onPressIn' ? true : ev === 'onPressOut' ? false : undefined,
          })
        }
    // Use capture phase for click/doubleclick so the gestureDetector fires BEFORE
    // any child onClick handlers — stopPropagation then prevents children from
    // also firing setState actions that would clobber the gesture's result.
    const makeCaptureHandler =
      (ev: 'onClick' | 'onDoubleClick') =>
        (e: React.MouseEvent) => {
          e.stopPropagation()
          fireConfiguredEvent(ev, {})
        }
    const activeClass =
      behavior === 'opacity' ? 'active:opacity-70' : behavior === 'scale' ? 'active:scale-[0.98]' : ''
    return (
      <div
        id={domId}
        data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'}
        onDragStart={canDragNode ? handleDragStart : undefined}
        onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? undefined : (e) => { e.stopPropagation(); onSelect(node.id) }}
        onClickCapture={previewMode ? makeCaptureHandler('onClick') : undefined}
        onDoubleClick={previewMode ? undefined : undefined}
        onDoubleClickCapture={previewMode ? makeCaptureHandler('onDoubleClick') : undefined}
        onMouseEnter={previewMode ? makeEventHandler('onMouseEnter') : undefined}
        onMouseLeave={previewMode ? makeEventHandler('onMouseLeave') : undefined}
        onMouseDown={previewMode ? makeEventHandler('onPressIn') : undefined}
        onMouseUp={previewMode ? makeEventHandler('onPressOut') : undefined}
        onDrop={previewMode ? undefined : handleDrop}
        onDragOver={previewMode ? undefined : handleDragOver}
        className={`inline-block cursor-pointer transition-transform ${activeClass} ${previewMode ? 'rounded' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-gray-200 dark:border-[#30363d] border-dashed'} rounded`}`}
        style={style}
      >
        {(node.children ?? []).length > 0 ? (
          (node.children ?? []).map((child) => (
            <NodeRenderer
              key={`${child.id}:${child.type}`}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onUpdate={(up) => { const kids = node.children ?? []; const next = kids.map((c) => (c.id === up.id ? up : c)); onUpdate({ ...node, children: next }) }}
              onAddChild={onAddChild}
              onMove={onMove}
              onRunEvent={onRunEvent}
              isRoot={false}
              previewMode={previewMode}
              resolveBinding={resolveBindingFn}
              reusablesById={reusablesById}
              reusablePropsCtx={reusablePropsCtx}
              draggingNodeId={draggingNodeId}
              onDragStartNode={onDragStartNode}
              onDragEndNode={onDragEndNode}
            />
          ))
        ) : !previewMode ? (
          <div className="text-xs text-gray-400 dark:text-gray-500 py-4 px-2 text-center min-h-[32px] flex items-center justify-center" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}>
            Drop here (e.g. Image, Text)
          </div>
        ) : null}
      </div>
    )
  }

  if (node.type === 'text') {
    const variant = String(node.props.variant ?? 'body')
    const variantClass =
      variant === 'h1' ? 'text-2xl font-bold' :
      variant === 'h2' ? 'text-xl font-semibold' :
      variant === 'h3' ? 'text-lg font-medium' :
      variant === 'caption' ? 'text-sm text-[var(--text,#6b7280)] opacity-70' :
      variant === 'small' ? 'text-xs' : 'text-sm'
    return (
      <div
        id={domId}
        data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'}
        onDragStart={canDragNode ? handleDragStart : undefined}
        onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={previewMode ? 'px-2 py-1 rounded' : `px-2 py-1 border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'} rounded`}
        style={style}
      >
        <span className={variantClass} style={style}>{resolveWithProps(node.props.content ?? 'Text', resolveBindingFn, reusablePropsCtx)}</span>
      </div>
    )
  }

  if (node.type === 'gradientText') {
    const content = resolveWithProps(node.props.content ?? 'Gradient Text', resolveBindingFn, reusablePropsCtx)
    const gradient = resolveWithProps(String(node.props.gradient ?? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'), resolveBindingFn, reusablePropsCtx)
    const textStyle: React.CSSProperties = {
      background: gradient,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      WebkitTextFillColor: 'transparent',
      fontSize: typeof node.props.fontSize === 'number' ? `${node.props.fontSize}px` : (node.props.fontSize as string | undefined),
      fontWeight: node.props.fontWeight as React.CSSProperties['fontWeight'] ?? 700,
      lineHeight: node.props.lineHeight as React.CSSProperties['lineHeight'] ?? 1.1,
      backgroundSize: String(node.props.backgroundSize ?? '200% 200%'),
      animation: String(node.props.animation ?? ''),
      textAlign: (node.props.textAlign as React.CSSProperties['textAlign']) ?? 'left',
      display: 'inline-block',
      width: '100%',
    }
    return (
      <div
        id={domId}
        data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'}
        onDragStart={canDragNode ? handleDragStart : undefined}
        onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={previewMode ? 'px-2 py-1 rounded' : `px-2 py-1 border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'} rounded`}
        style={style}
      >
        <span style={textStyle}>{content}</span>
      </div>
    )
  }

  if (node.type === 'gradientSvg') {
    const svgWidth = Number(node.props.width ?? 240)
    const svgHeight = Number(node.props.height ?? 140)
    const shape = String(node.props.shape ?? 'wave')
    const gradient = resolveWithProps(String(node.props.gradient ?? 'linear-gradient(90deg, #22d3ee 0%, #6366f1 100%)'), resolveBindingFn, reusablePropsCtx)
    const strokeColor = resolveWithProps(String(node.props.strokeColor ?? ''), resolveBindingFn, reusablePropsCtx)
    const strokeWidth = Number(node.props.strokeWidth ?? 0)
    const colors = extractGradientColors(gradient)
    const gradId = `grad-${node.id}`
    const animationShorthand = String(node.props.animation ?? '')
    const elementAnimation = animationShorthand
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && !part.includes('dccGradientShiftX') && !part.includes('dccGradientShiftY') && !part.includes('dccGradientRotate'))
      .join(', ')
    const animationDurationSecMatch = animationShorthand.match(/(\d*\.?\d+)s/)
    const gradientAnimDuration = `${animationDurationSecMatch ? Number(animationDurationSecMatch[1]) : 8}s`
    const animatesShiftX = animationShorthand.includes('dccGradientShiftX')
    const animatesShiftY = animationShorthand.includes('dccGradientShiftY')
    const animatesRotate = animationShorthand.includes('dccGradientRotate')

    const pathByShape: Record<string, string> = {
      wave: 'M 0 70 C 35 10 85 130 120 70 C 155 10 205 130 240 70 L 240 140 L 0 140 Z',
      blob: 'M 120 14 C 156 14 196 28 212 58 C 228 88 220 132 192 156 C 164 180 116 184 76 172 C 36 160 4 132 6 98 C 8 64 44 24 82 16 C 94 14 106 14 120 14 Z',
      ring: 'M 120 20 A 50 50 0 1 1 119.9 20 Z M 120 58 A 12 12 0 1 0 120.1 58 Z',
      diamond: 'M 120 12 L 228 70 L 120 128 L 12 70 Z',
    }

    return (
      <div
        id={domId}
        data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'}
        onDragStart={canDragNode ? handleDragStart : undefined}
        onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={previewMode ? 'inline-block rounded' : `inline-block border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'} rounded`}
        style={style}
      >
        <svg width={svgWidth} height={svgHeight} viewBox="0 0 240 140" style={{ display: 'block', animation: elementAnimation, opacity: Number(node.props.opacity ?? 1) }}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              {animatesShiftX && (
                <>
                  <animate attributeName="x1" values="0%;100%;0%" dur={gradientAnimDuration} repeatCount="indefinite" />
                  <animate attributeName="x2" values="100%;200%;100%" dur={gradientAnimDuration} repeatCount="indefinite" />
                </>
              )}
              {animatesShiftY && (
                <>
                  <animate attributeName="y1" values="0%;100%;0%" dur={gradientAnimDuration} repeatCount="indefinite" />
                  <animate attributeName="y2" values="100%;200%;100%" dur={gradientAnimDuration} repeatCount="indefinite" />
                </>
              )}
              {animatesRotate && (
                <animateTransform
                  attributeName="gradientTransform"
                  type="rotate"
                  from="0 120 70"
                  to="360 120 70"
                  dur={gradientAnimDuration}
                  repeatCount="indefinite"
                />
              )}
              {colors.map((c, idx) => (
                <stop key={`${c}-${idx}`} offset={`${(idx / Math.max(1, colors.length - 1)) * 100}%`} stopColor={c} />
              ))}
            </linearGradient>
          </defs>
          <path
            d={pathByShape[shape] ?? pathByShape.wave}
            fill={`url(#${gradId})`}
            stroke={strokeColor || 'none'}
            strokeWidth={strokeWidth > 0 ? strokeWidth : undefined}
            fillRule={shape === 'ring' ? 'evenodd' : undefined}
          />
        </svg>
      </div>
    )
  }

  if (node.type === 'button') {
    const v = String(node.props.variant ?? 'primary')
    const btnClass =
      v === 'primary' ? 'bg-[var(--primary,#2563eb)] text-white' :
      v === 'secondary' ? 'bg-[var(--surface,#f1f5f9)] text-[var(--text,#1f2937)] border border-[var(--border-color,#e5e7eb)]' :
      v === 'outline' ? 'border border-[var(--border-color,#e5e7eb)] text-[var(--text,#1f2937)] bg-transparent' :
      'bg-transparent text-[var(--text,#1f2937)] hover:bg-[var(--surface,#f1f5f9)]'
    return (
      <div
        id={domId}
        data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'}
        onDragStart={canDragNode ? handleDragStart : undefined}
        onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? undefined : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={previewMode ? 'inline-block rounded' : `inline-block border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'} rounded`}
      >
        <button type="button" onClick={previewMode ? (e) => { e.stopPropagation(); fireConfiguredEvent('onClick', {}) } : undefined} className={`text-sm px-3 py-1.5 rounded ${previewMode ? '' : 'pointer-events-none'} ${btnClass}`} style={style}>
          {resolveWithProps(node.props.label ?? 'Button', resolveBindingFn, reusablePropsCtx)}
        </button>
      </div>
    )
  }

  if (node.type === 'input' || node.type === 'textInput') {
    const inputCls = 'text-sm border border-[var(--border-color,#e5e7eb)] bg-[var(--surface,#f9fafb)] text-[var(--text,#1f2937)] px-2 py-1 w-full'
    return (
      <div
        id={domId}
        data-node-id={node.id}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={previewMode ? 'px-2 py-1 rounded' : `px-2 py-1 border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'} rounded`}
        style={style}
      >
        {node.props.label ? <label className="block text-xs text-[var(--text,#374151)] mb-0.5">{resolveWithProps(node.props.label, resolveBindingFn, reusablePropsCtx)}</label> : null}
        {previewMode ? (
          <input
            type="text"
            value={localInputVal}
            placeholder={resolveWithProps(node.props.placeholder ?? '', resolveBindingFn, reusablePropsCtx) || ' '}
            className={inputCls}
            onInput={(e) => { const v = (e.target as HTMLInputElement).value; setLocalInputVal(v); fireConfiguredEvent('onInput', { value: v }) }}
            onChange={(e) => { const v = (e.target as HTMLInputElement).value; setLocalInputVal(v); fireConfiguredEvent('onChange', { value: v }) }}
          />
        ) : (
          <input type="text" value={inputValue || ' '} placeholder={resolveWithProps(node.props.placeholder ?? '', resolveBindingFn, reusablePropsCtx) || ' '} className={`${inputCls} pointer-events-none`} readOnly />
        )}
      </div>
    )
  }

  if (node.type === 'section' || node.type === 'stackV' || node.type === 'stackH') {
    return (
      <div
        id={domId}
        data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'}
        onDragStart={canDragNode ? handleDragStart : undefined}
        onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? undefined : (e) => { e.stopPropagation(); onSelect(node.id) }}
        onDrop={previewMode ? undefined : handleDrop}
        onDragOver={previewMode ? undefined : handleDragOver}
        className={previewMode ? 'rounded box-border' : `border-2 ${isSelected ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-gray-200 dark:border-[#30363d] border-dashed'} rounded box-border`}
        style={style}
      >
        {node.type === 'section' && (node.props.title || true) && (
          <span className="text-xs font-medium text-[var(--text,#4b5563)] block mb-1">
            {resolveWithProps(node.props.title || 'Section', resolveBindingFn, reusablePropsCtx)}
          </span>
        )}
        {(node.children ?? []).length ? (node.children ?? []).map((child) => (
          <NodeRenderer key={`${child.id}:${child.type}`} node={child} selectedId={selectedId} onSelect={onSelect} onUpdate={(up) => { const kids = node.children ?? []; const next = kids.map((c) => (c.id === up.id ? up : c)); onUpdate({ ...node, children: next }) }} onAddChild={onAddChild} onMove={onMove} onRunEvent={onRunEvent} isRoot={false} previewMode={previewMode} resolveBinding={resolveBindingFn} reusablesById={reusablesById} reusablePropsCtx={reusablePropsCtx} draggingNodeId={draggingNodeId} onDragStartNode={onDragStartNode} onDragEndNode={onDragEndNode} />
        )) : !previewMode ? (
          <span className="text-xs text-gray-400 py-3 px-2 block text-center min-h-[32px] flex items-center justify-center" onDragOver={previewMode ? undefined : (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}>Drop here</span>
        ) : null}
      </div>
    )
  }

  if (node.type === 'image') {
    const url = resolveWithProps(String(node.props.url ?? ''), resolveBindingFn, reusablePropsCtx)
    const alt = resolveWithProps(String(node.props.alt ?? ''), resolveBindingFn, reusablePropsCtx)
    const imgStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      display: 'block',
      objectFit: (node.props.objectFit as React.CSSProperties['objectFit']) || 'cover',
      objectPosition: (node.props.objectPosition as string) || 'center',
    }
    const wrapperStyle: React.CSSProperties = { ...style, overflow: 'hidden' }
    if (wrapperStyle.width == null && wrapperStyle.minWidth == null) wrapperStyle.minWidth = 200
    if (wrapperStyle.height == null && wrapperStyle.minHeight == null) wrapperStyle.minHeight = 150
    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined} onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }} className={previewMode ? 'inline-block' : `inline-block border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'}`} style={wrapperStyle}>
        {url && url.trim() ? (
          <img src={url.trim()} alt={alt} style={imgStyle} className={previewMode ? '' : 'pointer-events-none'} />
        ) : (
          <span className="inline-block w-full h-full min-w-[200px] min-h-[150px] bg-gray-200 dark:bg-[#30363d] text-xs text-gray-500 flex items-center justify-center">Image</span>
        )}
      </div>
    )
  }

  if (node.type === 'icon') {
    const iconName = resolveWithProps(String(node.props.icon ?? ''), resolveBindingFn, reusablePropsCtx).trim()
    const size = Number(node.props.size ?? 24)
    const color = resolveWithProps(String(node.props.color ?? ''), resolveBindingFn, reusablePropsCtx).trim()
    const wrapperStyle: React.CSSProperties = { ...style, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
    // Use Iconify public CDN API — no npm package needed, works in all environments
    // Icon format: "prefix:name" e.g. "mdi:home", "lucide:star", "heroicons:user"
    const parts = iconName.split(':')
    const iconUrl = parts.length === 2
      ? `https://api.iconify.design/${parts[0]}/${parts[1]}.svg${color ? `?color=${encodeURIComponent(color)}` : ''}`
      : ''
    return (
      <div
        id={domId}
        data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'}
        onDragStart={canDragNode ? handleDragStart : undefined}
        onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={previewMode ? '' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'} rounded`}
        style={wrapperStyle}
        title={!previewMode ? `Icon: ${iconName || 'set an icon name in Content tab'}` : undefined}
      >
        {iconUrl
          ? <img src={iconUrl} alt={iconName} width={size} height={size} style={{ display: 'block' }} className={previewMode ? '' : 'pointer-events-none'} />
          : <span className="flex items-center justify-center bg-gray-100 dark:bg-[#21262d] rounded text-xs text-gray-400" style={{ width: size, height: size }}>⭐</span>
        }
      </div>
    )
  }

  if (node.type === 'divider') {
    const orientation = String(node.props.orientation ?? 'horizontal')
    const thickness = Number(node.props.thickness ?? 1)
    const color = resolveWithProps(String(node.props.color ?? '#e5e7eb'), resolveBindingFn, reusablePropsCtx) || '#e5e7eb'
    const dividerStyle: React.CSSProperties = {
      ...style,
      border: 'none',
      background: color,
      ...(orientation === 'vertical'
        ? { width: `${Number.isNaN(thickness) ? 1 : thickness}px`, height: style.height ?? '100%' }
        : { height: `${Number.isNaN(thickness) ? 1 : thickness}px`, width: style.width ?? '100%' }),
    }
    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined} onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }} className={previewMode ? 'rounded' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'} rounded`} style={dividerStyle} />
    )
  }

  if (node.type === 'spacer') {
    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined} onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }} className={previewMode ? '' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-dashed border-gray-200 dark:border-[#30363d]'}`} style={style} />
    )
  }

  if (node.type === 'table') {
    const colStr = resolveWithProps(node.props.columns ?? '', resolveBindingFn, reusablePropsCtx)
    const columns = colStr.trim() ? colStr.split(',').map((s) => s.trim()) : ['Column']
    const rowStr = resolveWithProps(node.props.rows ?? '', resolveBindingFn, reusablePropsCtx)
    // Support both CSV rows and JSON array
    let rows: string[][] = []
    if (rowStr.trim()) {
      if (rowStr.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(rowStr)
          if (Array.isArray(parsed)) {
            rows = parsed.map((item: Record<string, unknown>) =>
              columns.map((col) => String(item[col] ?? item[col.toLowerCase()] ?? ''))
            )
          }
        } catch { rows = rowStr.split('\n').map((r) => r.split(',').map((s) => s.trim())) }
      } else {
        rows = rowStr.split('\n').map((r) => r.split(',').map((s) => s.trim()))
      }
    }

    const showExport = !!node.props.showExport
    const showSearch = !!node.props.showSearch
    const sortable = !!node.props.sortable
    const paginate = !!node.props.paginate
    const pageSize = Number(node.props.pageSize) || 10
    const striped = !!node.props.striped
    const compact = !!node.props.compact

    let filteredRows = rows
    if (showSearch && tableSearch.trim()) {
      const q = tableSearch.toLowerCase()
      filteredRows = filteredRows.filter((r) => r.some((cell) => cell.toLowerCase().includes(q)))
    }
    if (sortable && sortCol !== null) {
      filteredRows = [...filteredRows].sort((a, b) => {
        const va = a[sortCol] ?? ''
        const vb = b[sortCol] ?? ''
        const na = Number(va), nb = Number(vb)
        const cmp = !Number.isNaN(na) && !Number.isNaN(nb) ? na - nb : va.localeCompare(vb)
        return sortAsc ? cmp : -cmp
      })
    }
    const totalPages = paginate ? Math.max(1, Math.ceil(filteredRows.length / pageSize)) : 1
    const displayRows = paginate ? filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize) : filteredRows

    const exportCsv = () => {
      const header = columns.join(',')
      const body = filteredRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'export.csv'; a.click()
      URL.revokeObjectURL(url)
    }
    const exportJson = () => {
      const data = filteredRows.map((r) => {
        const obj: Record<string, string> = {}
        columns.forEach((col, i) => { obj[col] = r[i] ?? '' })
        return obj
      })
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'export.json'; a.click()
      URL.revokeObjectURL(url)
    }
    const copyToClipboard = () => {
      const header = columns.join('\t')
      const body = filteredRows.map((r) => r.join('\t')).join('\n')
      navigator.clipboard.writeText(header + '\n' + body)
    }

    const cellPad = compact ? 'px-1.5 py-0.5' : 'px-2 py-1'

    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined} onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }} className={previewMode ? 'overflow-auto rounded' : `overflow-auto border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'} rounded`} style={style}>
        {/* Toolbar */}
        {(showSearch || showExport) && (
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117]">
            {showSearch && (
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => { setTableSearch(e.target.value); setCurrentPage(0) }}
                placeholder="Search table…"
                className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-black dark:text-white rounded"
              />
            )}
            {showExport && previewMode && (
              <div className="flex gap-1 shrink-0">
                <button type="button" onClick={exportCsv} className="px-2 py-1 text-[10px] font-medium border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d] text-gray-600 dark:text-gray-300">CSV</button>
                <button type="button" onClick={exportJson} className="px-2 py-1 text-[10px] font-medium border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d] text-gray-600 dark:text-gray-300">JSON</button>
                <button type="button" onClick={copyToClipboard} className="px-2 py-1 text-[10px] font-medium border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d] text-gray-600 dark:text-gray-300">Copy</button>
              </div>
            )}
            {showExport && !previewMode && (
              <span className="text-[10px] text-gray-400">Export: CSV / JSON / Copy</span>
            )}
          </div>
        )}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {columns.map((h, i) => (
                <th
                  key={i}
                  className={`border border-gray-200 dark:border-[#30363d] ${cellPad} text-left text-black dark:text-white ${sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-[#21262d] select-none' : ''}`}
                  onClick={sortable ? () => { if (sortCol === i) setSortAsc(!sortAsc); else { setSortCol(i); setSortAsc(true) } } : undefined}
                >
                  {h}
                  {sortable && sortCol === i && <span className="ml-1 text-[10px]">{sortAsc ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i} className={striped && i % 2 === 1 ? 'bg-gray-50 dark:bg-[#0d1117]' : ''}>
                {columns.map((_, j) => (
                  <td key={j} className={`border border-gray-200 dark:border-[#30363d] ${cellPad} text-gray-600 dark:text-gray-300`}>{row[j] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {displayRows.length === 0 && <div className="p-2 text-xs text-gray-400">Table (add rows in props)</div>}
        {/* Pagination */}
        {paginate && totalPages > 1 && (
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117]">
            <span className="text-[10px] text-gray-500">{filteredRows.length} rows · Page {currentPage + 1}/{totalPages}</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0} className="px-2 py-0.5 text-[10px] border border-gray-300 dark:border-[#30363d] rounded disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-[#21262d] text-gray-600 dark:text-gray-300">← Prev</button>
              <button type="button" onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))} disabled={currentPage >= totalPages - 1} className="px-2 py-0.5 text-[10px] border border-gray-300 dark:border-[#30363d] rounded disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-[#21262d] text-gray-600 dark:text-gray-300">Next →</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (node.type === 'link') {
    const hrefRaw = resolveWithProps(node.props.url ?? '#', resolveBindingFn, reusablePropsCtx) || '#'
    const isScreenNav = hrefRaw.startsWith('screen:')
    const screenId = isScreenNav ? hrefRaw.slice(7) : null
    const handleLinkClick = (e: React.MouseEvent) => {
      if (!previewMode) { e.stopPropagation(); onSelect(node.id); return }
      runConfiguredEvent('onClick', e)
      if (isScreenNav && screenId && onRunEvent) {
        onRunEvent({ action: 'navigate', targetScreenId: screenId }, { type: 'click', targetId: domId })
      }
    }
    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined} onClick={handleLinkClick} className={previewMode ? 'inline-block rounded px-2 py-1' : `inline-block border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'} rounded px-2 py-1`} style={style}>
        {isScreenNav ? (
          <span className={`text-sm text-[var(--primary)] underline ${previewMode ? 'cursor-pointer' : 'pointer-events-none'}`} style={style}>
            {resolveWithProps(node.props.label ?? 'Link', resolveBindingFn, reusablePropsCtx)}
            {!previewMode && <span className="ml-1 text-[10px] opacity-60">(→ screen)</span>}
          </span>
        ) : (
          <a href={previewMode ? hrefRaw : undefined} onClick={previewMode ? undefined : (e) => e.preventDefault()} className={`text-sm text-[var(--primary)] underline ${previewMode ? '' : 'pointer-events-none'}`} style={style}>{resolveWithProps(node.props.label ?? 'Link', resolveBindingFn, reusablePropsCtx)}</a>
        )}
      </div>
    )
  }

  if (node.type === 'numberInput') {
    const numCls = 'text-sm border border-[var(--border-color,#e5e7eb)] bg-[var(--surface,#f9fafb)] text-[var(--text,#1f2937)] px-2 py-1 w-full'
    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined} onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }} className={previewMode ? 'px-2 py-1 rounded' : `px-2 py-1 border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'} rounded`} style={style}>
        {node.props.label ? <label className="block text-xs text-[var(--text,#374151)] mb-0.5">{resolveWithProps(node.props.label, resolveBindingFn, reusablePropsCtx)}</label> : null}
        {previewMode ? (
          <input
            type="number"
            value={localNumVal}
            placeholder={resolveWithProps(node.props.placeholder ?? '0', resolveBindingFn, reusablePropsCtx) || '0'}
            className={numCls}
            onInput={(e) => { const v = (e.target as HTMLInputElement).value; setLocalNumVal(v); fireConfiguredEvent('onInput', { value: v }) }}
            onChange={(e) => { const v = (e.target as HTMLInputElement).value; setLocalNumVal(v); fireConfiguredEvent('onChange', { value: v }) }}
          />
        ) : (
          <input type="number" value={safeNum} placeholder={resolveWithProps(node.props.placeholder ?? '0', resolveBindingFn, reusablePropsCtx) || '0'} className={`${numCls} pointer-events-none`} readOnly />
        )}
      </div>
    )
  }

  if (node.type === 'dropdown') {
    const optsStr = resolveWithProps(node.props.options ?? '', resolveBindingFn, reusablePropsCtx)
    const opts = optsStr ? optsStr.split(',').map((s) => s.trim()).filter(Boolean) : []
    const valueResolved = resolveWithProps(String(node.props.value ?? ''), resolveBindingFn, reusablePropsCtx)
    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined} onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }} className={previewMode ? 'px-2 py-1 rounded' : `px-2 py-1 border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'} rounded`} style={style}>
        {node.props.label ? <label className="block text-xs text-[var(--text,#374151)] mb-0.5">{resolveWithProps(node.props.label, resolveBindingFn, reusablePropsCtx)}</label> : null}
        <select
          value={valueResolved || ''}
          className={`text-sm border border-[var(--border-color,#e5e7eb)] bg-[var(--surface,#f9fafb)] text-[var(--text,#1f2937)] px-2 py-1 w-full ${previewMode ? '' : 'pointer-events-none'}`}
          disabled={!previewMode}
          onChange={(e) => fireConfiguredEvent('onChange', { value: e.target.value })}
        >
          <option value="">—</option>
          {opts.map((o, i) => <option key={i} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }

  if (node.type === 'checkbox') {
    const rawChecked = node.props.checked
    const isBinding = typeof rawChecked === 'string' && /\{\{[^}]+\}\}/.test(rawChecked)
    const checked = isBinding
      ? (() => { const r = resolveWithProps(String(rawChecked), resolveBindingFn, reusablePropsCtx); return r === 'true' || r === '1' || r.toLowerCase() === 'yes' })()
      : !!rawChecked
    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined} onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }} className={previewMode ? 'inline-flex items-center gap-2 px-2 py-1 rounded' : `inline-flex items-center gap-2 px-2 py-1 border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'} rounded`} style={style}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => fireConfiguredEvent('onChange', { checked: e.target.checked, value: e.target.checked })}
          className={previewMode ? '' : 'pointer-events-none'}
        />
        <span className="text-sm text-[var(--text,#1f2937)]">{resolveWithProps(node.props.label ?? 'Checkbox', resolveBindingFn, reusablePropsCtx)}</span>
      </div>
    )
  }

  // ─── textarea ─────────────────────────────────────────────────────────────
  if (node.type === 'textarea') {
    const rows = Number(node.props.rows ?? 4)
    const textareaCls = `text-sm border border-[var(--border-color,#e5e7eb)] bg-[var(--surface,#f9fafb)] text-[var(--text,#1f2937)] px-2 py-1 w-full resize-y ${previewMode ? '' : 'pointer-events-none'}`
    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined} onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }} className={previewMode ? 'px-2 py-1 rounded' : `px-2 py-1 border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'} rounded`} style={style}>
        {node.props.label ? <label className="block text-xs text-[var(--text,#374151)] mb-0.5">{resolveWithProps(node.props.label, resolveBindingFn, reusablePropsCtx)}</label> : null}
        <textarea rows={rows} value={previewMode ? localTextareaVal : textareaValue} placeholder={resolveWithProps(String(node.props.placeholder ?? ''), resolveBindingFn, reusablePropsCtx)}
          readOnly={!previewMode}
          onInput={(e) => { const v = (e.target as HTMLTextAreaElement).value; setLocalTextareaVal(v); fireConfiguredEvent('onInput', { value: v }) }}
          onChange={(e) => { const v = (e.target as HTMLTextAreaElement).value; setLocalTextareaVal(v); fireConfiguredEvent('onChange', { value: v }) }}
          className={textareaCls}
        />
      </div>
    )
  }

  // ─── toggle ───────────────────────────────────────────────────────────────
  if (node.type === 'toggle') {
    const labelPos = String(node.props.labelPosition ?? 'right')
    const labelEl = <span className="text-sm text-[var(--text,#1f2937)]">{resolveWithProps(node.props.label ?? 'Toggle', resolveBindingFn, reusablePropsCtx)}</span>
    const trackEl = (
      <button type="button"
        onClick={previewMode ? () => { setToggleOn(v => { fireConfiguredEvent('onChange', { checked: !v, value: !v }); return !v }) } : undefined}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${toggleOn ? 'bg-[var(--primary,#2563eb)]' : 'bg-gray-300 dark:bg-[#30363d]'} ${previewMode ? 'cursor-pointer' : 'cursor-default'}`}
        style={{ outline: 'none' }}
      >
        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${toggleOn ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    )
    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`inline-flex items-center gap-2 px-2 py-1 ${previewMode ? '' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'}`}`} style={style}>
        {labelPos === 'left' && labelEl}
        {trackEl}
        {labelPos !== 'left' && labelEl}
      </div>
    )
  }

  // ─── radioGroup ───────────────────────────────────────────────────────────
  if (node.type === 'radioGroup') {
    const optsStr = resolveWithProps(String(node.props.options ?? ''), resolveBindingFn, reusablePropsCtx)
    const opts = optsStr ? optsStr.split(',').map(s => s.trim()).filter(Boolean) : []
    const val = resolveWithProps(String(node.props.value ?? ''), resolveBindingFn, reusablePropsCtx)
    const isHoriz = String(node.props.layout ?? 'vertical') === 'horizontal'
    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`px-2 py-1 ${previewMode ? '' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'}`}`} style={style}>
        {node.props.label ? <label className="block text-xs text-[var(--text,#374151)] mb-1">{resolveWithProps(node.props.label, resolveBindingFn, reusablePropsCtx)}</label> : null}
        <div className={`flex ${isHoriz ? 'flex-row flex-wrap gap-4' : 'flex-col gap-1.5'}`}>
          {opts.map((o) => (
            <label key={o} className={`inline-flex items-center gap-2 text-sm text-[var(--text,#1f2937)] ${previewMode ? 'cursor-pointer' : 'cursor-default'}`}>
              <input type="radio" name={domId} value={o} checked={val === o} readOnly={!previewMode}
                onChange={previewMode ? () => fireConfiguredEvent('onChange', { value: o }) : undefined}
                className={previewMode ? '' : 'pointer-events-none'} />
              {o}
            </label>
          ))}
        </div>
      </div>
    )
  }

  // ─── slider ───────────────────────────────────────────────────────────────
  if (node.type === 'slider') {
    const min = Number(resolveWithProps(String(node.props.min ?? 0), resolveBindingFn, reusablePropsCtx))
    const max = Number(resolveWithProps(String(node.props.max ?? 100), resolveBindingFn, reusablePropsCtx))
    const step = Number(node.props.step ?? 1)
    const showValue = node.props.showValue !== false
    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`px-2 py-1 ${previewMode ? '' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'}`}`} style={style}>
        {node.props.label ? <label className="block text-xs text-[var(--text,#374151)] mb-1">{resolveWithProps(node.props.label, resolveBindingFn, reusablePropsCtx)}</label> : null}
        <div className="flex items-center gap-2">
          <input type="range" min={min} max={max} step={step} value={localSliderVal}
            onInput={(e) => { const v = Number((e.target as HTMLInputElement).value); setLocalSliderVal(v); fireConfiguredEvent('onInput', { value: v }) }}
            onChange={(e) => { const v = Number((e.target as HTMLInputElement).value); setLocalSliderVal(v); fireConfiguredEvent('onChange', { value: v }) }}
            className={`flex-1 accent-[var(--primary,#2563eb)] ${previewMode ? '' : 'pointer-events-none'}`} />
          {showValue && <span className="text-xs text-[var(--text,#6b7280)] w-8 text-right">{localSliderVal}</span>}
        </div>
      </div>
    )
  }

  // ─── datepicker ───────────────────────────────────────────────────────────
  if (node.type === 'datepicker') {
    const val = resolveWithProps(String(node.props.value ?? ''), resolveBindingFn, reusablePropsCtx)
    const type = String(node.props.type ?? 'date') as React.HTMLInputTypeAttribute
    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`px-2 py-1 ${previewMode ? '' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'}`}`} style={style}>
        {node.props.label ? <label className="block text-xs text-[var(--text,#374151)] mb-1">{resolveWithProps(node.props.label, resolveBindingFn, reusablePropsCtx)}</label> : null}
        <input type={type} defaultValue={val}
          onChange={(e) => fireConfiguredEvent('onChange', { value: e.target.value })}
          className={`text-sm border border-[var(--border-color,#e5e7eb)] bg-[var(--surface,#f9fafb)] text-[var(--text,#1f2937)] px-2 py-1 w-full ${previewMode ? '' : 'pointer-events-none'}`} />
      </div>
    )
  }

  // ─── fileUpload ───────────────────────────────────────────────────────────
  if (node.type === 'fileUpload') {
    const accept = String(node.props.accept ?? '')
    const multiple = !!node.props.multiple
    const dragDrop = node.props.dragDrop !== false
    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`p-2 ${previewMode ? '' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'}`}`} style={style}>
        {dragDrop ? (
          <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-[#30363d] rounded p-6 text-gray-500 dark:text-gray-400 text-sm ${previewMode ? 'cursor-pointer hover:border-[var(--primary,#2563eb)]' : 'cursor-default'}`}>
            <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            <span>{resolveWithProps(String(node.props.label ?? 'Choose file'), resolveBindingFn, reusablePropsCtx)}</span>
            {accept && <span className="text-xs opacity-60">{accept}</span>}
            {previewMode && <input type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => fireConfiguredEvent('onChange', { value: e.target.files })} />}
          </label>
        ) : (
          <div className={`flex items-center gap-2 ${previewMode ? '' : 'pointer-events-none'}`}>
            <input type="file" accept={accept} multiple={multiple} onChange={(e) => fireConfiguredEvent('onChange', { value: e.target.files })} />
          </div>
        )}
      </div>
    )
  }

  // ─── searchInput ──────────────────────────────────────────────────────────
  if (node.type === 'searchInput') {
    const val = resolveWithProps(String(node.props.value ?? ''), resolveBindingFn, reusablePropsCtx)
    const suggestionsStr = resolveWithProps(String(node.props.suggestions ?? ''), resolveBindingFn, reusablePropsCtx)
    const suggestions = suggestionsStr ? suggestionsStr.split(',').map(s => s.trim()).filter(Boolean) : []
    return (
      <div id={domId} data-node-id={node.id} draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`px-2 py-1 relative ${previewMode ? '' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'}`}`} style={style}>
        {node.props.label ? <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">{resolveWithProps(node.props.label, resolveBindingFn, reusablePropsCtx)}</label> : null}
        <div className="relative flex items-center">
          <svg className="absolute left-2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="search" defaultValue={val} placeholder={resolveWithProps(String(node.props.placeholder ?? 'Search…'), resolveBindingFn, reusablePropsCtx) || 'Search…'}
            list={suggestions.length ? `${domId}-list` : undefined}
            onInput={(e) => fireConfiguredEvent('onInput', { value: (e.target as HTMLInputElement).value })}
            onChange={(e) => fireConfiguredEvent('onChange', { value: (e.target as HTMLInputElement).value })}
            onKeyDown={(e) => { if (e.key === 'Enter') fireConfiguredEvent('onSubmit', { value: (e.target as HTMLInputElement).value }) }}
            className={`text-sm border border-[var(--border-color,#e5e7eb)] bg-[var(--surface,#f9fafb)] text-[var(--text,#1f2937)] pl-8 pr-2 py-1 w-full ${previewMode ? '' : 'pointer-events-none'}`} />
        </div>
        {suggestions.length > 0 && <datalist id={`${domId}-list`}>{suggestions.map((s, i) => <option key={i} value={s} />)}</datalist>}
      </div>
    )
  }

  // ─── formWrapper ──────────────────────────────────────────────────────────
  if (node.type === 'formWrapper') {
    const submitLabel = resolveWithProps(String(node.props.submitLabel ?? 'Submit'), resolveBindingFn, reusablePropsCtx)
    const childEls = (node.children ?? []).map((child) => (
      <NodeRenderer key={`${child.id}:${child.type}`} node={child} selectedId={selectedId} onSelect={onSelect}
        onUpdate={(up) => { const kids = node.children ?? []; const next = kids.map(c => c.id === up.id ? up : c); onUpdate({ ...node, children: next }) }}
        onAddChild={onAddChild} onMove={onMove} onRunEvent={onRunEvent} isRoot={false} previewMode={previewMode}
        resolveBinding={resolveBindingFn} reusablesById={reusablesById} reusablePropsCtx={reusablePropsCtx}
        draggingNodeId={draggingNodeId} onDragStartNode={onDragStartNode} onDragEndNode={onDragEndNode} />
    ))
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      if (previewMode) fireConfiguredEvent('onSubmit', {})
    }
    return (
      <form id={domId} data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onSubmit={handleSubmit}
        onDrop={previewMode ? undefined : handleDrop} onDragOver={previewMode ? undefined : handleDragOver}
        onClick={previewMode ? undefined : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`${previewMode ? 'rounded box-border' : `border-2 ${isSelected ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-gray-200 dark:border-[#30363d] border-dashed'} rounded box-border`}`}
        style={style}>
        {isSelected && !previewMode && <span className="absolute top-0 left-0 z-50 bg-[var(--primary)] text-white text-[10px] font-semibold px-1.5 py-0.5 pointer-events-none leading-none">form</span>}
        {(node.children ?? []).length === 0 && !previewMode ? (
          <div className="text-xs text-gray-400 py-4 px-2 text-center">Drop form fields here</div>
        ) : childEls}
        {previewMode && (
          <div className="px-2 pt-2">
            <button type="submit" className="px-4 py-1.5 text-sm bg-[var(--primary,#2563eb)] text-white rounded font-medium">{submitLabel}</button>
          </div>
        )}
      </form>
    )
  }

  // ─── alertBanner ──────────────────────────────────────────────────────────
  if (node.type === 'alertBanner') {
    const v = String(node.props.variant ?? 'info')
    const dismissible = node.props.dismissible !== false
    const title = resolveWithProps(String(node.props.title ?? ''), resolveBindingFn, reusablePropsCtx)
    const message = resolveWithProps(String(node.props.message ?? ''), resolveBindingFn, reusablePropsCtx)
    const variants: Record<string, { bg: string; border: string; icon: string; iconColor: string }> = {
      info:    { bg: 'bg-blue-50 dark:bg-blue-950/30',   border: 'border-blue-200 dark:border-blue-800',   icon: 'ℹ️', iconColor: 'text-blue-500' },
      success: { bg: 'bg-green-50 dark:bg-green-950/30',  border: 'border-green-200 dark:border-green-800',  icon: '✓', iconColor: 'text-green-600 dark:text-green-400' },
      warning: { bg: 'bg-amber-50 dark:bg-amber-950/30',  border: 'border-amber-200 dark:border-amber-800',  icon: '⚠', iconColor: 'text-amber-600 dark:text-amber-400' },
      error:   { bg: 'bg-red-50 dark:bg-red-950/30',     border: 'border-red-200 dark:border-red-800',     icon: '✕', iconColor: 'text-red-600 dark:text-red-400' },
    }
    const vt = variants[v] ?? variants.info
    return (
      <div id={domId} data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`flex items-start gap-2.5 border rounded-lg px-3.5 py-2.5 ${vt.bg} ${vt.border} ${previewMode ? '' : `ring-2 ${isSelected ? 'ring-[var(--primary)]' : 'ring-transparent'}`}`}
        style={style}>
        <span className={`text-base leading-none mt-0.5 ${vt.iconColor}`}>{vt.icon}</span>
        <div className="flex-1 min-w-0">
          {title && <div className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">{title}</div>}
          <div className="text-sm text-gray-700 dark:text-gray-300">{message}</div>
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={previewMode ? (e) => { e.stopPropagation(); fireConfiguredEvent('onDismiss', { value: true }) } : undefined}
            className="shrink-0 mt-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm leading-none"
          >
            ✕
          </button>
        )}
      </div>
    )
  }

  // ─── badge ────────────────────────────────────────────────────────────────
  if (node.type === 'badge') {
    const v = String(node.props.variant ?? 'default')
    const sz = String(node.props.size ?? 'sm')
    const colors: Record<string, string> = {
      default: 'bg-gray-100 dark:bg-[#21262d] text-gray-700 dark:text-gray-300',
      success: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
      warning: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
      error: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
      info: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
      outline: 'border border-gray-300 dark:border-[#30363d] text-gray-700 dark:text-gray-300',
    }
    const sizes: Record<string, string> = { xs: 'text-[10px] px-1.5 py-0.5', sm: 'text-xs px-2 py-0.5', md: 'text-sm px-2.5 py-1' }
    return (
      <span id={domId} data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`inline-flex items-center font-medium rounded-full ${colors[v] ?? colors.default} ${sizes[sz] ?? sizes.sm} ${previewMode ? '' : `ring-2 ${isSelected ? 'ring-[var(--primary)]' : 'ring-transparent'}`}`}
        style={style}>
        {resolveWithProps(node.props.label ?? 'Badge', resolveBindingFn, reusablePropsCtx)}
      </span>
    )
  }

  // ─── avatar ───────────────────────────────────────────────────────────────
  if (node.type === 'avatar') {
    const src = resolveWithProps(String(node.props.src ?? ''), resolveBindingFn, reusablePropsCtx)
    const initials = resolveWithProps(String(node.props.initials ?? 'AB'), resolveBindingFn, reusablePropsCtx).slice(0, 2).toUpperCase()
    const size = Number(node.props.size ?? 40)
    const isCircle = String(node.props.shape ?? 'circle') === 'circle'
    const showStatus = !!node.props.showStatus
    const status = String(node.props.status ?? 'online')
    const statusColors: Record<string, string> = { online: 'bg-green-500', offline: 'bg-gray-400', away: 'bg-yellow-400', busy: 'bg-red-500' }
    return (
      <div id={domId} data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`relative inline-flex ${previewMode ? '' : `ring-2 ${isSelected ? 'ring-[var(--primary)]' : 'ring-transparent'}`}`}
        style={{ ...style, width: size, height: size, flexShrink: 0 }}>
        {src ? (
          <img src={src} alt={resolveWithProps(String(node.props.alt ?? ''), resolveBindingFn, reusablePropsCtx)}
            className={`w-full h-full object-cover ${isCircle ? 'rounded-full' : 'rounded'} ${previewMode ? '' : 'pointer-events-none'}`} />
        ) : (
          <div className={`w-full h-full flex items-center justify-center text-white font-semibold ${isCircle ? 'rounded-full' : 'rounded'}`}
            style={{ background: 'var(--primary, #2563eb)', fontSize: size * 0.35 }}>
            {initials}
          </div>
        )}
        {showStatus && (
          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${statusColors[status] ?? 'bg-gray-400'}`} style={{ width: size * 0.25, height: size * 0.25 }} />
        )}
      </div>
    )
  }

  // ─── progressBar ─────────────────────────────────────────────────────────
  if (node.type === 'progressBar') {
    const value = Number(resolveWithProps(String(node.props.value ?? 60), resolveBindingFn, reusablePropsCtx))
    const max = Number(resolveWithProps(String(node.props.max ?? 100), resolveBindingFn, reusablePropsCtx))
    const pct = Math.min(100, Math.max(0, (value / (max || 1)) * 100))
    const color = String(node.props.color ?? '#2563eb')
    const height = Number(node.props.height ?? 8)
    const showPercent = node.props.showPercent !== false
    const animated = !!node.props.animated
    return (
      <div id={domId} data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`px-2 py-1 w-full ${previewMode ? '' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'}`}`} style={style}>
        {(node.props.label || showPercent) && (
          <div className="flex justify-between items-center mb-1">
            {node.props.label ? <span className="text-xs text-gray-500 dark:text-gray-400">{resolveWithProps(node.props.label, resolveBindingFn, reusablePropsCtx)}</span> : <span />}
            {showPercent && <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{Math.round(pct)}%</span>}
          </div>
        )}
        <div className="w-full bg-gray-200 dark:bg-[#30363d] overflow-hidden" style={{ height, borderRadius: 'var(--border-radius-full, 9999px)' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 'var(--border-radius-full, 9999px)', transition: 'width 0.4s ease' }}
            className={animated ? 'animate-pulse' : ''} />
        </div>
      </div>
    )
  }

  // ─── spinner ──────────────────────────────────────────────────────────────
  if (node.type === 'spinner') {
    const size = Number(node.props.size ?? 32)
    const color = String(node.props.color ?? '#2563eb')
    return (
      <div id={domId} data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? undefined : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`inline-flex flex-col items-center gap-1 ${previewMode ? '' : `ring-2 ${isSelected ? 'ring-[var(--primary)]' : 'ring-transparent'} rounded`}`} style={style}>
        <svg className="animate-spin" style={{ width: size, height: size, color }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {node.props.label ? <span className="text-xs text-gray-500">{resolveWithProps(node.props.label, resolveBindingFn, reusablePropsCtx)}</span> : null}
      </div>
    )
  }

  // ─── card ─────────────────────────────────────────────────────────────────
  if (node.type === 'card') {
    const shadow = String(node.props.shadow ?? 'md')
    const rounded = String(node.props.rounded ?? 'md')
    const bordered = node.props.bordered !== false
    const shadowMap: Record<string, string> = { none: '', sm: 'shadow-sm', md: 'shadow', lg: 'shadow-lg', xl: 'shadow-xl' }
    const roundedMap: Record<string, string> = { none: '0', sm: 'var(--border-radius-sm, 0px)', md: 'var(--border-radius, 0px)', lg: 'var(--border-radius-lg, 0px)', full: 'var(--border-radius-full, 9999px)' }
    const childEls = (node.children ?? []).map((child) => (
      <NodeRenderer key={`${child.id}:${child.type}`} node={child} selectedId={selectedId} onSelect={onSelect}
        onUpdate={(up) => { const kids = node.children ?? []; const next = kids.map(c => c.id === up.id ? up : c); onUpdate({ ...node, children: next }) }}
        onAddChild={onAddChild} onMove={onMove} onRunEvent={onRunEvent} isRoot={false} previewMode={previewMode}
        resolveBinding={resolveBindingFn} reusablesById={reusablesById} reusablePropsCtx={reusablePropsCtx}
        draggingNodeId={draggingNodeId} onDragStartNode={onDragStartNode} onDragEndNode={onDragEndNode} />
    ))
    return (
      <div id={domId} data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        onDrop={previewMode ? undefined : handleDrop} onDragOver={previewMode ? undefined : handleDragOver}
        className={`bg-white dark:bg-[#161b22] ${shadowMap[shadow] ?? 'shadow'} ${bordered ? 'border border-gray-200 dark:border-[#30363d]' : ''} relative ${previewMode ? '' : `ring-2 ${isSelected ? 'ring-[var(--primary)]' : 'ring-transparent'}`}`}
        style={{ ...style, borderRadius: roundedMap[rounded] ?? 'var(--border-radius, 0px)' }}>
        {isSelected && !previewMode && <span className="absolute top-0 left-0 z-50 bg-[var(--primary)] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-tl rounded-br pointer-events-none">card</span>}
        {(node.children ?? []).length === 0 && !previewMode ? (
          <div className="text-xs text-gray-400 py-4 px-2 text-center min-h-[48px] flex items-center justify-center">Drop components here</div>
        ) : childEls}
      </div>
    )
  }

  // ─── modal ────────────────────────────────────────────────────────────────
  if (node.type === 'modal') {
    // Modal visibility: Users can put {{state.showModal}} in either `visibleWhen` (the "Show when"
    // field at the top of the property panel) or in the `open` content prop. Both should work.
    // If only one is set, use it. If both are set, both must be true (AND).
    const openRaw = String(node.props.open ?? '').trim()
    const hasOpenProp = openRaw !== '' && openRaw !== 'false' && openRaw !== '0'
    const openFromProp = hasOpenProp ? (() => { const r = resolveWithProps(openRaw, resolveBindingFn, reusablePropsCtx); return r === 'true' || r === '1' || r === 'yes' })() : null
    const isOpen = previewMode
      ? (openFromProp !== null && _visibleWhenRaw
          ? (openFromProp && _visibleWhenVisible)  // both set → AND
          : openFromProp !== null
            ? openFromProp                          // only open prop
            : _visibleWhenVisible)                  // only visibleWhen (or neither → true)
      : true // always show in edit mode unless hideInEditor is set
    if (!previewMode && node.props.hideInEditor) {
      return (
        <div id={domId} data-node-id={node.id}
          onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}
          draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
          className={`flex items-center gap-2 px-3 py-1.5 my-1 border ${isSelected ? 'border-[var(--primary)]' : 'border-dashed border-gray-300 dark:border-[#30363d]'} bg-gray-50 dark:bg-[#161b22] text-gray-400 dark:text-gray-500 text-xs cursor-pointer`}>
          <span>🗂</span>
          <span className="font-medium">{resolveWithProps(String(node.props.title ?? 'Modal'), resolveBindingFn, reusablePropsCtx)}</span>
          <span className="opacity-50">(hidden in editor)</span>
        </div>
      )
    }
    const title = resolveWithProps(String(node.props.title ?? 'Dialog'), resolveBindingFn, reusablePropsCtx)
    const showClose = node.props.showCloseButton !== false
    const sizeMap: Record<string, string> = { sm: '400px', md: '560px', lg: '720px', xl: '900px', full: '100%' }
    const sz = sizeMap[String(node.props.size ?? 'md')] ?? '560px'
    const childEls = (node.children ?? []).map((child) => (
      <NodeRenderer key={`${child.id}:${child.type}`} node={child} selectedId={selectedId} onSelect={onSelect}
        onUpdate={(up) => { const kids = node.children ?? []; const next = kids.map(c => c.id === up.id ? up : c); onUpdate({ ...node, children: next }) }}
        onAddChild={onAddChild} onMove={onMove} onRunEvent={onRunEvent} isRoot={false} previewMode={previewMode}
        resolveBinding={resolveBindingFn} reusablesById={reusablesById} reusablePropsCtx={reusablePropsCtx}
        draggingNodeId={draggingNodeId} onDragStartNode={onDragStartNode} onDragEndNode={onDragEndNode} />
    ))
    if (previewMode && !isOpen) return null
    return (
      <div id={domId} data-node-id={node.id}
        className={previewMode ? 'absolute inset-0 z-[100] flex items-center justify-center' : `relative w-full flex justify-center border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-dashed border-gray-200 dark:border-[#30363d]'} rounded my-2`}
        onClick={previewMode ? undefined : (e) => { e.stopPropagation(); onSelect(node.id) }}
        draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onDrop={previewMode ? undefined : handleDrop} onDragOver={previewMode ? undefined : handleDragOver}>
        {previewMode && node.props.showOverlay !== false && <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => fireConfiguredEvent('onClose', {})} />}
        <div className="relative bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] shadow-2xl overflow-hidden z-10 mx-auto"
          style={{ width: sz, maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', borderRadius: 'var(--border-radius-lg, 0px)', ...(previewMode ? {} : style) }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#30363d] shrink-0">
            <span className="font-semibold text-sm text-black dark:text-white">{title}</span>
            {showClose && <button type="button" onClick={() => fireConfiguredEvent('onClose', {})} className="text-gray-400 hover:text-black dark:hover:text-white text-lg leading-none">&times;</button>}
          </div>
          <div className="flex-1 overflow-auto" style={{ padding: 16 }}>
            {(node.children ?? []).length === 0 && !previewMode ? (
              <div className="text-xs text-gray-400 text-center py-4">Drop modal content here</div>
            ) : childEls}
          </div>
        </div>
      </div>
    )
  }

  // ─── tabs ─────────────────────────────────────────────────────────────────
  if (node.type === 'tabs') {
    const tabsStr = resolveWithProps(String(node.props.tabs ?? 'Tab 1,Tab 2,Tab 3'), resolveBindingFn, reusablePropsCtx)
    const tabList = tabsStr.split(',').map(s => s.trim()).filter(Boolean)
    const variant = String(node.props.variant ?? 'line')
    const variantBase = variant === 'pills' ? 'rounded-full px-3 py-1 text-xs' : variant === 'boxed' ? 'border-b-0 px-3 py-1.5 text-sm -mb-px' : 'border-b-2 px-3 py-1.5 text-sm'
    const activeClass = variant === 'pills' ? 'bg-black dark:bg-white text-white dark:text-black' : variant === 'boxed' ? 'bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-[#30363d]' : 'border-black dark:border-white text-black dark:text-white'
    const inactiveClass = variant === 'pills' ? 'text-gray-500 hover:text-black dark:hover:text-white' : 'border-transparent text-gray-500 hover:text-black dark:hover:text-white'
    const idx = previewMode ? localActive : tabsActiveIdx
    const childEls = (node.children ?? []).slice(idx, idx + 1).map((child) => (
      <NodeRenderer key={`${child.id}:${child.type}`} node={child} selectedId={selectedId} onSelect={onSelect}
        onUpdate={(up) => { const kids = node.children ?? []; const next = kids.map(c => c.id === up.id ? up : c); onUpdate({ ...node, children: next }) }}
        onAddChild={onAddChild} onMove={onMove} onRunEvent={onRunEvent} isRoot={false} previewMode={previewMode}
        resolveBinding={resolveBindingFn} reusablesById={reusablesById} reusablePropsCtx={reusablePropsCtx}
        draggingNodeId={draggingNodeId} onDragStartNode={onDragStartNode} onDragEndNode={onDragEndNode} />
    ))
    return (
      <div id={domId} data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        onDrop={previewMode ? undefined : handleDrop} onDragOver={previewMode ? undefined : handleDragOver}
        className={`${previewMode ? '' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-dashed border-gray-200 dark:border-[#30363d]'}`}`} style={style}>
        <div className={`flex gap-1 ${variant === 'line' ? 'border-b border-gray-200 dark:border-[#30363d]' : 'mb-2'}`}>
          {tabList.map((tab, i) => (
            <button key={i} type="button"
              onClick={(e) => { e.stopPropagation(); setLocalActive(i); fireConfiguredEvent('onChange', { value: i }) }}
              className={`font-medium transition-colors ${variantBase} ${i === idx ? activeClass : inactiveClass}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="pt-2">
          {(node.children ?? []).length === 0 && !previewMode
            ? <div className="text-xs text-gray-400 py-3 text-center">Drop tab panels here (one per tab)</div>
            : childEls}
        </div>
      </div>
    )
  }

  // ─── accordion ────────────────────────────────────────────────────────────
  if (node.type === 'accordion') {
    const itemsStr = resolveWithProps(String(node.props.items ?? 'Section 1|Content 1,Section 2|Content 2'), resolveBindingFn, reusablePropsCtx)
    const items = itemsStr.split(',').map(s => { const [h, ...b] = s.split('|'); return { header: h?.trim() ?? '', body: b.join('|').trim() } })
    const multiple = !!node.props.multiple
    const toggle = (i: number) => {
      if (!previewMode) return
      setOpenIdxs(prev => multiple ? (prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]) : (prev.includes(i) ? [] : [i]))
      fireConfiguredEvent('onChange', { value: i })
    }
    return (
      <div id={domId} data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? undefined : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`w-full border border-gray-200 dark:border-[#30363d] divide-y divide-gray-200 dark:divide-[#30363d] overflow-hidden ${previewMode ? '' : `ring-2 ${isSelected ? 'ring-[var(--primary)]' : 'ring-transparent'}`}`} style={style}>
        {items.map((item, i) => (
          <div key={i}>
            <button type="button" onClick={() => toggle(i)}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left ${previewMode ? 'hover:bg-gray-50 dark:hover:bg-[#161b22] cursor-pointer' : 'cursor-default'} text-black dark:text-white`}>
              <span>{item.header}</span>
              <svg className={`w-4 h-4 transition-transform ${openIdxs.includes(i) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {openIdxs.includes(i) && <div className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.body}</div>}
          </div>
        ))}
      </div>
    )
  }

  // ─── richText ─────────────────────────────────────────────────────────────
  if (node.type === 'richText') {
    const raw = resolveWithProps(String(node.props.content ?? ''), resolveBindingFn, reusablePropsCtx)
    // Minimal markdown: headings, bold, italic, code, lists
    const html = raw
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^#{3}\s(.+)$/gm, '<h3 style="font-size:1.1em;font-weight:600;margin:8px 0 4px">$1</h3>')
      .replace(/^#{2}\s(.+)$/gm, '<h2 style="font-size:1.3em;font-weight:700;margin:12px 0 4px">$1</h2>')
      .replace(/^#{1}\s(.+)$/gm, '<h1 style="font-size:1.6em;font-weight:800;margin:14px 0 6px">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.07);padding:1px 4px;border-radius:3px;font-family:monospace;font-size:0.9em">$1</code>')
      .replace(/^- (.+)$/gm, '<li style="margin-left:20px;list-style:disc">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li style="margin-left:20px;list-style:decimal">$2</li>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>')
    return (
      <div id={domId} data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`px-2 py-1 text-sm text-black dark:text-white leading-relaxed ${previewMode ? '' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'}`}`}
        style={style} dangerouslySetInnerHTML={{ __html: html }} />
    )
  }

  // ─── video ────────────────────────────────────────────────────────────────
  if (node.type === 'video') {
    const src = resolveWithProps(String(node.props.src ?? ''), resolveBindingFn, reusablePropsCtx)
    const poster = resolveWithProps(String(node.props.poster ?? ''), resolveBindingFn, reusablePropsCtx)
    return (
      <div id={domId} data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`inline-block overflow-hidden ${previewMode ? '' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'}`}`}
        style={{ ...style, minWidth: 200, minHeight: 120 }}>
        {src ? (
          <video src={src} poster={poster || undefined} controls={!!node.props.controls} autoPlay={!!node.props.autoplay && previewMode}
            loop={!!node.props.loop} muted={!!node.props.muted} className="block w-full h-full" style={{ objectFit: 'contain' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-400 text-xs" style={{ minWidth: 200, minHeight: 120 }}>
            <div className="text-center"><div className="text-4xl mb-2">▶</div><div>No video src</div></div>
          </div>
        )}
      </div>
    )
  }

  // ─── embed ────────────────────────────────────────────────────────────────
  if (node.type === 'embed') {
    const src = resolveWithProps(String(node.props.src ?? ''), resolveBindingFn, reusablePropsCtx)
    const title = resolveWithProps(String(node.props.title ?? 'Embed'), resolveBindingFn, reusablePropsCtx)
    return (
      <div id={domId} data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? undefined : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`inline-block overflow-hidden relative ${previewMode ? '' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'}`}`}
        style={{ ...style, minWidth: 200, minHeight: 120 }}>
        {!previewMode && <div className="absolute inset-0 z-10 cursor-default" />}
        {src ? (
          <iframe src={src} title={title} allow={String(node.props.allow ?? '')} className="block w-full h-full border-0" style={{ minWidth: 200, minHeight: 120 }} sandbox="allow-scripts allow-same-origin allow-popups" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-[#21262d] text-gray-400 text-xs" style={{ minWidth: 200, minHeight: 120 }}>
            <div className="text-center"><div className="text-3xl mb-1">⊡</div><div>No URL set</div></div>
          </div>
        )}
      </div>
    )
  }

  // ─── tooltip ──────────────────────────────────────────────────────────────
  if (node.type === 'tooltip') {
    const content = resolveWithProps(String(node.props.content ?? 'Tooltip'), resolveBindingFn, reusablePropsCtx)
    const position = String(node.props.position ?? 'top')
    const posClass = { top: 'bottom-full left-1/2 -translate-x-1/2 mb-1', bottom: 'top-full left-1/2 -translate-x-1/2 mt-1', left: 'right-full top-1/2 -translate-y-1/2 mr-1', right: 'left-full top-1/2 -translate-y-1/2 ml-1' }[position] ?? 'bottom-full left-1/2 -translate-x-1/2 mb-1'
    const childEls = (node.children ?? []).map((child) => (
      <NodeRenderer key={`${child.id}:${child.type}`} node={child} selectedId={selectedId} onSelect={onSelect}
        onUpdate={(up) => { const kids = node.children ?? []; const next = kids.map(c => c.id === up.id ? up : c); onUpdate({ ...node, children: next }) }}
        onAddChild={onAddChild} onMove={onMove} onRunEvent={onRunEvent} isRoot={false} previewMode={previewMode}
        resolveBinding={resolveBindingFn} reusablesById={reusablesById} reusablePropsCtx={reusablePropsCtx}
        draggingNodeId={draggingNodeId} onDragStartNode={onDragStartNode} onDragEndNode={onDragEndNode} />
    ))
    return (
      <div id={domId} data-node-id={node.id} className={`relative inline-block ${previewMode ? '' : `ring-2 ${isSelected ? 'ring-[var(--primary)]' : 'ring-transparent'} rounded`}`}
        draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? undefined : (e) => { e.stopPropagation(); onSelect(node.id) }}
        onDrop={previewMode ? undefined : handleDrop} onDragOver={previewMode ? undefined : handleDragOver}
        onMouseEnter={() => { setTtVisible(true); fireConfiguredEvent('onMouseEnter', {}) }}
        onMouseLeave={() => { setTtVisible(false); fireConfiguredEvent('onMouseLeave', {}) }}
        style={style}>
        {ttVisible && (
          <div className={`absolute z-50 ${posClass} bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none`}>
            {content}
          </div>
        )}
        {(node.children ?? []).length === 0 && !previewMode
          ? <div className="text-xs text-gray-400 px-2 py-1 border border-dashed border-gray-200 dark:border-[#30363d] rounded">Tooltip wrapper — drop child here</div>
          : childEls}
      </div>
    )
  }

  // ─── dataRepeater ─────────────────────────────────────────────────────────
  if (node.type === 'dataRepeater') {
    const dataSourceKey = String(node.props.dataSource ?? '')
    const itemVar = String(node.props.itemVar ?? 'item')
    const emptyText = String(node.props.emptyText ?? 'No items')
    // Resolve the data source — expects an array via {{data.sourceName}} binding
    const resolvedSource = dataSourceKey ? resolveWithProps(dataSourceKey, resolveBindingFn, reusablePropsCtx) : ''
    let items: unknown[] = []
    try {
      if (resolvedSource && resolvedSource !== dataSourceKey) {
        const parsed = JSON.parse(resolvedSource)
        items = normalizeRepeaterItems(parsed)
      }
    } catch { /* non-JSON means binding not yet resolved */ }
    if (!previewMode) {
      // In edit mode show the children template once with placeholder data
      const placeholderCtx = { [itemVar]: { id: 1, name: 'Sample item', value: 'value' } }
      const childEls = (node.children ?? []).map((child) => (
        <NodeRenderer key={`${child.id}:${child.type}`} node={child} selectedId={selectedId} onSelect={onSelect}
          onUpdate={(up) => { const kids = node.children ?? []; const next = kids.map(c => c.id === up.id ? up : c); onUpdate({ ...node, children: next }) }}
          onAddChild={onAddChild} onMove={onMove} onRunEvent={onRunEvent} isRoot={false} previewMode={previewMode}
          resolveBinding={resolveBindingFn} reusablesById={reusablesById} reusablePropsCtx={{ ...reusablePropsCtx, ...placeholderCtx }}
          draggingNodeId={draggingNodeId} onDragStartNode={onDragStartNode} onDragEndNode={onDragEndNode} />
      ))
      return (
        <div id={domId} data-node-id={node.id}
          draggable={canDragNode ? 'true' : 'false'} onDragStart={canDragNode ? handleDragStart : undefined} onDragEnd={canDragNode ? handleDragEnd : undefined}
          onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}
          onDrop={handleDrop} onDragOver={handleDragOver}
          className={`border-2 ${isSelected ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-dashed border-amber-300 dark:border-amber-700'} rounded relative`} style={style}>
          <span className="absolute top-0 left-0 bg-amber-400 text-white text-[10px] font-semibold px-1.5 py-0.5 z-50 pointer-events-none">repeater: {dataSourceKey || 'no data source'}</span>
          {(node.children ?? []).length === 0
            ? <div className="text-xs text-gray-400 py-6 text-center">Drop the item template here<br/><span className="opacity-60">Use {`{{prop.${itemVar}.field}}`} to bind fields</span></div>
            : childEls}
        </div>
      )
    }
    // Preview mode: render children once per item
    if (items.length === 0) {
      return <div id={domId} style={style} className="text-sm text-gray-400 text-center py-4">{emptyText}</div>
    }
    return (
      <div id={domId} data-node-id={node.id} style={style}>
        {items.map((item, idx) => {
          const itemCtx = { ...reusablePropsCtx, [itemVar]: item, [`${itemVar}Index`]: idx }
          return (
            <Fragment key={idx}>
              {(node.children ?? []).map((child) => (
                <NodeRenderer key={`${idx}-${child.id}:${child.type}`} node={child} selectedId={null} onSelect={() => {}} onUpdate={() => {}}
                  onAddChild={onAddChild} onMove={onMove} onRunEvent={onRunEvent} isRoot={false} previewMode={previewMode}
                  resolveBinding={resolveBindingFn} reusablesById={reusablesById} reusablePropsCtx={itemCtx}
                  draggingNodeId={null} onDragStartNode={undefined} onDragEndNode={undefined} />
              ))}
            </Fragment>
          )
        })}
      </div>
    )
  }

  if (BUILDER_CHART_TYPES.has(node.type)) {
    const resolvedProps: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node.props)) {
      if (typeof v === 'string' && (k === 'data' || k === 'dataA' || k === 'dataB' || k === 'dataC')) {
        resolvedProps[k] = resolveWithProps(v, resolveBindingFn, reusablePropsCtx)
      } else {
        resolvedProps[k] = v
      }
    }
    return (
      <div
        id={domId}
        data-node-id={node.id}
        draggable={canDragNode ? 'true' : 'false'}
        onDragStart={canDragNode ? handleDragStart : undefined}
        onDragEnd={canDragNode ? handleDragEnd : undefined}
        onClick={previewMode ? (e) => runConfiguredEvent('onClick', e) : (e) => { e.stopPropagation(); onSelect(node.id) }}
        className={`${previewMode ? 'rounded overflow-hidden' : `border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-dashed border-gray-200 dark:border-[#30363d]'} rounded overflow-hidden`} flex flex-1 min-h-0 min-w-0 w-full`}
        style={{ ...style, display: 'flex', flex: 1, minHeight: 0, minWidth: 0 }}
      >
        <div className="flex-1 min-h-0 min-w-0 w-full" style={{ width: '100%', height: '100%', minHeight: 0 }}>
          <BuilderChart type={node.type} resolvedProps={resolvedProps} width="100%" height="100%" />
        </div>
      </div>
    )
  }

  return (
    <div
      id={domId}
      data-node-id={node.id}
      draggable={canDragNode ? 'true' : 'false'}
      onDragStart={canDragNode ? handleDragStart : undefined}
      onDragEnd={canDragNode ? handleDragEnd : undefined}
      onClick={previewMode ? undefined : (e) => { e.stopPropagation(); onSelect(node.id) }}
      className={previewMode ? 'px-2 py-1 rounded text-sm text-gray-500' : `px-2 py-1 border-2 ${isSelected ? 'border-[var(--primary)]' : 'border-transparent'} rounded text-sm text-gray-500`}
      style={style}
    >
      {node.type}
    </div>
  )
}

export function BuilderCanvas({ root, selectedId, onSelect, onUpdate, previewMode, suppressRootChrome = false, resolveBinding: resolveBindingFn, theme, onMove, onRunEvent, reusables = [], reusablePropsCtx, runtimePendingSources = [], runtimeResolvedSources = [] }: Props) {
  const reusablesById = new Map(reusables.map((r) => [r.id, r]))
  const loadingSignalValue = useMemo(() => ({
    pending: new Set(runtimePendingSources.map(normalizeSourceKey)),
    resolved: new Set(runtimeResolvedSources.map(normalizeSourceKey)),
  }), [runtimePendingSources, runtimeResolvedSources])
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [showMissingReusableWarning, setShowMissingReusableWarning] = useState(reusables.length > 0)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Avoid flashing transient "Missing reusable" while globals hydrate on startup.
    if (reusables.length > 0) {
      setShowMissingReusableWarning(true)
      return
    }
    setShowMissingReusableWarning(false)
    const timer = window.setTimeout(() => setShowMissingReusableWarning(true), 300)
    return () => window.clearTimeout(timer)
  }, [reusables.length, root.id])

  // Ensure any custom font families referenced by nodes are loaded in runtime/edit previews.
  useEffect(() => {
    const families = new Set<string>()
    const walk = (node: Node) => {
      for (const family of extractWebFontFamilies((node.props as Record<string, unknown>)?.fontFamily)) {
        families.add(family)
      }
      for (const child of node.children ?? []) walk(child)
    }
    walk(root)
    families.forEach((family) => ensureBunnyFontLoaded(family))
  }, [root])

  // Restore scroll position from sessionStorage when root.id changes
  useEffect(() => {
    if (previewMode || !scrollRef.current) return
    const key = `dccortex:canvas-scroll:${root.id}`
    try {
      const saved = sessionStorage.getItem(key)
      if (saved) scrollRef.current.scrollTop = Number(saved) || 0
    } catch {}
    const el = scrollRef.current
    const onScroll = () => {
      try { sessionStorage.setItem(key, String(el.scrollTop)) } catch {}
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [root.id, previewMode])

  // Set up animation sequence event listeners for elements with animations
  useEffect(() => {
    if (!previewMode) return

    const nodeById = new Map<string, Node>()
    const walk = (n: Node) => {
      nodeById.set(n.id, n)
      for (const c of n.children ?? []) walk(c)
    }
    walk(root)

    const handleAnimationSetup = () => {
      // Find all elements with animation-sequence class or style
      document.querySelectorAll('[style*="animation"]').forEach((el) => {
        const animValue = (el as HTMLElement).style.animation
        if (!animValue || !animValue.trim()) return

        const nodeId = (el as HTMLElement).getAttribute('data-node-id')
        if (!nodeId) return
        const node = nodeById.get(nodeId)
        if (!node) return

        const seq = (node.props?.animationSequence ?? {}) as { tickMode?: 'per-step' | 'per-sequence'; tickEvery?: number }
        const tickMode = seq.tickMode ?? 'per-step'
        const tickEvery = Math.max(1, Number(seq.tickEvery ?? 1) || 1)

        const runNodeEvent = (eventKey: 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationTick') => {
          if (!onRunEvent) return
          const raw = node.props?.[eventKey]
          const steps = parseEventSteps(raw)
          if (!steps.length) return
          for (const step of steps) {
            onRunEvent(step, { type: eventKey, targetId: nodeId })
          }
        }

        // Remove old listeners to avoid duplicates
        const oldHandleStart = (el as any)._animationStartListener
        const oldHandleEnd = (el as any)._animationEndListener
        const oldHandleIteration = (el as any)._animationIterationListener
        if (oldHandleStart) el.removeEventListener('animationstart', oldHandleStart)
        if (oldHandleEnd) el.removeEventListener('animationend', oldHandleEnd)
        if (oldHandleIteration) el.removeEventListener('animationiteration', oldHandleIteration)

        let stepTickCounter = 0
        let sequenceTickCounter = 0

        // Add new listeners that fire events
        const handleStart = () => {
          runNodeEvent('onAnimationStart')
        }
        const handleEnd = () => {
          if (tickMode === 'per-sequence') {
            sequenceTickCounter += 1
            if (sequenceTickCounter % tickEvery === 0) {
              runNodeEvent('onAnimationTick')
            }
          }
          runNodeEvent('onAnimationEnd')
        }
        const handleIteration = () => {
          if (tickMode === 'per-step') {
            stepTickCounter += 1
            if (stepTickCounter % tickEvery === 0) {
              runNodeEvent('onAnimationTick')
            }
          }
        }

        el.addEventListener('animationstart', handleStart)
        el.addEventListener('animationend', handleEnd)
        el.addEventListener('animationiteration', handleIteration)

        ;(el as any)._animationStartListener = handleStart
        ;(el as any)._animationEndListener = handleEnd
        ;(el as any)._animationIterationListener = handleIteration
      })
    }

    // Initial setup
    handleAnimationSetup()

    // Listen for DOM changes and re-setup periodically
    let timeoutId: NodeJS.Timeout
    const check = () => {
      handleAnimationSetup()
      timeoutId = setTimeout(check, 2000) // Re-check every 2s for any new animations
    }
    timeoutId = setTimeout(check, 2000)

    return () => clearTimeout(timeoutId)
  }, [previewMode, onRunEvent, root])

  const addToRoot = useCallback(
    (type: string, reusableId?: string) => {
      const child = createNode(type)
      if (type === 'reusableInstance') {
        child.props.reusableId = reusableId ?? ''
        child.props.reusableProps = {}
      }
      const newRoot: Node = {
        ...root,
        children: [...(root.children ?? []), child],
      }
      onUpdate(newRoot)
    },
    [root, onUpdate]
  )

  const addChild = useCallback(
    (parent: Node, type: string, reusableId?: string) => {
      const child = createNode(type)
      if (type === 'reusableInstance') {
        child.props.reusableId = reusableId ?? ''
        child.props.reusableProps = {}
      }
      // If the parent is a row-flex semantic/layout element and the child is a
      // layout container, auto-set flex:1 so it fills the available width
      const rowFlexParentTypes = ['header', 'footer', 'nav', 'stackH']
      const expandableChildTypes = ['container', 'section', 'stackV', 'stackH', 'main', 'aside', 'article']
      const parentFd = String((parent.props as Record<string, unknown>)?.flexDirection ?? '')
      const isRowParent = rowFlexParentTypes.includes(parent.type) || parentFd === 'row'
      if (isRowParent && expandableChildTypes.includes(type) && !child.props.flex && !child.props.width) {
        child.props.flex = '1'
      }
      if (parent.id === root.id) {
        onUpdate({ ...root, children: [...(root.children ?? []), child] })
        return
      }
      const addTo = (node: Node): Node => {
        if (node.id === parent.id) {
          return { ...node, children: [...(node.children ?? []), child] }
        }
        return { ...node, children: (node.children ?? []).map(addTo) }
      }
      onUpdate(addTo(root))
    },
    [root, onUpdate]
  )

  const rootStyle = theme?.background
    ? { background: 'var(--background)', color: 'var(--text)' }
    : undefined

  return (
    <>
      {/* Animation keyframe definitions – available to all canvas elements via the animation shorthand prop */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes slideInUp { from { opacity: 0; transform: translateY(30px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes slideInDown { from { opacity: 0; transform: translateY(-30px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(30px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.85) } to { opacity: 1; transform: scale(1) } }
        @keyframes zoomOut { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(0.85) } }
        @keyframes bounceIn { 0% { opacity:0; transform:scale(0.3) } 50% { opacity:1; transform:scale(1.05) } 70% { transform:scale(0.9) } 100% { transform:scale(1) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
        @keyframes shake { 0%, 100% { transform: translateX(0) } 10%, 30%, 50%, 70%, 90% { transform: translateX(-6px) } 20%, 40%, 60%, 80% { transform: translateX(6px) } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0 } }
        @keyframes float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
        @keyframes dccGradientShiftX { 0% { background-position: 0% 50% } 50% { background-position: 100% 50% } 100% { background-position: 0% 50% } }
        @keyframes dccGradientShiftY { 0% { background-position: 50% 0% } 50% { background-position: 50% 100% } 100% { background-position: 50% 0% } }
        @keyframes dccGradientRotate {
          0% { background-position: 50% 0% }
          25% { background-position: 100% 50% }
          50% { background-position: 50% 100% }
          75% { background-position: 0% 50% }
          100% { background-position: 50% 0% }
        }
        @keyframes dccGradientHueShift { 0% { filter: hue-rotate(0deg) } 100% { filter: hue-rotate(360deg) } }
      `}</style>
    <div
      data-builder-canvas="true"
      className={previewMode ? 'flex-1 flex flex-col h-full overflow-y-auto relative' : 'flex flex-col h-full min-h-0 overflow-auto'}
      style={{ ...rootStyle, ...(!previewMode ? { height: '100%', contain: 'layout' } : {}) }}
      onClick={previewMode ? undefined : () => onSelect(null)}
      onDrop={previewMode ? undefined : (e) => {
        e.preventDefault()
        e.stopPropagation()
        try {
          const raw = e.dataTransfer.getData('application/json')
          if (!raw) return
          const data = JSON.parse(raw)
          const nodeId = data?.nodeId
          const type = data?.type
          const reusableId = data?.reusableId
          if (nodeId && onMove && nodeId !== root.id) {
            onMove(nodeId, root.id, 0)
            return
          }
          if (type) addToRoot(type, reusableId)
        } catch (_) {}
      }}
      onDragOver={previewMode ? undefined : (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = e.dataTransfer.types.includes('application/x-builder-tree-node') ? 'move' : 'copy'
      }}
    >
      <style>{`
        [data-builder-canvas=true] .rounded,
        [data-builder-canvas=true] .rounded-md {
          border-radius: var(--border-radius, 0px);
        }
        [data-builder-canvas=true] .rounded-sm {
          border-radius: var(--border-radius-sm, 0px);
        }
        [data-builder-canvas=true] .rounded-lg,
        [data-builder-canvas=true] .rounded-xl {
          border-radius: var(--border-radius-lg, 0px);
        }
        [data-builder-canvas=true] .rounded-full {
          border-radius: var(--border-radius-full, 9999px);
        }
      `}</style>
      <div
        ref={previewMode ? undefined : scrollRef}
        className={previewMode ? 'flex-1 flex flex-col p-0' : 'flex-1 min-h-0 overflow-hidden flex flex-col p-0'}
        style={previewMode ? undefined : { height: '100%' }}
        onDragOver={previewMode ? undefined : (e) => { e.preventDefault(); e.dataTransfer.dropEffect = e.dataTransfer.types.includes('application/x-builder-tree-node') ? 'move' : 'copy' }}
      >
        <div
          className={previewMode ? 'flex-1 flex flex-col min-h-0' : 'w-full flex-1 min-h-0 flex flex-col'}
          style={previewMode ? undefined : { position: 'relative' }}
          onDragOver={previewMode ? undefined : (e) => { e.preventDefault(); e.dataTransfer.dropEffect = e.dataTransfer.types.includes('application/x-builder-tree-node') ? 'move' : 'copy' }}
        >
          <MissingReusableWarningContext.Provider value={showMissingReusableWarning}>
          <LoadingSignalContext.Provider value={loadingSignalValue}>
          <NodeErrorBoundary nodeId={root.id}>
          <NodeRenderer
            key={`${root.id}:${root.type}`}
            node={root}
            selectedId={selectedId}
            onSelect={onSelect}
            onUpdate={(updated) => onUpdate(updated)}
            onAddChild={addChild}
            onMove={onMove}
            onRunEvent={onRunEvent}
            isRoot
            previewMode={previewMode}
            suppressRootChrome={suppressRootChrome}
            resolveBinding={resolveBindingFn}
            reusablesById={reusablesById}
            reusablePropsCtx={reusablePropsCtx}
            draggingNodeId={draggingNodeId}
            onDragStartNode={setDraggingNodeId}
            onDragEndNode={() => setDraggingNodeId(null)}
          />
          </NodeErrorBoundary>
          </LoadingSignalContext.Provider>
          </MissingReusableWarningContext.Provider>
        </div>
      </div>
    </div>
    </>
  )
}
