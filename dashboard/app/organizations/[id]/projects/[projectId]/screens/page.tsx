/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import { Layout, Plus, ChevronRight, Trash2, Pencil, Check, X, List, GitBranch, Globe, Lock, Copy, Download, Upload, Database, Settings, Smartphone, Monitor, Rocket, ExternalLink, Apple, PackageOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingBar } from '@/components/ui/loading-bar'
import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

// ─── Navigation edge extraction ────────────────────────────────────────────

type AnyNode = { props?: Record<string, unknown>; children?: AnyNode[] }

const EVENT_KEYS = [
  'onLoad', 'onClick', 'onDoubleClick', 'onChange', 'onSubmit',
  'onFocus', 'onBlur', 'onInput', 'onMouseEnter', 'onMouseLeave',
  'onPressIn', 'onPressOut', 'onKeyDown', 'onKeyUp',
]

type NavTarget =
  | { kind: 'screen'; screenId: string }
  | { kind: 'url'; url: string }

/** Parse a raw event config value (may be JSON string or plain object). */
function parseRawEvent(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === 'object') return raw as Record<string, unknown>
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try { return JSON.parse(raw) } catch (_) {}
  }
  return null
}

/** Extract all navigate targets from a single parsed event config (handles both flat and multi-step). */
function extractNavigateTargets(c: Record<string, unknown>): NavTarget[] {
  const targets: NavTarget[] = []
  // Flat single-action: { action: 'navigate', targetScreenId: '...' }
  if (c.action === 'navigate') {
    if (c.targetScreenId) targets.push({ kind: 'screen', screenId: c.targetScreenId as string })
    else if (c.url && String(c.url).trim()) targets.push({ kind: 'url', url: String(c.url).trim() })
    return targets
  }
  // Multi-step: { steps: [{ action: 'navigate', ... }, ...] }
  const steps = c.steps
  if (Array.isArray(steps)) {
    for (const step of steps) {
      const s = parseRawEvent(step)
      if (!s) continue
      if (s.action === 'navigate') {
        if (s.targetScreenId) targets.push({ kind: 'screen', screenId: s.targetScreenId as string })
        else if (s.url && String(s.url).trim()) targets.push({ kind: 'url', url: String(s.url).trim() })
      }
    }
  }
  return targets
}

function collectNavTargets(node: AnyNode): NavTarget[] {
  const targets: NavTarget[] = []
  if (!node || typeof node !== 'object') return targets
  const props = node.props ?? {}
  for (const key of EVENT_KEYS) {
    const val = props[key]
    const raws = Array.isArray(val) ? val : val ? [val] : []
    for (const raw of raws) {
      const c = parseRawEvent(raw)
      if (!c) continue
      targets.push(...extractNavigateTargets(c))
    }
  }
  for (const child of (node.children ?? [])) {
    targets.push(...collectNavTargets(child))
  }
  return targets
}

// ─── Screen Map ─────────────────────────────────────────────────────────────

const NODE_W = 180
const NODE_H = 60
const COL_GAP = 72
const ROW_GAP = 72
const EXT_NODE_W = 200
const EXT_NODE_H = 52
const COLS = 3
// Extra space around all nodes so arcs never get clipped by the container
const PAD_TOP = 110    // same-row bidi return bows above top row
const PAD_RIGHT = 170  // cross-row return arc bows right of rightmost node
const PAD_BOTTOM = 110 // same-row bidi forward bows below bottom row
const PAD_LEFT = 10

interface ScreenMapProps {
  screens: any[]
  orgId: string
  projectId: string
}

function ScreenMap({ screens, orgId, projectId }: ScreenMapProps) {
  // ── Position internal screen nodes (offset by PAD so arcs don't clip) ────
  const screenPos: Record<string, { x: number; y: number }> = {}
  screens.forEach((s, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    screenPos[s.id] = {
      x: PAD_LEFT + col * (NODE_W + COL_GAP),
      y: PAD_TOP  + row * (NODE_H + ROW_GAP),
    }
  })

  const totalScreenRows = Math.ceil(screens.length / COLS)
  const screenAreaH = PAD_TOP + totalScreenRows * (NODE_H + ROW_GAP)

  // ── Collect edges ────────────────────────────────────────────────────────
  type Edge =
    | { kind: 'screen'; from: string; to: string }
    | { kind: 'url'; from: string; url: string }

  const edges: Edge[] = []
  const extUrls = new Map<string, number>() // url -> index

  for (const screen of screens) {
    const targets = collectNavTargets((screen.layout as any)?.root ?? screen.layout ?? {})
    const seenScreens = new Set<string>()
    const seenUrls = new Set<string>()
    for (const t of targets) {
      if (t.kind === 'screen') {
        if (t.screenId !== screen.id && screenPos[t.screenId] && !seenScreens.has(t.screenId)) {
          edges.push({ kind: 'screen', from: screen.id, to: t.screenId })
          seenScreens.add(t.screenId)
        }
      } else {
        if (!seenUrls.has(t.url)) {
          if (!extUrls.has(t.url)) extUrls.set(t.url, extUrls.size)
          edges.push({ kind: 'url', from: screen.id, url: t.url })
          seenUrls.add(t.url)
        }
      }
    }
  }

  // ── Position external URL nodes ──────────────────────────────────────────
  const extUrlsArr = Array.from(extUrls.entries()) // [url, idx]
  const EXT_COLS = Math.min(extUrlsArr.length, COLS)
  const EXT_ROW_START_Y = extUrlsArr.length > 0 ? screenAreaH + 40 : 0
  const extPos: Record<string, { x: number; y: number }> = {}
  extUrlsArr.forEach(([url, idx]) => {
    const col = idx % COLS
    extPos[url] = {
      x: PAD_LEFT + col * (EXT_NODE_W + COL_GAP),
      y: EXT_ROW_START_Y,
    }
  })

  // ── Canvas size ──────────────────────────────────────────────────────────
  const totalCols = Math.min(screens.length, COLS)
  const extRows = Math.ceil(extUrlsArr.length / COLS)
  const nodesW = totalCols * NODE_W + (totalCols - 1) * COL_GAP
  const extW   = EXT_COLS > 0 ? EXT_COLS * EXT_NODE_W + (EXT_COLS - 1) * COL_GAP : 0
  const canvasW = PAD_LEFT + Math.max(nodesW, extW) + PAD_RIGHT
  const canvasH = screenAreaH + (extUrlsArr.length > 0 ? 40 + extRows * (EXT_NODE_H + ROW_GAP) : 0) + PAD_BOTTOM

  // ── Build a set of bidirectional screen pairs ────────────────────────────
  const hasMirror = new Set<string>()
  const screenEdgePairs = edges.filter((e): e is Extract<typeof e, { kind: 'screen' }> => e.kind === 'screen')
  for (const e of screenEdgePairs) {
    if (screenEdgePairs.some(r => r.from === e.to && r.to === e.from)) {
      hasMirror.add(`${e.from}__${e.to}`)
    }
  }

  // ── Path builder ─────────────────────────────────────────────────────────
  // For each arrow we choose exit/entry faces so bidirectional pairs use
  // completely different sides and never collide.
  //
  //  Cross-row  A (above) → B (below):
  //    forward  : exit A.bottom-left  → enter B.top-left   (left lane, nearly straight)
  //    return   : exit B.right-center → arc right → enter A.right-center (outer bypass)
  //
  //  Same-row   A (left) → B (right):
  //    forward  : exit A.bottom-center → arc below → enter B.bottom-center
  //    return   : exit B.top-center   → arc above → enter A.top-center
  //
  //  Non-bidirectional cross-row:  bottom-center → top-center  (straight bezier)
  //  Non-bidirectional same-row:   right-center  → left-center (horizontal bezier)

  function buildScreenPath(
    fp: { x: number; y: number },
    tp: { x: number; y: number },
    fromRow: number,
    toRow: number,
    isBidi: boolean,
    isReturn: boolean   // false = forward, true = return leg of a bidirectional pair
  ): string {
    const LANE = NODE_W * 0.28   // left-lane x offset from node left edge
    const ARC  = NODE_H + ROW_GAP * 0.55  // how far side-arrows bow outward

    if (fromRow === toRow) {
      const goRight = fp.x < tp.x
      if (!isBidi) {
        // simple same-row: straight through middle
        const x1 = goRight ? fp.x + NODE_W : fp.x
        const y1 = fp.y + NODE_H / 2
        const x2 = goRight ? tp.x : tp.x + NODE_W
        const y2 = tp.y + NODE_H / 2
        const cx = (x1 + x2) / 2
        return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`
      }
      if (!isReturn) {
        // forward: bow below
        const x1 = fp.x + NODE_W / 2
        const y1 = fp.y + NODE_H       // exit bottom-center
        const x2 = tp.x + NODE_W / 2
        const y2 = tp.y + NODE_H       // enter bottom-center (path ends here, arrow tip points up INTO node)
        const bow = ARC
        return `M${x1},${y1} C${x1},${y1 + bow} ${x2},${y2 + bow} ${x2},${y2}`
      } else {
        // return: bow above
        const x1 = fp.x + NODE_W / 2
        const y1 = fp.y               // exit top-center
        const x2 = tp.x + NODE_W / 2
        const y2 = tp.y               // enter top-center
        const bow = ARC
        return `M${x1},${y1} C${x1},${y1 - bow} ${x2},${y2 - bow} ${x2},${y2}`
      }
    } else {
      // cross-row
      const goDown = fp.y < tp.y
      const srcBox = goDown ? fp : tp
      const dstBox = goDown ? tp : fp
      // swap if this is really the going-up direction (return leg going from lower to upper)
      const actualForward = (fp.y < tp.y) ? !isReturn : isReturn

      if (!isBidi) {
        // simple S-curve center → center
        const x1 = fp.x + NODE_W / 2
        const y1 = fp.y + NODE_H
        const x2 = tp.x + NODE_W / 2
        const y2 = tp.y              // tip lands on top border
        const cy = (y1 + y2) / 2
        return `M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`
      }

      if (actualForward) {
        // forward downward: left lane — nearly straight line
        const x1 = fp.x + LANE
        const y1 = fp.y + NODE_H     // exit bottom of source
        const x2 = tp.x + LANE
        const y2 = tp.y              // tip lands on top border of target
        const cy = (y1 + y2) / 2
        return `M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`
      } else {
        // return upward: exit right side of source (lower node), arc right, enter right side of dest (upper node)
        const x1 = fp.x + NODE_W     // exit right-center of lower node
        const y1 = fp.y + NODE_H / 2
        const x2 = tp.x + NODE_W     // enter right-center of upper node
        const y2 = tp.y + NODE_H / 2
        const bulge = ARC * 1.4      // how far right the arc bows
        const cx1 = x1 + bulge
        const cx2 = x2 + bulge
        return `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`
      }
    }
  }

  const hasEdges = edges.length > 0
  const entryScreenId = screens[0]?.id
  const reachable = new Set<string>()
  if (entryScreenId) {
    const queue = [entryScreenId]
    while (queue.length > 0) {
      const current = queue.shift() as string
      if (reachable.has(current)) continue
      reachable.add(current)
      for (const edge of screenEdgePairs) {
        if (edge.from === current && !reachable.has(edge.to)) queue.push(edge.to)
      }
    }
  }
  const disconnectedScreens = screens.filter((screen) => !reachable.has(screen.id))

  return (
    <div className="p-6 min-h-full">
      {hasEdges && (
        <p className="mb-4 text-[11px] text-gray-400 dark:text-gray-500">
          <span className="font-semibold text-indigo-500">{screenEdgePairs.length}</span> screen navigation link{screenEdgePairs.length !== 1 ? 's' : ''} found
          {edges.length > screenEdgePairs.length && <> · <span className="font-semibold text-amber-500">{edges.length - screenEdgePairs.length}</span> external URL{edges.length - screenEdgePairs.length !== 1 ? 's' : ''}</>}
        </p>
      )}
      {screens.length > 1 && disconnectedScreens.length > 0 && (
        <p className="mb-4 text-xs text-red-500 dark:text-red-400">
          Dead screens detected from entry screen <strong>{screens[0]?.name}</strong>: {disconnectedScreens.map((screen) => screen.name).join(', ')}.
          Add navigate actions or the app flow is broken.
        </p>
      )}
      {!hasEdges && screens.length > 1 && (
        <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">
          No navigation links yet — add a <strong>Navigate</strong> action to a button in the screen editor to draw connections here.
        </p>
      )}

      <div className="relative" style={{ width: canvasW, height: canvasH }}>
        {/* ── SVG arrows ─────────────────────────────────────────────────── */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={canvasW}
          height={canvasH}
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* refX=9 = tip of triangle exactly at path endpoint */}
            <marker id="arr" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <path d="M0,0 L0,7 L10,3.5 z" fill="#6366f1" />
            </marker>
            <marker id="arr-ext" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <path d="M0,0 L0,7 L10,3.5 z" fill="#f59e0b" />
            </marker>
          </defs>

          {edges.map((e, i) => {
            if (e.kind === 'screen') {
              const fp = screenPos[e.from]
              const tp = screenPos[e.to]
              const fromRow = Math.floor(screens.findIndex((s: any) => s.id === e.from) / COLS)
              const toRow   = Math.floor(screens.findIndex((s: any) => s.id === e.to)   / COLS)
              const pairKey = `${e.from}__${e.to}`
              const isBidi  = hasMirror.has(pairKey)
              // "return" = going upward or rightward-back when part of a bidi pair
              const isReturn = isBidi && e.from > e.to
              const d = buildScreenPath(fp, tp, fromRow, toRow, isBidi, isReturn)
              return (
                <path key={i} d={d} stroke="#6366f1" strokeWidth="1.5" fill="none" markerEnd="url(#arr)" opacity="0.85" />
              )
            } else {
              const fp = screenPos[e.from]
              const tp = extPos[e.url]
              const x1 = fp.x + NODE_W / 2
              const y1 = fp.y + NODE_H
              const x2 = tp.x + EXT_NODE_W / 2
              const y2 = tp.y
              const cy = (y1 + y2) / 2
              return (
                <path key={i} d={`M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`}
                  stroke="#f59e0b" strokeWidth="1.5" fill="none"
                  strokeDasharray="5 3" markerEnd="url(#arr-ext)" opacity="0.8" />
              )
            }
          })}
        </svg>

        {/* ── Internal screen nodes ───────────────────────────────────────── */}
        {screens.map((screen) => {
          const pos = screenPos[screen.id]
          return (
            <Link
              key={screen.id}
              href={`/organizations/${orgId}/projects/${projectId}/screens/${screen.id}/edit`}
              className="absolute flex flex-col items-start justify-center px-3 gap-0.5 bg-white dark:bg-[#161b22] border-2 border-gray-200 dark:border-[#30363d] hover:border-[var(--primary)] hover:shadow-md transition-all rounded"
              style={{ left: pos.x, top: pos.y, width: NODE_W, height: NODE_H }}
            >
              <div className="flex items-center gap-1.5 w-full min-w-0">
                <Layout className="h-3 w-3 text-indigo-400 shrink-0" />
                <span className="text-xs font-semibold text-black dark:text-white truncate">{screen.name}</span>
              </div>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate w-full pl-[18px]">/{screen.slug}</span>
            </Link>
          )
        })}

        {/* ── External URL nodes ──────────────────────────────────────────── */}
        {extUrlsArr.map(([url]) => {
          const pos = extPos[url]
          let label = url
          try { label = new URL(url).hostname || url } catch (_) {}
          return (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              title={url}
              className="absolute flex flex-col items-start justify-center px-3 gap-0.5 bg-amber-50 dark:bg-[#2d2000] border-2 border-amber-300 dark:border-amber-700 hover:border-amber-500 hover:shadow-md transition-all rounded"
              style={{ left: pos.x, top: pos.y, width: EXT_NODE_W, height: EXT_NODE_H }}
            >
              <div className="flex items-center gap-1.5 w-full min-w-0">
                <svg className="h-3 w-3 text-amber-500 shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3M10 2h4m0 0v4m0-4L7 9" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 truncate">External page</span>
              </div>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 truncate w-full pl-[18px]">{label}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ProjectScreensPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const orgId = params.id as string
  const projectId = params.projectId as string
  const [newName, setNewName] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [optimisticPublished, setOptimisticPublished] = useState<boolean | null>(null)
  const [distributeOpen, setDistributeOpen] = useState(false)
  const [buildTarget, setBuildTarget] = useState<'desktop' | 'mobile' | null>(null)
  const [buildPlatform, setBuildPlatform] = useState<'all' | 'desktop-mac' | 'desktop-windows' | 'desktop-linux'>('all')
  const [appName, setAppName] = useState('')
  const [buildStep, setBuildStep] = useState<'pick' | 'building' | 'done' | 'error'>('pick')
  const [buildJobId, setBuildJobId] = useState<string | null>(null)
  const [buildLog, setBuildLog] = useState('')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [buildPollTimer, setBuildPollTimer] = useState<ReturnType<typeof setInterval> | null>(null)
  const buildLogLower = buildLog.toLowerCase()
  const isPlatformApiUnreachable = buildLogLower.includes('platform api is not running') || buildLogLower.includes('network error')
  const isBuildExecutionFailure = buildLogLower.includes('exit code') || buildLogLower.includes('[platform-api]')

  const { data: projectData, refetch: refetchProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await axios.get(`/api/projects/${projectId}`)
      return res.data
    },
  })
  const serverPublished = projectData?.project?.status === 'published' || !!(projectData?.project?.metadata?.isPublished)
  const isPublished = optimisticPublished !== null ? optimisticPublished : serverPublished
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/p/${projectId}` : `/p/${projectId}`

  const publishMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      const res = await axios.put(`/api/projects/${projectId}`, { isPublished: publish })
      return res.data
    },
    onMutate: (publish) => {
      setOptimisticPublished(publish)
      setPublishError(null)
    },
    onSuccess: () => { refetchProject(); setOptimisticPublished(null) },
    onError: (err: any) => {
      setOptimisticPublished(null)
      setPublishError(err?.response?.data?.error ?? err?.message ?? 'Failed to update publish state')
    },
  })

  const copyPublicUrl = useCallback(() => {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    })
  }, [publicUrl])

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const base = `/api/projects/${projectId}/screens`
  const importFileRef = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(async () => {
    const res = await axios.get(`/api/projects/${projectId}/screens`)
    const allScreens = res.data?.screens ?? []
    const globalsRaw = typeof window !== 'undefined' ? localStorage.getItem(`dccortex:project-globals:${projectId}`) : null
    const globals = globalsRaw ? JSON.parse(globalsRaw) : {}
    const payload = { exportVersion: 1, projectId, screens: allScreens, globals }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `project-${projectId}.json`; a.click()
    URL.revokeObjectURL(url)
  }, [projectId])

  const handleImportFiles = useCallback(async (files: File[]) => {
    try {
      // Phase 0: Parse all files first, collect all screens
      const allScreens: { screen: any; sourceFile: string; originalText: string }[] = []
      const parseErrors: string[] = []
      for (const file of files) {
        const text = await file.text()
        const data = JSON.parse(text)
        let screens: any[]
        if (Array.isArray(data?.screens) && data.screens.length > 0) {
          screens = data.screens
        } else if (data?.screen && typeof data.screen === 'object' && data.screen.layout) {
          screens = [data.screen]
        } else {
          parseErrors.push(file.name)
          continue
        }
        for (const s of screens) {
          allScreens.push({ screen: s, sourceFile: file.name, originalText: text })
        }
      }

      if (allScreens.length === 0) {
        alert(`No screens found in ${files.length} file(s).${parseErrors.length ? ` Skipped: ${parseErrors.join(', ')}` : ''}`)
        return
      }

      const summary = files.length === 1
        ? `Import ${allScreens.length} screen(s) from "${files[0].name}"?`
        : `Import ${allScreens.length} screen(s) from ${files.length} files?`
      if (!confirm(`${summary} This will add them alongside existing screens.`)) return

      // Phase 1: Create all screens, collect originalSlug → createdId mapping
      const slugToId: Record<string, string> = {}
      const createdScreenIds: (string | null)[] = []
      for (const { screen: s } of allScreens) {
        const originalSlug = s.slug ?? 'screen'
        const name = s.name ?? originalSlug
        try {
          const res = await axios.post(`/api/projects/${projectId}/screens`, { name, slug: originalSlug, layout: s.layout, script: s.script ?? '' })
          const created = res.data?.screen ?? res.data
          if (created?.id) {
            slugToId[originalSlug] = created.id
            createdScreenIds.push(created.id)
          } else {
            createdScreenIds.push(null)
          }
        } catch {
          createdScreenIds.push(null)
        }
      }

      // Phase 2: Resolve __SCREEN:slug__ placeholders in layouts with real IDs
      let patchCount = 0
      for (let i = 0; i < allScreens.length; i++) {
        const { screen: s } = allScreens[i]
        const screenId = createdScreenIds[i]
        if (!screenId) continue
        const layoutStr = JSON.stringify(s.layout)
        if (!layoutStr.includes('__SCREEN:')) continue
        const resolved = layoutStr.replace(/__SCREEN:([a-z0-9-]+)__/g, (_match: string, targetSlug: string) => slugToId[targetSlug] ?? _match)
        if (resolved !== layoutStr) {
          try {
            await axios.patch(`/api/projects/${projectId}/screens/${screenId}`, { layout: JSON.parse(resolved) })
            patchCount++
          } catch { /* patch failed, navigation links will be broken */ }
        }
      }

      const created = createdScreenIds.filter(Boolean).length
      queryClient.invalidateQueries({ queryKey: ['screens', projectId] })
      alert(`Imported ${created} screen(s) successfully.${patchCount > 0 ? ` Linked navigation across ${patchCount} screen(s).` : ''}${parseErrors.length ? ` Skipped ${parseErrors.length} file(s).` : ''}`)
    } catch (e: any) {
      alert('Import failed: ' + (e?.message ?? 'Invalid file'))
    }
  }, [projectId, queryClient])

  // Refresh when Cortex AI completes actions
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['screens', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    }
    window.addEventListener('cortex:refresh', handler)
    return () => window.removeEventListener('cortex:refresh', handler)
  }, [projectId, queryClient])

  // Navigate to a newly created screen when Cortex creates one
  useEffect(() => {
    const handler = (e: Event) => {
      const screenId = (e as CustomEvent<{ screenId: string }>).detail?.screenId
      if (screenId) {
        router.push(`/organizations/${orgId}/projects/${projectId}/screens/${screenId}/edit`)
      }
    }
    window.addEventListener('cortex:navigate-screen', handler)
    return () => window.removeEventListener('cortex:navigate-screen', handler)
  }, [orgId, projectId, router])

  // Build polling — stop when done/failed or modal closed
  useEffect(() => {
    if (!buildJobId || buildStep !== 'building') return
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/build?jobId=${buildJobId}`)
        const data = await res.json()
        if (data.status === 'done') {
          clearInterval(timer)
          setDownloadUrl(data.downloadUrl ?? null)
          setBuildStep('done')
        } else if (data.status === 'failed') {
          clearInterval(timer)
          setBuildLog(data.log ?? data.error ?? 'Build failed')
          setBuildStep('error')
        }
      } catch {}
    }, 4000)
    setBuildPollTimer(timer)
    return () => clearInterval(timer)
  }, [buildJobId, buildStep, projectId])

  // Clean up poll on modal close
  useEffect(() => {
    if (!distributeOpen) {
      if (buildPollTimer) clearInterval(buildPollTimer)
      setBuildStep('pick')
      setBuildJobId(null)
      setBuildLog('')
      setDownloadUrl(null)
      setBuildTarget(null)
    }
  }, [distributeOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const startBuild = useCallback(async () => {
    setBuildStep('building')
    setBuildLog('Queuing build in your organization container…')
    try {
      const res = await fetch(`/api/projects/${projectId}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: buildTarget === 'mobile' ? 'mobile' : buildPlatform,
          appName: appName || projectData?.project?.name || 'MyApp',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'platform_api_unavailable') {
          setBuildLog(data.message)
        } else {
          setBuildLog(data.error ?? data.message ?? 'Failed to start build')
        }
        setBuildStep('error')
        return
      }
      setBuildJobId(data.jobId)
      setBuildLog('Build started ✓ — this runs in the background. You can close this and come back.')
    } catch (err: any) {
      setBuildLog(err?.message ?? 'Network error')
      setBuildStep('error')
    }
  }, [buildTarget, buildPlatform, appName, projectId, projectData])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['screens', projectId],
    queryFn: async () => {
      const res = await axios.get(base)
      return res.data
    },
    retry: 2,
    retryDelay: 1000,
  })

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'screen'
      const res = await axios.post(base, { name, slug })
      return res.data
    },
    onSuccess: (data) => {
      const screen = data?.screen
      if (screen?.id) {
        queryClient.setQueryData(
          ['screens', projectId],
          (old: { screens?: unknown[] } | undefined) =>
            old ? { screens: [...(old.screens ?? []), screen] } : old
        )
      }
      queryClient.invalidateQueries({ queryKey: ['screens', projectId] })
      setCreateOpen(false)
      setNewName('')
      if (screen?.id) window.location.href = `/organizations/${orgId}/projects/${projectId}/screens/${screen.id}/edit`
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (screenId: string) => {
      await axios.delete(`${base}/${screenId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['screens', projectId] }),
  })

  const renameMutation = useMutation({
    mutationFn: async ({ screenId, name }: { screenId: string; name: string }) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'screen'
      const res = await axios.patch(`${base}/${screenId}`, { name, slug })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screens', projectId] })
      setRenamingId(null)
    },
  })

  const startRename = useCallback((screen: any) => {
    setRenamingId(screen.id)
    setRenameValue(screen.name)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }, [])

  const commitRename = useCallback((screenId: string) => {
    const value = renameValue.trim()
    if (value) renameMutation.mutate({ screenId, name: value })
    else setRenamingId(null)
  }, [renameValue, renameMutation])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
    setRenameValue('')
  }, [])

  const screens = data?.screens ?? []

  if (isLoading && !isError) {
    return (
      <DashboardLayout>
        <LoadingBar fullPage />
      </DashboardLayout>
    )
  }

  if (isError) {
    const message = (error as any)?.response?.data?.error ?? (error as Error)?.message ?? 'Failed to load screens'
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-white dark:bg-[#0d1117] flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-8 text-center">
            <h2 className="text-lg font-medium text-black dark:text-white mb-2">Couldn't load screens</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{message}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button type="button" onClick={() => refetch()} className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:bg-gray-900 dark:hover:bg-gray-200">Retry</button>
              <Link href={`/organizations/${orgId}`} className="px-4 py-2 border border-gray-300 dark:border-[#30363d] text-black dark:text-white text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#21262d]">Back to project</Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const breadcrumbs = [
    { label: 'Organizations', href: '/dashboard' },
    { label: 'Org', href: `/organizations/${orgId}` },
    { label: 'Project', href: `/organizations/${orgId}/projects/${projectId}/backend` },
    { label: 'Screens', href: '#' },
  ]

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen bg-white dark:bg-[#0d1117]">
        <div className="shrink-0 border-b border-gray-200 dark:border-[#30363d] px-3 sm:px-6 py-3 sm:py-4">
          <Breadcrumb items={breadcrumbs} />
          {/* Project-level nav */}
          <div className="mt-3 flex gap-1 items-center overflow-x-auto pb-1">
            <Link href={`/organizations/${orgId}/projects/${projectId}/screens`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 border-black dark:border-white text-black dark:text-white">
              <Layout className="h-3.5 w-3.5" />Screens
            </Link>
            <Link href={`/organizations/${orgId}/projects/${projectId}/data`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">
              <Database className="h-3.5 w-3.5" />Data
            </Link>
            <Link href={`/organizations/${orgId}/projects/${projectId}/settings`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">
              <Settings className="h-3.5 w-3.5" />Settings
            </Link>

          </div>
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Layout className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <h1 className="text-xl font-medium text-black dark:text-white">Screens</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex border border-gray-200 dark:border-[#30363d] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-black dark:bg-white text-white dark:text-black'
                      : 'bg-white dark:bg-[#161b22] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#21262d]'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Screens</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('map')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 dark:border-[#30363d] ${
                    viewMode === 'map'
                      ? 'bg-black dark:bg-white text-white dark:text-black'
                      : 'bg-white dark:bg-[#161b22] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#21262d]'
                  }`}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Map</span>
                </button>
              </div>

              <button type="button" onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 dark:border-[#30363d] rounded hover:bg-gray-50 dark:hover:bg-[#21262d] text-gray-600 dark:text-gray-300">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button type="button" onClick={() => importFileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 dark:border-[#30363d] rounded hover:bg-gray-50 dark:hover:bg-[#21262d] text-gray-600 dark:text-gray-300">
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Import</span>
              </button>
              <input ref={importFileRef} type="file" accept=".json" multiple className="hidden" onChange={(e) => { const files = e.target.files; if (files?.length) { handleImportFiles(Array.from(files)); e.target.value = '' } }} />
              {publishError && (
                <span className="text-xs text-red-500 max-w-[160px] truncate" title={publishError}>{publishError}</span>
              )}
              {isPublished ? (
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Live
                  </span>
                  <button
                    type="button"
                    onClick={copyPublicUrl}
                    title={publicUrl}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 dark:border-[#30363d] rounded hover:bg-gray-50 dark:hover:bg-[#21262d] text-gray-600 dark:text-gray-300"
                  >
                    {copiedUrl ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedUrl ? 'Copied!' : 'Copy URL'}
                  </button>
                  <button
                    type="button"
                    onClick={() => publishMutation.mutate(true)}
                    disabled={publishMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {publishMutation.isPending ? 'Saving…' : 'Redeploy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => publishMutation.mutate(false)}
                    disabled={publishMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-gray-200 dark:border-[#30363d] text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:border-red-700 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Unpublish
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => publishMutation.mutate(true)}
                  disabled={publishMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-gray-700 dark:text-gray-300 hover:bg-green-50 hover:border-green-400 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:border-green-700 dark:hover:text-green-400 disabled:opacity-50 transition-colors"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {publishMutation.isPending ? 'Publishing…' : 'Publish web'}
                </button>
              )}
              {/* Distribute as native app */}
              <button
                type="button"
                onClick={() => setDistributeOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
              >
                <Rocket className="h-3.5 w-3.5" />
                Distribute
              </button>
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-900 dark:hover:bg-gray-200"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New screen</span>
              </Button>
            </div>
          </div>
        </div>

        {viewMode === 'map' ? (
          <div className="flex-1 overflow-auto bg-white dark:bg-[#0d1117]">
            {screens.length === 0 ? (
              <div className="p-12 text-center text-gray-400 dark:text-gray-500 text-sm">No screens yet.</div>
            ) : (
              <ScreenMap screens={screens} orgId={orgId} projectId={projectId} />
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-3 sm:p-6">
          <div className="max-w-3xl mx-auto">
            {screens.length === 0 ? (
              <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-12 text-center">
                <Layout className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                <h2 className="text-lg font-medium text-black dark:text-white mb-2">No screens yet</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Create a screen to design your app UI with the no-code builder.</p>
                <Button onClick={() => setCreateOpen(true)} className="bg-black dark:bg-white text-white dark:text-black">
                  <Plus className="h-4 w-4" />
                  New screen
                </Button>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-1">
                {screens.map((screen: any) => (
                  <div
                    key={screen.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] px-3 sm:px-4 py-3 group"
                  >
                    {renamingId === screen.id ? (
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <Layout className="h-4 w-4 text-gray-400 shrink-0" />
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(screen.id)
                            if (e.key === 'Escape') cancelRename()
                          }}
                          onBlur={() => commitRename(screen.id)}
                          className="flex-1 min-w-0 px-2 py-0.5 text-sm font-medium border border-[var(--primary)] bg-white dark:bg-[#0d1117] text-black dark:text-white outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); commitRename(screen.id) }}
                          className="p-1 text-green-600 hover:text-green-700 shrink-0"
                          title="Save"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); cancelRename() }}
                          className="p-1 text-gray-400 hover:text-red-500 shrink-0"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <Link
                        href={`/organizations/${orgId}/projects/${projectId}/screens/${screen.id}/edit`}
                        className="flex-1 flex items-center gap-3 min-w-0 w-full"
                      >
                        <Layout className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="font-medium text-black dark:text-white truncate">{screen.name}</span>
                        <span className="text-gray-400 dark:text-gray-500 text-sm truncate">/{screen.slug}</span>
                        <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                      </Link>
                    )}

                    {renamingId !== screen.id && (
                      <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => startRename(screen)}
                          className="p-2 text-gray-400 hover:text-black dark:hover:text-white"
                          title="Rename"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(screen.id)}
                          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete screen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d]">
          <DialogHeader>
            <DialogTitle>New screen</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Input
              placeholder="Screen name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && newName.trim() && createMutation.mutate(newName.trim())}
              className="border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white"
              autoFocus
            />
            <Button
              onClick={() => newName.trim() && createMutation.mutate(newName.trim())}
              disabled={!newName.trim()}
              className="bg-black dark:bg-white text-white dark:text-black"
            >
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Build & Download modal ─────────────────────────────── */}
      <Dialog open={distributeOpen} onOpenChange={(o) => { if (!o) setDistributeOpen(false) }}>
        <DialogContent className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] max-w-3xl max-h-[92vh] overflow-y-auto p-0">

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center gap-3 px-7 py-5 border-b border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22]">
            <Rocket className="h-5 w-5 text-black dark:text-white shrink-0" />
            <div>
              <DialogTitle>
                <span className="text-base font-semibold text-black dark:text-white leading-tight">Build &amp; Download your app</span>
              </DialogTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                DCCortex builds your app inside your organisation&apos;s container — download the installer and run it.
              </p>
            </div>
          </div>

          <div className="px-7 py-6 space-y-7">

            {/* ── Step: pick ───────────────────────────────── */}
            {buildStep === 'pick' && (
              <>
                {/* App name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">App name</label>
                  <input
                    type="text"
                    placeholder={projectData?.project?.name ?? 'My App'}
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="w-full border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-sm text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 px-3 py-2.5 focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>

                {/* Target cards */}
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Choose target</p>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Desktop */}
                    <button
                      onClick={() => setBuildTarget('desktop')}
                      className={`relative border-2 p-5 text-left transition-all ${
                        buildTarget === 'desktop'
                          ? 'border-black dark:border-white bg-gray-50 dark:bg-white/5'
                          : 'border-gray-200 dark:border-[#30363d] hover:border-gray-500 dark:hover:border-gray-400'
                      }`}
                    >
                      <Monitor className="h-7 w-7 mb-3 text-black dark:text-white" />
                      <p className="font-semibold text-sm text-black dark:text-white">Desktop app</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">macOS · Windows · Linux</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Tiny installer (~10 MB), no Node.js needed</p>
                      <span className="mt-3 inline-block text-[10px] px-2 py-0.5 border border-gray-300 dark:border-[#30363d] text-gray-600 dark:text-gray-400 font-medium">Tauri 2</span>
                    </button>

                    {/* Mobile — coming soon */}
                    <div className="relative border-2 border-dashed border-gray-200 dark:border-[#30363d] p-5 opacity-60 cursor-not-allowed select-none">
                      <Smartphone className="h-7 w-7 mb-3 text-gray-300 dark:text-gray-600" />
                      <p className="font-semibold text-sm text-black dark:text-white">Mobile app</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">iOS · Android</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">App Store &amp; Play Store ready</p>
                      <span className="mt-3 inline-block text-[10px] px-2 py-0.5 border border-gray-200 dark:border-[#30363d] text-gray-500 dark:text-gray-400 font-medium">Coming soon</span>
                    </div>
                  </div>
                </div>

                {/* Platform selector — only when desktop chosen */}
                {buildTarget === 'desktop' && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">Platform</p>
                    <div className="flex gap-2 flex-wrap">
                      {(
                        [
                          { val: 'all', label: 'All platforms' },
                          { val: 'desktop-mac', label: '🍎 macOS' },
                          { val: 'desktop-windows', label: '🪟 Windows' },
                          { val: 'desktop-linux', label: '🐧 Linux' },
                        ] as { val: typeof buildPlatform; label: string }[]
                      ).map(({ val, label }) => (
                        <button
                          key={val}
                          onClick={() => setBuildPlatform(val)}
                          className={`px-3.5 py-1.5 text-xs font-medium border transition-all ${
                            buildPlatform === val
                              ? 'border-black dark:border-white bg-black dark:bg-white text-white dark:text-black'
                              : 'border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      {buildPlatform === 'all'
                        ? 'Builds .dmg, .exe/.msi, and .AppImage/.deb in one run'
                        : buildPlatform === 'desktop-mac'
                        ? 'Output: .dmg + .app bundle (arm64 + x86_64 universal)'
                        : buildPlatform === 'desktop-windows'
                        ? 'Output: .msi (WiX) + .exe (NSIS installer)'
                        : 'Output: .AppImage + .deb + .rpm'}
                    </p>
                  </div>
                )}

                {/* Build button */}
                <button
                  disabled={buildTarget !== 'desktop'}
                  onClick={startBuild}
                  className="w-full flex items-center justify-center gap-2 bg-black dark:bg-white hover:bg-black/80 dark:hover:bg-white/80 disabled:opacity-40 disabled:cursor-not-allowed text-white dark:text-black font-semibold py-3.5 text-sm transition-colors"
                >
                  <Rocket className="h-4 w-4" />
                  Build &amp; Download
                </button>

                {buildTarget !== 'desktop' && (
                  <p className="text-center text-xs text-gray-400 dark:text-gray-500 -mt-4">Select a target above to continue</p>
                )}

                {/* Already published web link */}
                <div className="flex items-center gap-2 border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117] px-4 py-3">
                  <Globe className="h-4 w-4 text-black dark:text-white shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Web app</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {typeof window !== 'undefined' ? `${window.location.origin}/p/${projectId}` : `/p/${projectId}`}
                    </p>
                  </div>
                  <a
                    href={`/p/${projectId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-black dark:text-white hover:underline shrink-0"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </>
            )}

            {/* ── Step: building ──────────────────────────── */}
            {buildStep === 'building' && (
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="h-12 w-12 border-4 border-black dark:border-white border-t-transparent animate-spin" />
                  <div className="text-center">
                    <p className="font-semibold text-black dark:text-white">Building your app…</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Running in your organization&apos;s background build worker.</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">You can close this dialog and come back — build will continue.</p>
                  </div>
                </div>
                {buildLog && (
                  <pre className="border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117] text-xs text-gray-600 dark:text-gray-400 p-4 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                    {buildLog}
                  </pre>
                )}
              </div>
            )}

            {/* ── Step: done ──────────────────────────────── */}
            {buildStep === 'done' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="h-14 w-14 border border-gray-200 dark:border-[#30363d] flex items-center justify-center text-2xl">✓</div>
                  <div className="text-center">
                    <p className="font-semibold text-black dark:text-white text-lg">Your app is ready!</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Download the installer, run it, and your app launches instantly.</p>
                  </div>
                </div>

                {downloadUrl ? (
                  <a
                    href={downloadUrl}
                    className="w-full flex items-center justify-center gap-2 bg-black dark:bg-white hover:bg-black/80 dark:hover:bg-white/80 text-white dark:text-black font-semibold py-3.5 text-sm transition-colors"
                    download
                  >
                    <PackageOpen className="h-4 w-4" />
                    Download installer
                  </a>
                ) : (
                  <p className="text-center text-xs text-gray-400 dark:text-gray-500">Download link not available — check your container file storage.</p>
                )}

                <button
                  onClick={() => setBuildStep('pick')}
                  className="w-full text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 py-1 underline underline-offset-2"
                >
                  Build again
                </button>

                {/* Collapsible distribute-further docs */}
                <details className="border border-gray-200 dark:border-[#30363d] overflow-hidden">
                  <summary className="cursor-pointer px-5 py-3.5 text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 select-none hover:bg-gray-50 dark:hover:bg-[#161b22]">
                    <ExternalLink className="h-4 w-4 text-black dark:text-white" />
                    Distribute to App Store / Play Store / teams
                  </summary>
                  <div className="px-5 pb-5 pt-3 space-y-4 text-xs text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-[#30363d]">
                    <div>
                      <p className="font-semibold text-black dark:text-white mb-1">🍎 macOS App Store &amp; Notarization</p>
                      <p>Sign the <code className="bg-gray-100 dark:bg-[#21262d] px-1">.app</code> bundle with your Apple Developer certificate, notarise with <code className="bg-gray-100 dark:bg-[#21262d] px-1">xcrun altool</code>, then submit via Transporter. See <a href="https://tauri.app/distribute/app-stores/" className="underline" target="_blank" rel="noopener noreferrer">Tauri app-store guide ↗</a>.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-black dark:text-white mb-1">🪟 Windows Store / Enterprise</p>
                      <p>Use the <code className="bg-gray-100 dark:bg-[#21262d] px-1 rounded">.msix</code> target (add to <code className="bg-gray-100 dark:bg-[#21262d] px-1 rounded">tauri.conf.json → bundle.targets</code>) and submit to the Microsoft Partner Center, or sideload with Group Policy for internal distribution.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-black dark:text-white mb-1">🤖 Android (coming soon)</p>
                      <p>When mobile builds are available, the <code className="bg-gray-100 dark:bg-[#21262d] px-1 rounded">.aab</code> can be uploaded to Google Play Console. Sign with your upload keystore produced by <code className="bg-gray-100 dark:bg-[#21262d] px-1 rounded">cargo tauri android build --release</code>.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-black dark:text-white mb-1">📦 Self-host &amp; sideload</p>
                      <p>Upload the installer to any static host (S3, R2, GitHub Releases). Use the <a href="https://tauri.app/plugin/updater/" className="text-indigo-500 hover:underline" target="_blank" rel="noopener noreferrer">Tauri updater plugin ↗</a> to push future updates automatically.</p>
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* ── Step: error ─────────────────────────────── */}
            {buildStep === 'error' && (
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="h-14 w-14 border border-gray-200 dark:border-[#30363d] flex items-center justify-center text-xl font-mono text-black dark:text-white">✕</div>
                  <div className="text-center">
                    <p className="font-semibold text-black dark:text-white">Build failed</p>
                    {isPlatformApiUnreachable ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">The build service couldn&apos;t be reached. Make sure your container is running.</p>
                    ) : isBuildExecutionFailure ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">The build service was reached, but the build command failed. Check the log below for the exact cause.</p>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">The build could not be completed.</p>
                    )}
                  </div>
                </div>
                {buildLog && (
                  <pre className="border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117] text-xs text-gray-600 dark:text-gray-400 p-4 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                    {buildLog}
                  </pre>
                )}
                <div className="border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#0d1117] px-4 py-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <p className="font-medium text-black dark:text-white">To use native builds:</p>
                  <p>1. Start the platform API: <code className="bg-gray-200 dark:bg-[#21262d] px-1">docker-compose up platform-api</code></p>
                  <p>2. Or connect to your deployed platform instance via <code className="bg-gray-200 dark:bg-[#21262d] px-1">PLATFORM_API_URL</code> env var.</p>
                  {isBuildExecutionFailure && (
                    <p>3. If you see <code className="bg-gray-200 dark:bg-[#21262d] px-1">exit code 125</code>, restart Docker Desktop and recreate <code className="bg-gray-200 dark:bg-[#21262d] px-1">platform-api</code> so nested Docker mounts are refreshed.</p>
                  )}
                  <p className="pt-1 border-t border-gray-200 dark:border-[#30363d] mt-1">Your app is already available as a web app at <a href={`/p/${projectId}`} target="_blank" rel="noopener noreferrer" className="underline">/p/{projectId}</a>.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setBuildStep('pick')}
                    className="flex-1 border border-gray-200 dark:border-[#30363d] text-sm text-gray-600 dark:text-gray-400 py-2.5 hover:bg-gray-50 dark:hover:bg-[#0d1117] transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={startBuild}
                    className="flex-1 bg-black dark:bg-white hover:bg-black/80 dark:hover:bg-white/80 text-white dark:text-black font-semibold text-sm py-2.5 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
