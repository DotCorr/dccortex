/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useState, useCallback, useEffect, useRef, useMemo, useLayoutEffect } from 'react'
import { flushSync } from 'react-dom'
import { useWebHaptics } from 'web-haptics/react'
import { Save, Eye, X, Sun, Moon, RefreshCw, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Minimize2, ExternalLink, SlidersHorizontal } from 'lucide-react'
import { DeviceFrameset, DeviceOptions } from 'react-device-frameset'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LoadingBar } from '@/components/ui/loading-bar'
import { ComponentPalette } from '@/components/builder/ComponentPalette'
import { BuilderCanvas } from '@/components/builder/BuilderCanvas'
import { resolveBinding, resolveExpression, getDateNowMap } from '@/components/builder/bindingResolver'
import { DebugConsole, type DebugConsoleHandle, type ApiLogEntry } from '@/components/builder/DebugConsole'
import { executeAnimationSequence, clearAnimationSequence } from '@/components/builder/animationSequenceExecutor'
import { PropertyPanel } from '@/components/builder/PropertyPanel'
import { NodeTree } from '@/components/builder/NodeTree'
import { ResizablePanelLayout } from '@/components/builder/ResizablePanel'
import { GlobalReusablesPane } from '@/components/builder/GlobalReusablesPane'
import { createNode, getComponentDef, type Node } from '@/components/builder/registry'
import type { StateDefinition, DataSourceDef, ScreenTheme, SeoSettings, CustomTypeDef } from '@/components/builder/PropertyPanel'
import type { EventActionConfig, EventRuntimeContext } from '@/components/builder/eventHelpers'
import type { AnimationSequenceConfig } from '@/components/builder/AnimationSequenceBuilder'
import { EMPTY_BUILDER_GLOBALS, type BuilderGlobals, type ReusableDefinition } from '@/components/builder/globals'
import { PackageManager } from '@/components/builder/PackageManager'

const DEFAULT_THEME: ScreenTheme = {
  borderRadius: '8px',
  borderRadiusSm: '4px',
  borderRadiusLg: '12px',
  primary: '#2563eb',
  background: '#ffffff',
  text: '#1f2937',
  surface: '#f9fafb',
  borderColor: '#e5e7eb',
}

type PreviewViewport = 'mobile' | 'tablet' | 'desktop' | 'freeform'
type FrameCategory = Exclude<PreviewViewport, 'freeform'>
type DeviceName = keyof typeof DeviceOptions
type FrameConfig = { device: DeviceName; color?: string; landscape?: boolean }

const DEVICE_OPTIONS_BY_CATEGORY: Record<FrameCategory, DeviceName[]> = {
  mobile: ['iPhone X', 'iPhone 8', 'Galaxy Note 8', 'Nexus 5', 'Samsung Galaxy S5'],
  tablet: ['iPad Mini'],
  desktop: ['MacBook Pro'],
}

const DEFAULT_FRAME_CONFIG_BY_CATEGORY: Record<FrameCategory, FrameConfig> = {
  mobile: { device: 'iPhone X', landscape: false },
  tablet: { device: 'iPad Mini', color: 'black', landscape: true },
  desktop: { device: 'MacBook Pro' },
}

function normalizeFrameConfig(category: FrameCategory, candidate?: Partial<FrameConfig>): FrameConfig {
  const allowed = DEVICE_OPTIONS_BY_CATEGORY[category]
  const fallback = DEFAULT_FRAME_CONFIG_BY_CATEGORY[category]
  const requestedDevice = candidate?.device
  const device = requestedDevice && allowed.includes(requestedDevice) ? requestedDevice : fallback.device
  const option = DeviceOptions[device]
  const colorChoices = option.colors as readonly string[]
  const defaultColor = colorChoices.length > 0 ? colorChoices[0] : undefined
  const requestedColor = candidate?.color
  const color = defaultColor && requestedColor && colorChoices.includes(requestedColor)
    ? requestedColor
    : defaultColor
  const landscape = option.hasLandscape ? Boolean(candidate?.landscape ?? fallback.landscape ?? false) : undefined
  return { device, color, landscape }
}

function isZeroBorderRadius(value: unknown): boolean {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return false
  if (raw === '0' || raw === '0px' || raw === '0rem' || raw === '0em' || raw === '0%') return true
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed === 0
}

type ScreenLayoutPayload = {
  root: Node
  stateDefinitions: StateDefinition[]
  dataSources: DataSourceDef[]
  namedScripts: Record<string, string>
  theme?: ScreenTheme
  presentation?: 'page' | 'modal'
  seoSettings?: SeoSettings
  /** Props this screen declares — other screens pass these via navigate navProps */
  screenPropDefs?: { name: string; type: string; defaultValue?: string; required?: boolean }[]
  /** Named object schemas (custom types) defined on this screen */
  customTypes?: CustomTypeDef[]
  /** Whether this screen is protected from AI modifications */
  aiProtected?: boolean
}

type EditorNotice = {
  id: string
  kind: 'info' | 'success' | 'error'
  message: string
}

type OrgResourceCatalog = {
  permissions: {
    canManageOrgResources: boolean
    canViewDataResources: boolean
  }
  rules: {
    memberDataSharingEnabled: boolean
  }
  projects: Array<{ id: string; name: string; slug: string; owner?: { userId?: string | null; name?: string | null; email?: string | null } | null }>
  summary: {
    projectCount: number
    orgReusableCount: number
    reusableReferenceCount: number
    assetCount: number
    apiSourceCount: number
    datasourceCount: number
    tableCount: number
  }
  reusables: {
    organization: Array<{
      id: string
      name: string
      root?: unknown
      propsSchema?: unknown
      createdAt?: string
      updatedAt?: string
      sourceProjectId?: string
      sourceProjectName?: string | null
      sourceOwnerUserId?: string
      sourceOwnerName?: string | null
      sourceOwnerEmail?: string | null
      promotedByUserId?: string
    }>
    usage: Array<{
      reusableId: string
      reusableName: string | null
      totalInstances: number
      usage: Array<{
        projectId: string
        projectName: string
        screenId: string
        screenName: string
        screenSlug: string
        instanceCount: number
      }>
    }>
  }
  assets: Array<{ id: string; name: string; mimetype: string; size: number; url: string; projectId: string; projectOwnerName?: string | null; projectOwnerEmail?: string | null; project?: { name?: string } | null }>
  apiSources: Array<{
    id: string
    name: string
    method: string
    url: string
    authType: string
    headers?: unknown
    body?: string | null
    authValue?: string | null
    authHeader?: string | null
    schema?: unknown
    projectId: string
    projectOwnerName?: string | null
    projectOwnerEmail?: string | null
    project?: { name?: string } | null
  }>
  databases: Array<{
    datasourceId: string
    projectId: string
    projectName: string
    projectOwnerName?: string | null
    projectOwnerEmail?: string | null
    tableCount: number
    tables: Array<{ id: string; name: string; columnCount: number; rowCount: number }>
  }>
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

function findNode(root: Node, id: string): Node | null {
  if (root.id === id) return root
  for (const child of root.children ?? []) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

/** Path from root to nodeId (root first, nodeId last), or null if not found. */
function getPathToNode(root: Node, nodeId: string): Node[] | null {
  if (root.id === nodeId) return [root]
  for (const child of root.children ?? []) {
    const sub = getPathToNode(child, nodeId)
    if (sub) return [root, ...sub]
  }
  return null
}

/** ReusableId of the reusable instance that contains nodeId (nearest ancestor that is reusableInstance), or null. */
function findContainingReusableId(root: Node, nodeId: string): string | null {
  const path = getPathToNode(root, nodeId)
  if (!path) return null
  const lastReusable = [...path].reverse().find((n) => n.type === 'reusableInstance')
  return lastReusable ? String((lastReusable.props as { reusableId?: string }).reusableId ?? '') : null
}

/** __propContract of the nearest ancestor that defines component props (so descendants can bind to {{prop.key}}). */
function findContainingPropContract(root: Node, nodeId: string): { key: string; type: 'string' | 'number' | 'boolean'; required?: boolean }[] | null {
  const path = getPathToNode(root, nodeId)
  if (!path) return null
  const self = path[path.length - 1]
  const selfContract = (self.props as { __propContract?: unknown[] })?.__propContract
  if (Array.isArray(selfContract) && selfContract.length > 0) {
    return selfContract as { key: string; type: 'string' | 'number' | 'boolean'; required?: boolean }[]
  }
  if (path.length < 2) return null
  const ancestors = path.slice(0, -1)
  const withContract = [...ancestors].reverse().find((n) => {
    const contract = (n.props as { __propContract?: unknown[] })?.__propContract
    return Array.isArray(contract) && contract.length > 0
  })
  if (!withContract) return null
  const contract = (withContract.props as { __propContract: { key: string; type: 'string' | 'number' | 'boolean'; required?: boolean }[] }).__propContract
  return contract
}

function updateNodeInTree(root: Node, id: string, updater: (n: Node) => Node): Node {
  if (root.id === id) return updater(root)
  return {
    ...root,
    children: (root.children ?? []).map((c) => updateNodeInTree(c, id, updater)),
  }
}

/** Remove a node by id from the tree (root cannot be deleted). Returns new root. */
function deleteNodeInTree(root: Node, id: string): Node {
  if (root.id === id) return root
  const children = root.children ?? []
  const next = children.filter((c) => c.id !== id).map((c) => deleteNodeInTree(c, id))
  if (next.length === children.length) {
    return { ...root, children: children.map((c) => deleteNodeInTree(c, id)) }
  }
  return { ...root, children: next }
}

/** Check if targetId is in the subtree of nodeId (would create cycle if we move nodeId into targetId). */
function isDescendantOf(root: Node, nodeId: string, targetId: string): boolean {
  if (root.id === nodeId) {
    const has = (n: Node): boolean => n.id === targetId || (n.children ?? []).some(has)
    return (root.children ?? []).some(has)
  }
  for (const c of root.children ?? []) {
    if (isDescendantOf(c, nodeId, targetId)) return true
  }
  return false
}

/** Replace the node with id `nodeId` by `newNode` in the tree. Returns new root. */
function replaceNodeInTree(root: Node, nodeId: string, newNode: Node): Node {
  if (root.id === nodeId) return newNode
  const children = root.children ?? []
  for (let i = 0; i < children.length; i++) {
    if (children[i].id === nodeId) {
      const next = [...children]
      next[i] = newNode
      return { ...root, children: next }
    }
  }
  return {
    ...root,
    children: children.map((c) => replaceNodeInTree(c, nodeId, newNode)),
  }
}

/** Remove node by id; returns [newRoot, removedNode or null]. */
function removeNodeFromTree(root: Node, id: string): [Node, Node | null] {
  if (root.id === id) return [root, null]
  const children = root.children ?? []
  for (let i = 0; i < children.length; i++) {
    if (children[i].id === id) {
      const removed = children[i]
      return [{ ...root, children: [...children.slice(0, i), ...children.slice(i + 1)] }, removed]
    }
    const [newChild, found] = removeNodeFromTree(children[i], id)
    if (found) {
      const next = [...children]
      next[i] = newChild
      return [{ ...root, children: next }, found]
    }
  }
  return [root, null]
}

/** Move nodeId to be a child of newParentId at index. Returns new root. */
function moveNodeInTree(root: Node, nodeId: string, newParentId: string, index: number): Node {
  if (nodeId === root.id || nodeId === newParentId) return root
  if (isDescendantOf(root, nodeId, newParentId)) return root
  const [rootWithout, node] = removeNodeFromTree(root, nodeId)
  if (!node) return root
  const addTo = (n: Node): Node => {
    if (n.id !== newParentId) return { ...n, children: (n.children ?? []).map(addTo) }
    const kids = [...(n.children ?? [])]
    kids.splice(Math.max(0, index), 0, node)
    return { ...n, children: kids }
  }
  return addTo(rootWithout)
}

function deepCloneNode(node: Node): Node {
  return JSON.parse(JSON.stringify(node)) as Node
}

function cloneNodeWithFreshIds(node: Node): Node {
  const clone = deepCloneNode(node)
  const renew = (n: Node): Node => ({
    ...n,
    id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    children: (n.children ?? []).map(renew),
  })
  return renew(clone)
}

function insertNodeIntoParent(root: Node, parentId: string, node: Node): Node {
  if (root.id === parentId) return { ...root, children: [...(root.children ?? []), node] }
  return {
    ...root,
    children: (root.children ?? []).map((c) => insertNodeIntoParent(c, parentId, node)),
  }
}

function findParentId(root: Node, childId: string, parentId: string | null = null): string | null {
  if (root.id === childId) return parentId
  for (const child of root.children ?? []) {
    const found = findParentId(child, childId, root.id)
    if (found) return found
  }
  return null
}

function collectStateRefs(node: Node): string[] {
  const found = new Set<string>()
  const walk = (n: Node) => {
    for (const value of Object.values(n.props ?? {})) {
      if (typeof value !== 'string') continue
      const re = /\{\{\s*state\.([a-zA-Z0-9_.$-]+)\s*\}\}/g
      let m: RegExpExecArray | null
      while ((m = re.exec(value)) !== null) {
        const raw = (m[1] ?? '').trim()
        if (raw) found.add(raw.split('.')[0])
      }
    }
    for (const c of n.children ?? []) walk(c)
  }
  walk(node)
  return Array.from(found)
}

function upsertByName(local: StateDefinition[], global: StateDefinition[]): StateDefinition[] {
  const merged = [...global]
  for (const s of local) {
    const idx = merged.findIndex((g) => g.name.trim() === s.name.trim() && s.name.trim())
    if (idx > -1) merged[idx] = s
    else merged.push(s)
  }
  return merged
}

function collectReusablePropsSchema(root: Node): { key: string; type: 'string' | 'number' | 'boolean'; defaultValue?: string; required?: boolean }[] {
  const byKey = new Map<string, { key: string; type: 'string' | 'number' | 'boolean'; defaultValue?: string; required?: boolean }>()
  const walk = (node: Node) => {
    const contract = (node.props?.__propContract as Array<{ key: string; type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date'; required?: boolean }> | undefined) ?? []
    for (const entry of contract) {
      const key = String(entry.key ?? '').trim()
      if (!key || byKey.has(key)) continue
      const type: 'string' | 'number' | 'boolean' = entry.type === 'number' || entry.type === 'boolean' ? entry.type : 'string'
      const value = (node.props as Record<string, unknown>)[key]
      const defaultValue = value != null ? String(value) : undefined
      const isEmpty = defaultValue === undefined || defaultValue === ''
      byKey.set(key, { key, type, defaultValue, required: entry.required ?? isEmpty })
    }
    for (const child of node.children ?? []) walk(child)
  }
  walk(root)
  return Array.from(byKey.values())
}

const defaultLayout: Node = {
  id: 'root',
  type: 'container',
  props: {},
  children: [],
}

type CollaboratorPresence = {
  userId: string
  name: string | null
  screenId: string | null
  selectionId?: string | null
  cursorX?: number | null
  cursorY?: number | null
  viewState?: CollaboratorViewState | null
  clientId?: string
}

type CollaboratorViewState = {
  previewSize?: PreviewViewport
  deviceFrameEnabled?: boolean
  frameConfigByCategory?: Partial<Record<FrameCategory, Partial<FrameConfig>>>
  clientSentAt?: number
}

type PresenceMode = 'off' | 'slow' | 'panel'

const REMOTE_REFRESH_DEBOUNCE_MS = 180
const PRESENCE_POST_THROTTLE_MS = 120
const REMOTE_VIEW_APPLY_COOLDOWN_MS = 1200

const COLLABORATOR_COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#be123c', '#4f46e5']

function colorForPresence(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return COLLABORATOR_COLORS[hash % COLLABORATOR_COLORS.length]
}

function initialsForPresence(name: string | null, fallback: string): string {
  const source = (name || fallback || '').trim()
  if (!source) return 'U'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function shouldTrackApiUrl(url: string): boolean {
  const lower = String(url ?? '').toLowerCase()
  if (!lower) return false
  if (lower.includes('/api/projects/') && (lower.includes('/presence') || lower.includes('/sync'))) return false
  return lower.includes('/api/') || lower.includes('openai') || lower.includes('anthropic') || lower.includes('/ai/')
}

function expandDataSourceAliases(name: string): string[] {
  const trimmed = String(name ?? '').trim()
  if (!trimmed) return []
  const snake = trimmed.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
  const kebab = trimmed.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  const compact = trimmed.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase()
  return Array.from(new Set([trimmed, snake, kebab, compact].filter(Boolean)))
}

type StoredPreviewSettings = Partial<{
  previewMode: boolean
  previewSize: PreviewViewport
  canvasZoom: number
  canvasExpanded: boolean
  previewTheme: 'light' | 'dark'
  deviceFrameEnabled: boolean
  mobileAutoClosePalette: boolean
  apiLiveRefreshEnabled: boolean
  showLayoutInspector: boolean
  canvasBgColor: string
  showCanvasMesh: boolean
  frameConfigByCategory: Record<FrameCategory, FrameConfig>
}>

function loadStoredPreviewSettings(projectId: string, screenId: string): StoredPreviewSettings | null {
  if (typeof window === 'undefined') return null

  const previewSettingsKey = `dccortex:preview-settings:${projectId}:${screenId}`
  const previewSizeStorageKey = `dccortex:preview-size:${projectId}:${screenId}`
  const canvasZoomStorageKey = `dccortex:canvas-zoom:${projectId}:${screenId}`
  const canvasExpandedStorageKey = `dccortex:canvas-expanded:${projectId}:${screenId}`
  const deviceFrameStorageKey = `dccortex:device-frame:${projectId}:${screenId}`
  const canvasColorStorageKey = `dccortex:canvas-color:${projectId}:${screenId}`
  const canvasMeshStorageKey = `dccortex:canvas-mesh:${projectId}:${screenId}`
  const frameConfigStorageKey = `dccortex:frame-config:${projectId}:${screenId}`

  const state: StoredPreviewSettings = {}

  try {
    const raw = window.localStorage.getItem(previewSettingsKey)
    if (raw) {
      const parsed = JSON.parse(raw) as StoredPreviewSettings
      if (typeof parsed.previewMode === 'boolean') state.previewMode = parsed.previewMode
      if (parsed.previewTheme === 'light' || parsed.previewTheme === 'dark') state.previewTheme = parsed.previewTheme
      if (typeof parsed.mobileAutoClosePalette === 'boolean') state.mobileAutoClosePalette = parsed.mobileAutoClosePalette
      if (typeof parsed.apiLiveRefreshEnabled === 'boolean') state.apiLiveRefreshEnabled = parsed.apiLiveRefreshEnabled
      if (typeof parsed.showLayoutInspector === 'boolean') state.showLayoutInspector = parsed.showLayoutInspector
      if (typeof parsed.canvasBgColor === 'string' && parsed.canvasBgColor.trim()) state.canvasBgColor = parsed.canvasBgColor
      if (typeof parsed.showCanvasMesh === 'boolean') state.showCanvasMesh = parsed.showCanvasMesh
      if (typeof parsed.deviceFrameEnabled === 'boolean') state.deviceFrameEnabled = parsed.deviceFrameEnabled
      if (typeof parsed.canvasExpanded === 'boolean') state.canvasExpanded = parsed.canvasExpanded
      if (typeof parsed.canvasZoom === 'number' && Number.isFinite(parsed.canvasZoom)) {
        state.canvasZoom = Math.min(3, Math.max(0.25, parsed.canvasZoom))
      }
      if (parsed.frameConfigByCategory) {
        state.frameConfigByCategory = {
          mobile: normalizeFrameConfig('mobile', parsed.frameConfigByCategory.mobile),
          tablet: normalizeFrameConfig('tablet', parsed.frameConfigByCategory.tablet),
          desktop: normalizeFrameConfig('desktop', parsed.frameConfigByCategory.desktop),
        }
      }
      if (parsed.previewSize === 'mobile' || parsed.previewSize === 'tablet' || parsed.previewSize === 'desktop' || parsed.previewSize === 'freeform') {
        state.previewSize = parsed.previewSize
      }
    }

    const previewSizeRaw = window.localStorage.getItem(previewSizeStorageKey)
    if (previewSizeRaw === 'mobile' || previewSizeRaw === 'tablet' || previewSizeRaw === 'desktop' || previewSizeRaw === 'freeform') {
      state.previewSize = previewSizeRaw
    }

    const zoomRaw = window.localStorage.getItem(canvasZoomStorageKey)
    if (zoomRaw != null) {
      const parsedZoom = Number(zoomRaw)
      if (Number.isFinite(parsedZoom)) state.canvasZoom = Math.min(3, Math.max(0.25, parsedZoom))
    }

    const expandedRaw = window.localStorage.getItem(canvasExpandedStorageKey)
    if (expandedRaw === 'true' || expandedRaw === 'false') {
      state.canvasExpanded = expandedRaw === 'true'
    }

    const deviceFrameRaw = window.localStorage.getItem(deviceFrameStorageKey)
    if (deviceFrameRaw === 'true' || deviceFrameRaw === 'false') {
      state.deviceFrameEnabled = deviceFrameRaw === 'true'
    }

    const colorRaw = window.localStorage.getItem(canvasColorStorageKey)
    if (typeof colorRaw === 'string' && colorRaw.trim()) {
      state.canvasBgColor = colorRaw
    }

    const meshRaw = window.localStorage.getItem(canvasMeshStorageKey)
    if (meshRaw === 'true' || meshRaw === 'false') {
      state.showCanvasMesh = meshRaw === 'true'
    }

    const frameConfigRaw = window.localStorage.getItem(frameConfigStorageKey)
    if (frameConfigRaw) {
      try {
        const parsedFrameConfig = JSON.parse(frameConfigRaw) as Partial<Record<FrameCategory, Partial<FrameConfig>>>
        state.frameConfigByCategory = {
          mobile: normalizeFrameConfig('mobile', parsedFrameConfig.mobile),
          tablet: normalizeFrameConfig('tablet', parsedFrameConfig.tablet),
          desktop: normalizeFrameConfig('desktop', parsedFrameConfig.desktop),
        }
      } catch {}
    }
  } catch {}

  return Object.keys(state).length > 0 ? state : null
}

export default function ScreenEditPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const orgId = params.id as string
  const projectId = params.projectId as string
  const screenId = params.screenId as string
  const [root, setRoot] = useState<Node>(defaultLayout)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [previewMode, setPreviewMode] = useState(() => loadStoredPreviewSettings(projectId, screenId)?.previewMode ?? false)
  const [runtimeData, setRuntimeData] = useState<Record<string, unknown>>({})
  const [runtimePendingSources, setRuntimePendingSources] = useState<string[]>([])
  const [previewSize, setPreviewSize] = useState<PreviewViewport>(() => {
    const stored = loadStoredPreviewSettings(projectId, screenId)?.previewSize
    if (stored) return stored
    if (typeof window === 'undefined') return 'desktop'
    if (window.innerWidth < 640) return 'mobile'
    if (window.innerWidth < 1024) return 'tablet'
    return 'desktop'
  })
  const [canvasZoom, setCanvasZoom] = useState(() => loadStoredPreviewSettings(projectId, screenId)?.canvasZoom ?? 1)
  const ZOOM_STEP = 0.1
  const ZOOM_MIN = 0.25
  const ZOOM_MAX = 3
  const [canvasBgColor, setCanvasBgColor] = useState(() => loadStoredPreviewSettings(projectId, screenId)?.canvasBgColor ?? '#f3f4f6')
  const [showCanvasMesh, setShowCanvasMesh] = useState(() => loadStoredPreviewSettings(projectId, screenId)?.showCanvasMesh ?? false)
  const [canvasExpanded, setCanvasExpanded] = useState(() => loadStoredPreviewSettings(projectId, screenId)?.canvasExpanded ?? false)
  const [devSettingsOpen, setDevSettingsOpen] = useState(false)
  const [deviceFrameEnabled, setDeviceFrameEnabled] = useState(() => loadStoredPreviewSettings(projectId, screenId)?.deviceFrameEnabled ?? true)
  const [frameConfigByCategory, setFrameConfigByCategory] = useState<Record<FrameCategory, FrameConfig>>(() => loadStoredPreviewSettings(projectId, screenId)?.frameConfigByCategory ?? DEFAULT_FRAME_CONFIG_BY_CATEGORY)
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>(() => loadStoredPreviewSettings(projectId, screenId)?.previewTheme ?? 'light')
  const [apiLiveRefreshEnabled, setApiLiveRefreshEnabled] = useState(() => loadStoredPreviewSettings(projectId, screenId)?.apiLiveRefreshEnabled ?? true)
  const [showLayoutInspector, setShowLayoutInspector] = useState(() => loadStoredPreviewSettings(projectId, screenId)?.showLayoutInspector ?? true)
  const [theme, setTheme] = useState<ScreenTheme>(DEFAULT_THEME)
  const [script, setScript] = useState('')
  const [stateDefinitions, setStateDefinitions] = useState<StateDefinition[]>([])
  const [globalStateDefinitions, setGlobalStateDefinitions] = useState<StateDefinition[]>([])
  const [dataSources, setDataSources] = useState<DataSourceDef[]>([])
  const [namedScripts, setNamedScripts] = useState<Record<string, string>>({})
  const [scriptsHydrated, setScriptsHydrated] = useState(false)
  const [globalReusables, setGlobalReusables] = useState<ReusableDefinition[]>([])
  const [promotingReusableIds, setPromotingReusableIds] = useState<string[]>([])
  const [globalTheme, setGlobalTheme] = useState<ScreenTheme>({})
  const [previewScreenId, setPreviewScreenId] = useState<string | null>(null)
  const [previewNavHistory, setPreviewNavHistory] = useState<string[]>([])
  const [modalScreenId, setModalScreenId] = useState<string | null>(null)
  const modalScreenIdRef = useRef<string | null>(null)
  const [screenPresentation, setScreenPresentation] = useState<'page' | 'modal'>('page')
  const screenPresentationRef = useRef<'page' | 'modal'>('page')
  /** Props declared by this screen (accessible as {{navProp.key}} from calling screens) */
  const [screenPropDefs, setScreenPropDefs] = useState<{ name: string; type: string; defaultValue?: string }[]>([])
  const screenPropDefsRef = useRef<{ name: string; type: string; defaultValue?: string }[]>([])
  /** Custom type definitions (named schemas) */
  const [customTypes, setCustomTypes] = useState<CustomTypeDef[]>([])
  const customTypesRef = useRef<CustomTypeDef[]>([])
  /** AI protection flag */
  const [aiProtected, setAiProtected] = useState(false)
  const aiProtectedRef = useRef(false)
  /** Refs to avoid stale closures in commitLayoutChange setTimeout */
  const stateDefinitionsRef = useRef<StateDefinition[]>(stateDefinitions)
  stateDefinitionsRef.current = stateDefinitions
  const dataSourcesRef = useRef<DataSourceDef[]>(dataSources)
  dataSourcesRef.current = dataSources
  const namedScriptsRef = useRef<Record<string, string>>(namedScripts)
  namedScriptsRef.current = namedScripts
  const scriptFnCacheRef = useRef<Record<string, ((state: Record<string, unknown>, data: Record<string, unknown>) => unknown) | null>>({})
  /** NavProps passed to the currently-previewed (non-modal) screen */
  const [previewNavProps, setPreviewNavProps] = useState<Record<string, unknown>>({})
  /** NavProps passed to the currently-open modal screen */
  const [modalNavProps, setModalNavProps] = useState<Record<string, unknown>>({})
  const [editingReusableId, setEditingReusableId] = useState<string | null>(null)
  const [editingReusableRoot, setEditingReusableRoot] = useState<Node | null>(null)
  const [reusableSelectedId, setReusableSelectedId] = useState<string | null>(null)
  const [undoRedoVersion, setUndoRedoVersion] = useState(0)
  const [clipboardNode, setClipboardNode] = useState<Node | null>(null)
  const { trigger: triggerHaptic } = useWebHaptics()
  const [presence, setPresence] = useState<CollaboratorPresence[]>([])
  const [inspection, setInspection] = useState<{ nodeId: string; html: string } | null>(null)
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([])
  const [collaboratorsDialogOpen, setCollaboratorsDialogOpen] = useState(false)
  const [presenceMode, setPresenceMode] = useState<PresenceMode>('slow')
  const [mobileAutoClosePalette, setMobileAutoClosePalette] = useState(false)
  const [panelWidthsVersion, setPanelWidthsVersion] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [layoutGuideRect, setLayoutGuideRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [packageManagerOpen, setPackageManagerOpen] = useState(false)
  const [previewSettingsLoaded, setPreviewSettingsLoaded] = useState(false)
  const undoStackRef = useRef<Node[]>([])
  const redoStackRef = useRef<Node[]>([])
  const reusableUndoStackRef = useRef<Node[]>([])
  const reusableRedoStackRef = useRef<Node[]>([])
  const reusableRestoreAttemptedRef = useRef(false)
  const globalStateUndoRef = useRef<StateDefinition[][]>([])
  const globalStateRedoRef = useRef<StateDefinition[][]>([])
  const editingReusableRootRef = useRef<Node | null>(null)
  const previewSettingsHydratedRef = useRef(false)
  /** True while a layout save is scheduled or in flight; prevents poll from overwriting local root. */
  const pendingLayoutSaveRef = useRef(false)
  const pendingServerRefreshRef = useRef(false)
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshInFlightRef = useRef(false)
  const refreshQueuedRef = useRef(false)
  const clientIdRef = useRef(`client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
  const selectionIdRef = useRef<string | null>(null)
  const cursorRef = useRef<{ x: number | null; y: number | null }>({ x: null, y: null })
  const lastPresencePostAtRef = useRef(0)
  const pendingPresencePayloadRef = useRef<{
    selectionId: string | null
    cursorX: number | null
    cursorY: number | null
    viewState: CollaboratorViewState
  } | null>(null)
  const presencePostTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const applyingRemoteViewStateRef = useRef(false)
  const lastLocalViewStateChangeAtRef = useRef(0)
  const paintedSelectionsRef = useRef<Array<{ el: HTMLElement; outline: string; outlineOffset: string; boxShadow: string }>>([])
  const canvasStageRef = useRef<HTMLDivElement | null>(null)
  const canvasViewportRef = useRef<HTMLDivElement | null>(null)
  const layoutOverlayHostRef = useRef<HTMLDivElement | null>(null)
  const apiLogIdRef = useRef(0)
  const themeRef = useRef<ScreenTheme>(theme)
  themeRef.current = theme
  const [seoSettings, setSeoSettings] = useState<SeoSettings>({})
  const seoRef = useRef<SeoSettings>(seoSettings)
  seoRef.current = seoSettings
  const [systemDark, setSystemDark] = useState(false)
  const previewSettingsKey = useMemo(() => `dccortex:preview-settings:${projectId}:${screenId}`, [projectId, screenId])
  const previewSizeStorageKey = useMemo(() => `dccortex:preview-size:${projectId}:${screenId}`, [projectId, screenId])
  const canvasZoomStorageKey = useMemo(() => `dccortex:canvas-zoom:${projectId}:${screenId}`, [projectId, screenId])
  const canvasExpandedStorageKey = useMemo(() => `dccortex:canvas-expanded:${projectId}:${screenId}`, [projectId, screenId])
  const deviceFrameStorageKey = useMemo(() => `dccortex:device-frame:${projectId}:${screenId}`, [projectId, screenId])
  const canvasColorStorageKey = useMemo(() => `dccortex:canvas-color:${projectId}:${screenId}`, [projectId, screenId])
  const canvasMeshStorageKey = useMemo(() => `dccortex:canvas-mesh:${projectId}:${screenId}`, [projectId, screenId])
  const frameConfigStorageKey = useMemo(() => `dccortex:frame-config:${projectId}:${screenId}`, [projectId, screenId])
  const apiLiveRefreshStorageKey = useMemo(() => `dccortex:api-live-refresh:${projectId}:${screenId}`, [projectId, screenId])
  const layoutInspectorStorageKey = useMemo(() => `dccortex:layout-inspector:${projectId}:${screenId}`, [projectId, screenId])
  const panelWidthsStorageKey = useMemo(() => `dccortex:panel-widths:${projectId}:${screenId}`, [projectId, screenId])
  const propertyPanelTabStorageKey = useMemo(() => `dccortex:property-tab:${projectId}:${screenId}`, [projectId, screenId])
  const debugConsoleStorageKey = useMemo(() => `dccortex:debug-console:${projectId}:${screenId}`, [projectId, screenId])
  const selectedNodeStorageKey = useMemo(() => `dccortex:selected-node:${projectId}:${screenId}`, [projectId, screenId])
  const reusableEditorStateStorageKey = useMemo(() => `dccortex:reusable-editor:${projectId}:${screenId}`, [projectId, screenId])
  const treeStorageKey = useMemo(() => `dccortex:node-tree:${projectId}:${screenId}`, [projectId, screenId])
  const paletteScrollStorageKey = useMemo(() => `dccortex:palette:${projectId}:${screenId}`, [projectId, screenId])
  const propertyPanelScrollStorageKey = useMemo(() => `dccortex:property-scroll:${projectId}:${screenId}`, [projectId, screenId])
  const frameCategory: FrameCategory = previewSize === 'mobile' ? 'mobile' : previewSize === 'tablet' ? 'tablet' : 'desktop'
  const framesAllowed = !editingReusableId
  const effectiveDeviceFrameEnabled = framesAllowed && deviceFrameEnabled
  const activeFrameConfig = frameConfigByCategory[frameCategory]
  const activeFrameOption = DeviceOptions[activeFrameConfig.device]
  const availableDevices = DEVICE_OPTIONS_BY_CATEGORY[frameCategory]
  const [canvasStageSize, setCanvasStageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [editorNotices, setEditorNotices] = useState<EditorNotice[]>([])
  const noticeTimeoutsRef = useRef<Record<string, number>>({})
  const [orgResourceBrowserOpen, setOrgResourceBrowserOpen] = useState(false)
  const [orgResourceCatalog, setOrgResourceCatalog] = useState<OrgResourceCatalog | null>(null)
  const [orgResourceCatalogLoading, setOrgResourceCatalogLoading] = useState(false)
  const [orgResourceCatalogError, setOrgResourceCatalogError] = useState<string | null>(null)
  const [orgResourceSearch, setOrgResourceSearch] = useState('')
  const [orgResourceProjectFilter, setOrgResourceProjectFilter] = useState('')
  const [orgRuleSaving, setOrgRuleSaving] = useState(false)
  const [importingOrgReusableIds, setImportingOrgReusableIds] = useState<string[]>([])
  const [importingApiSourceIds, setImportingApiSourceIds] = useState<string[]>([])

  const dismissEditorNotice = useCallback((noticeId: string) => {
    const timeoutId = noticeTimeoutsRef.current[noticeId]
    if (typeof timeoutId === 'number') {
      window.clearTimeout(timeoutId)
      delete noticeTimeoutsRef.current[noticeId]
    }
    setEditorNotices((prev) => prev.filter((notice) => notice.id !== noticeId))
  }, [])

  const pushEditorNotice = useCallback((kind: EditorNotice['kind'], message: string, durationMs = 3200) => {
    const id = `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setEditorNotices((prev) => [...prev, { id, kind, message }])
    if (durationMs > 0) {
      const timeoutId = window.setTimeout(() => {
        setEditorNotices((prev) => prev.filter((notice) => notice.id !== id))
        delete noticeTimeoutsRef.current[id]
      }, durationMs)
      noticeTimeoutsRef.current[id] = timeoutId
    }
    return id
  }, [])

  useEffect(() => {
    return () => {
      Object.values(noticeTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId))
      noticeTimeoutsRef.current = {}
    }
  }, [])

  const fetchOrgResourceCatalog = useCallback(async (query = orgResourceSearch, projectFilter = orgResourceProjectFilter) => {
    if (!orgId) {
      setOrgResourceCatalogError('Missing organization context.')
      return
    }

    setOrgResourceCatalogLoading(true)
    setOrgResourceCatalogError(null)
    try {
      const params = new URLSearchParams()
      const normalizedQuery = query.trim()
      const normalizedProject = projectFilter.trim()
      if (normalizedQuery) params.set('q', normalizedQuery)
      if (normalizedProject) params.set('projectId', normalizedProject)
      const suffix = params.toString() ? `?${params.toString()}` : ''
      const response = await axios.get(`/api/organizations/${orgId}/resource-catalog${suffix}`)
      setOrgResourceCatalog(response.data as OrgResourceCatalog)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load organization resource catalog'
      setOrgResourceCatalogError(msg)
    } finally {
      setOrgResourceCatalogLoading(false)
    }
  }, [orgId, orgResourceProjectFilter, orgResourceSearch])

  const updateOrgMemberDataSharingRule = useCallback(async (enabled: boolean) => {
    if (!orgId) return
    setOrgRuleSaving(true)
    try {
      await axios.patch(`/api/organizations/${orgId}/resource-catalog`, {
        memberDataSharingEnabled: enabled,
      })
      pushEditorNotice('success', enabled ? 'Members can now reuse shared data resources.' : 'Member data sharing is now admin-only.')
      await fetchOrgResourceCatalog(orgResourceSearch, orgResourceProjectFilter)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update sharing rule'
      pushEditorNotice('error', msg)
    } finally {
      setOrgRuleSaving(false)
    }
  }, [fetchOrgResourceCatalog, orgId, orgResourceProjectFilter, orgResourceSearch, pushEditorNotice])

  const importApiSourceFromOrg = useCallback(async (sourceId: string, sourceName: string) => {
    if (!orgId) return
    if (importingApiSourceIds.includes(sourceId)) return
    setImportingApiSourceIds((prev) => (prev.includes(sourceId) ? prev : [...prev, sourceId]))

    try {
      await axios.post(`/api/projects/${projectId}/api-sources/import-from-org`, {
        organizationId: orgId,
        sourceId,
      })
      pushEditorNotice('success', `Linked API "${sourceName}" into this project.`)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to link API source'
      pushEditorNotice('error', msg)
    } finally {
      setImportingApiSourceIds((prev) => prev.filter((id) => id !== sourceId))
    }
  }, [orgId, projectId, pushEditorNotice, importingApiSourceIds])

  const readPreviewCacheSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return null

    const rawPreviewSettings = window.localStorage.getItem(previewSettingsKey)
    const rawPreviewSize = window.localStorage.getItem(previewSizeStorageKey)
    const rawCanvasZoom = window.localStorage.getItem(canvasZoomStorageKey)
    const rawCanvasExpanded = window.localStorage.getItem(canvasExpandedStorageKey)
    const rawDeviceFrame = window.localStorage.getItem(deviceFrameStorageKey)
    const rawCanvasColor = window.localStorage.getItem(canvasColorStorageKey)
    const rawCanvasMesh = window.localStorage.getItem(canvasMeshStorageKey)
    const rawFrameConfig = window.localStorage.getItem(frameConfigStorageKey)

    return {
      previewSettingsKey,
      previewSizeStorageKey,
      canvasZoomStorageKey,
      canvasExpandedStorageKey,
      deviceFrameStorageKey,
      canvasColorStorageKey,
      canvasMeshStorageKey,
      frameConfigStorageKey,
      previewSettings: rawPreviewSettings,
      previewSize: rawPreviewSize,
      canvasZoom: rawCanvasZoom,
      canvasExpanded: rawCanvasExpanded,
      deviceFrameEnabled: rawDeviceFrame,
      canvasBgColor: rawCanvasColor,
      showCanvasMesh: rawCanvasMesh,
      frameConfigStored: Boolean(rawFrameConfig),
      legacyPreviewSettingsStored: Boolean(rawPreviewSettings),
    }
  }, [previewSettingsKey, previewSizeStorageKey, canvasZoomStorageKey, canvasExpandedStorageKey, deviceFrameStorageKey, canvasColorStorageKey, canvasMeshStorageKey, frameConfigStorageKey])
  const logicalViewport = useMemo(() => {
    if (previewSize === 'freeform') {
      const width = Math.max(1, Math.round(canvasStageSize.width || 1280))
      const height = Math.max(1, Math.round(canvasStageSize.height || 720))
      return { width, height }
    }
    const option = DeviceOptions[activeFrameConfig.device]
    if (option) {
      const isLandscape = option.hasLandscape ? Boolean(activeFrameConfig.landscape) : false
      const width = isLandscape ? option.height : option.width
      const height = isLandscape ? option.width : option.height
      return { width, height }
    }
    if (previewSize === 'mobile') {
      return { width: 375, height: Math.round((375 * 19.5) / 9) }
    }
    if (previewSize === 'tablet') {
      return { width: 768, height: 576 }
    }
    return { width: 1280, height: 720 }
  }, [previewSize, canvasStageSize.height, canvasStageSize.width, activeFrameConfig.device, activeFrameConfig.landscape])
  const [canvasFitScale, setCanvasFitScale] = useState(1)
  const frameGutterLogical = useMemo(() => {
    if (previewSize === 'freeform' || !effectiveDeviceFrameEnabled) return 0
    return frameCategory === 'mobile' ? 220 : frameCategory === 'tablet' ? 180 : 180
  }, [previewSize, effectiveDeviceFrameEnabled, frameCategory])
  const antiClipPaddingLogical = useMemo(() => {
    if (previewSize === 'freeform' || !effectiveDeviceFrameEnabled) return 0
    return 56
  }, [previewSize, effectiveDeviceFrameEnabled])
  const fitLogicalSize = useMemo(() => {
    const extra = (frameGutterLogical + antiClipPaddingLogical) * 2
    return {
      width: logicalViewport.width + extra,
      height: logicalViewport.height + extra,
    }
  }, [logicalViewport.width, logicalViewport.height, frameGutterLogical, antiClipPaddingLogical])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem('dccortex:presence-mode')
      if (raw === 'off' || raw === 'slow' || raw === 'panel') setPresenceMode(raw)
      else setPresenceMode('slow')
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(previewSettingsKey)

      if (raw) {
        const parsed = JSON.parse(raw) as {
          previewMode?: boolean
          previewSize?: PreviewViewport
          canvasZoom?: number
          canvasExpanded?: boolean
          previewTheme?: 'light' | 'dark'
          deviceFrameEnabled?: boolean
          mobileAutoClosePalette?: boolean
          apiLiveRefreshEnabled?: boolean
          showLayoutInspector?: boolean
          canvasBgColor?: string
          showCanvasMesh?: boolean
          frameConfigByCategory?: Partial<Record<FrameCategory, Partial<FrameConfig>>>
        }
        if (typeof parsed.previewMode === 'boolean') setPreviewMode(parsed.previewMode)
        if (parsed.previewTheme === 'light' || parsed.previewTheme === 'dark') setPreviewTheme(parsed.previewTheme)
        if (typeof parsed.mobileAutoClosePalette === 'boolean') setMobileAutoClosePalette(parsed.mobileAutoClosePalette)
        if (typeof parsed.apiLiveRefreshEnabled === 'boolean') setApiLiveRefreshEnabled(parsed.apiLiveRefreshEnabled)
        if (typeof parsed.showLayoutInspector === 'boolean') setShowLayoutInspector(parsed.showLayoutInspector)
      }

      const apiLiveRaw = window.localStorage.getItem(apiLiveRefreshStorageKey)
      if (apiLiveRaw === 'true' || apiLiveRaw === 'false') {
        setApiLiveRefreshEnabled(apiLiveRaw === 'true')
      }
      const layoutInspectorRaw = window.localStorage.getItem(layoutInspectorStorageKey)
      if (layoutInspectorRaw === 'true' || layoutInspectorRaw === 'false') {
        setShowLayoutInspector(layoutInspectorRaw === 'true')
      }

      const previewSizeRaw = window.localStorage.getItem(previewSizeStorageKey)
      if (previewSizeRaw === 'mobile' || previewSizeRaw === 'tablet' || previewSizeRaw === 'desktop' || previewSizeRaw === 'freeform') {
        setPreviewSize(previewSizeRaw)
      } else if (raw) {
        const parsed = JSON.parse(raw) as { previewSize?: PreviewViewport }
        if (parsed.previewSize === 'mobile' || parsed.previewSize === 'tablet' || parsed.previewSize === 'desktop' || parsed.previewSize === 'freeform') {
          setPreviewSize(parsed.previewSize)
        }
      }

      const zoomRaw = window.localStorage.getItem(canvasZoomStorageKey)
      if (zoomRaw != null) {
        const parsedZoom = Number(zoomRaw)
        if (Number.isFinite(parsedZoom)) {
          setCanvasZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, parsedZoom)))
        }
      } else if (raw) {
        const parsed = JSON.parse(raw) as { canvasZoom?: number }
        if (typeof parsed.canvasZoom === 'number' && Number.isFinite(parsed.canvasZoom)) {
          setCanvasZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, parsed.canvasZoom)))
        }
      }

      const expandedRaw = window.localStorage.getItem(canvasExpandedStorageKey)
      if (expandedRaw === 'true' || expandedRaw === 'false') {
        setCanvasExpanded(expandedRaw === 'true')
      } else if (raw) {
        const parsed = JSON.parse(raw) as { canvasExpanded?: boolean }
        if (typeof parsed.canvasExpanded === 'boolean') setCanvasExpanded(parsed.canvasExpanded)
      }

      const deviceFrameRaw = window.localStorage.getItem(deviceFrameStorageKey)
      if (deviceFrameRaw === 'true' || deviceFrameRaw === 'false') {
        setDeviceFrameEnabled(deviceFrameRaw === 'true')
      } else if (raw) {
        const parsed = JSON.parse(raw) as { deviceFrameEnabled?: boolean }
        if (typeof parsed.deviceFrameEnabled === 'boolean') setDeviceFrameEnabled(parsed.deviceFrameEnabled)
      }

      const colorRaw = window.localStorage.getItem(canvasColorStorageKey)
      if (typeof colorRaw === 'string' && colorRaw.trim()) {
        setCanvasBgColor(colorRaw)
      } else if (raw) {
        const parsed = JSON.parse(raw) as { canvasBgColor?: string }
        if (typeof parsed.canvasBgColor === 'string' && parsed.canvasBgColor.trim()) setCanvasBgColor(parsed.canvasBgColor)
      }

      const meshRaw = window.localStorage.getItem(canvasMeshStorageKey)
      if (meshRaw === 'true' || meshRaw === 'false') {
        setShowCanvasMesh(meshRaw === 'true')
      } else if (raw) {
        const parsed = JSON.parse(raw) as { showCanvasMesh?: boolean }
        if (typeof parsed.showCanvasMesh === 'boolean') setShowCanvasMesh(parsed.showCanvasMesh)
      }

      const frameConfigRaw = window.localStorage.getItem(frameConfigStorageKey)
      if (frameConfigRaw) {
        try {
          const parsedFrameConfig = JSON.parse(frameConfigRaw) as Partial<Record<FrameCategory, Partial<FrameConfig>>>
          setFrameConfigByCategory({
            mobile: normalizeFrameConfig('mobile', parsedFrameConfig.mobile),
            tablet: normalizeFrameConfig('tablet', parsedFrameConfig.tablet),
            desktop: normalizeFrameConfig('desktop', parsedFrameConfig.desktop),
          })
        } catch {
          // Fall through to legacy blob parsing.
        }
      } else if (raw) {
        const parsed = JSON.parse(raw) as { frameConfigByCategory?: Partial<Record<FrameCategory, Partial<FrameConfig>>> }
        if (parsed.frameConfigByCategory) {
          setFrameConfigByCategory({
            mobile: normalizeFrameConfig('mobile', parsed.frameConfigByCategory.mobile),
            tablet: normalizeFrameConfig('tablet', parsed.frameConfigByCategory.tablet),
            desktop: normalizeFrameConfig('desktop', parsed.frameConfigByCategory.desktop),
          })
        }
      }

    } catch {}
    previewSettingsHydratedRef.current = true
    setPreviewSettingsLoaded(true)
  }, [readPreviewCacheSnapshot, ZOOM_MAX, ZOOM_MIN, apiLiveRefreshStorageKey, layoutInspectorStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!previewSettingsHydratedRef.current) return
    try {
      window.localStorage.setItem(previewSizeStorageKey, previewSize)
      window.localStorage.setItem(canvasZoomStorageKey, String(canvasZoom))
      window.localStorage.setItem(canvasExpandedStorageKey, canvasExpanded ? 'true' : 'false')
      window.localStorage.setItem(deviceFrameStorageKey, deviceFrameEnabled ? 'true' : 'false')
      window.localStorage.setItem(canvasColorStorageKey, canvasBgColor)
      window.localStorage.setItem(canvasMeshStorageKey, showCanvasMesh ? 'true' : 'false')
      window.localStorage.setItem(frameConfigStorageKey, JSON.stringify(frameConfigByCategory))
      window.localStorage.setItem(apiLiveRefreshStorageKey, apiLiveRefreshEnabled ? 'true' : 'false')
      window.localStorage.setItem(layoutInspectorStorageKey, showLayoutInspector ? 'true' : 'false')
      window.localStorage.setItem(previewSettingsKey, JSON.stringify({
        previewMode,
        previewSize,
        canvasZoom,
        canvasExpanded,
        previewTheme,
        deviceFrameEnabled,
        mobileAutoClosePalette,
        apiLiveRefreshEnabled,
        showLayoutInspector,
        canvasBgColor,
        showCanvasMesh,
        frameConfigByCategory,
      }))
    } catch {}
  }, [readPreviewCacheSnapshot, previewSettingsKey, previewSizeStorageKey, canvasZoomStorageKey, canvasExpandedStorageKey, deviceFrameStorageKey, canvasColorStorageKey, canvasMeshStorageKey, frameConfigStorageKey, apiLiveRefreshStorageKey, layoutInspectorStorageKey, previewMode, previewSize, canvasZoom, canvasExpanded, previewTheme, deviceFrameEnabled, mobileAutoClosePalette, apiLiveRefreshEnabled, showLayoutInspector, canvasBgColor, showCanvasMesh, frameConfigByCategory])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('dccortex:presence-mode', presenceMode)
    } catch {}
  }, [presenceMode])

  useEffect(() => {
    if (presenceMode === 'off') setPresence([])
  }, [presenceMode])

  useEffect(() => {
    if (typeof window === 'undefined' || editingReusableId) return
    try {
      const raw = window.localStorage.getItem(selectedNodeStorageKey)
      if (!raw) return
      setSelectedId(raw)
    } catch {}
  }, [selectedNodeStorageKey, editingReusableId])

  useEffect(() => {
    if (typeof window === 'undefined' || editingReusableId) return
    try {
      if (selectedId) window.localStorage.setItem(selectedNodeStorageKey, selectedId)
      else window.localStorage.removeItem(selectedNodeStorageKey)
    } catch {}
  }, [selectedNodeStorageKey, selectedId, editingReusableId])

  useEffect(() => {
    if (editingReusableId || !selectedId) return
    if (!findNode(root, selectedId)) setSelectedId(null)
  }, [root, selectedId, editingReusableId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (editingReusableId) {
        window.localStorage.setItem(reusableEditorStateStorageKey, JSON.stringify({
          reusableId: editingReusableId,
          selectedId: reusableSelectedId,
        }))
      } else {
        window.localStorage.removeItem(reusableEditorStateStorageKey)
      }
    } catch {}
  }, [reusableEditorStateStorageKey, editingReusableId, reusableSelectedId])

  useEffect(() => {
    if (reusableRestoreAttemptedRef.current) return
    if (typeof window === 'undefined') return
    if (editingReusableId) {
      reusableRestoreAttemptedRef.current = true
      return
    }
    try {
      const raw = window.localStorage.getItem(reusableEditorStateStorageKey)
      if (!raw) {
        reusableRestoreAttemptedRef.current = true
        return
      }
      if (globalReusables.length === 0) return
      const parsed = JSON.parse(raw) as { reusableId?: string; selectedId?: string | null }
      const reusableId = typeof parsed.reusableId === 'string' ? parsed.reusableId : null
      if (!reusableId) {
        window.localStorage.removeItem(reusableEditorStateStorageKey)
        reusableRestoreAttemptedRef.current = true
        return
      }
      const exists = globalReusables.some((r) => r.id === reusableId)
      if (!exists) {
        window.localStorage.removeItem(reusableEditorStateStorageKey)
        reusableRestoreAttemptedRef.current = true
        return
      }
      const target = globalReusables.find((r) => r.id === reusableId)
      if (!target) return
      setPreviewSize('freeform')
      setDeviceFrameEnabled(false)
      setEditingReusableId(reusableId)
      const cloned = deepCloneNode(target.root)
      setEditingReusableRoot(cloned)
      editingReusableRootRef.current = cloned
      const preferredSelected = parsed.selectedId ?? null
      const initialSelected = preferredSelected && findNode(cloned, preferredSelected) ? preferredSelected : cloned.id
      setReusableSelectedId(initialSelected)
      reusableUndoStackRef.current = []
      reusableRedoStackRef.current = []
      setUndoRedoVersion((v) => v + 1)
      reusableRestoreAttemptedRef.current = true
    } catch {
      reusableRestoreAttemptedRef.current = true
    setPreviewSettingsLoaded(true)
    }
  }, [reusableEditorStateStorageKey, globalReusables, editingReusableId])

  useEffect(() => {
    if (!editingReusableId || !editingReusableRoot || !reusableSelectedId) return
    if (!findNode(editingReusableRoot, reusableSelectedId)) {
      setReusableSelectedId(editingReusableRoot.id)
    }
  }, [editingReusableId, editingReusableRoot, reusableSelectedId])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  const projectGlobalsCacheKey = useMemo(() => `dccortex:project-globals:${projectId}`, [projectId])

  const base = `/api/projects/${projectId}/screens`
  const editPayloadUrl = `/api/projects/${projectId}/screens/${screenId}/edit-payload`
  const { data: editPayload, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['edit-payload', projectId, screenId],
    queryFn: async () => {
      const res = await axios.get(editPayloadUrl)
      return res.data
    },
    retry: false,
  })
  const data = editPayload ? { screen: editPayload.screen } : undefined
  const projectData = editPayload ? { project: editPayload.project } : undefined
  const { data: screensData } = useQuery({
    queryKey: ['screens', projectId],
    queryFn: async () => {
      const res = await axios.get(`/api/projects/${projectId}/screens`)
      return res.data
    },
    retry: false,
  })
  const { data: assetsData } = useQuery({
    queryKey: ['project-assets', projectId],
    queryFn: async () => {
      const res = await axios.get(`/api/projects/${projectId}/assets`)
      return res.data
    },
    enabled: !!projectId,
    retry: false,
    staleTime: 30000,
  })
  const projectAssets: { id: string; name: string; url: string; mimetype?: string }[] = assetsData?.assets ?? []

  // Fetch internal datasource to check real-time polling config
  const { data: dsListData } = useQuery({
    queryKey: ['datasources', projectId],
    queryFn: async () => {
      const res = await axios.get(`/api/projects/${projectId}/datasources`)
      return res.data
    },
    enabled: !!projectId,
    staleTime: 10000,
  })
  const internalDatasource = dsListData?.datasources?.[0]
  const realtimePollMs: number = internalDatasource?.realtimePollMs ?? 0
  const { data: apiSourceListData } = useQuery({
    queryKey: ['api-sources', projectId],
    queryFn: async () => {
      const res = await axios.get(`/api/projects/${projectId}/api-sources`)
      return res.data
    },
    enabled: !!projectId,
    staleTime: 10000,
  })
  const hasExternalApiSources = Array.isArray(apiSourceListData?.sources) && apiSourceListData.sources.length > 0
  const externalApiSourceNames = useMemo(
    () => (Array.isArray(apiSourceListData?.sources)
      ? apiSourceListData.sources.map((s: { name?: string }) => String(s?.name ?? '').trim()).filter(Boolean)
      : []),
    [apiSourceListData?.sources]
  )
  const runtimeResolvedSources = useMemo(
    () => Object.entries(runtimeData)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key]) => key),
    [runtimeData]
  )

  const screen = data?.screen
  useEffect(() => {
    setScriptsHydrated(false)
  }, [screenId])

  useEffect(() => {
    const raw = screen?.layout as Node | ScreenLayoutPayload | undefined
    if (!raw) return
    // client-side sanitize (same logic as server) to avoid crashing in preview
    const _sanitizeLog: string[] = []
    const sanitize = (val: unknown): unknown => {
      if (typeof val === 'string') {
        return val.replace(/([^\s]+?)\.toLowerCase\(\)/g,(m,g)=>{
          const expr = g.endsWith('?') ? g.slice(0,-1) : g
          _sanitizeLog.push(`AI wrote: "${m}" → fixed to: "String(${expr}||'').toLowerCase()"`)
          return `String(${expr}||'').toLowerCase()`
        });
      }
      if (Array.isArray(val)) return val.map(sanitize);
      if (val && typeof val === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k,v] of Object.entries(val as Record<string, unknown>)) {
          out[k] = sanitize(v);
        }
        return out;
      }
      return val;
    }
    // Log any sanitized expressions to the browser console once
    if (_sanitizeLog.length > 0) {
      console.warn(`%c⚠️ Cortex Sanitizer caught ${_sanitizeLog.length} unsafe expression(s) in screen layout:`, 'color:#f59e0b;font-weight:bold')
      _sanitizeLog.forEach(msg => console.warn('  ', msg))
    }
    const cleaned = sanitize(raw) as typeof raw
    if (cleaned && typeof cleaned === 'object' && 'root' in cleaned && (cleaned as ScreenLayoutPayload).root?.id) {
      const payload = cleaned as ScreenLayoutPayload
      setRoot(payload.root)
      undoStackRef.current = []
      redoStackRef.current = []
      setUndoRedoVersion((v) => v + 1)
      setStateDefinitions(Array.isArray(payload.stateDefinitions) ? payload.stateDefinitions : [])
      setDataSources(Array.isArray(payload.dataSources) ? payload.dataSources : [])
      setNamedScripts(payload.namedScripts && typeof payload.namedScripts === 'object' ? payload.namedScripts : {})
      setScriptsHydrated(true)
      if (payload.theme && typeof payload.theme === 'object') {
        setTheme({ ...DEFAULT_THEME, ...payload.theme })
      }
      if (payload.seoSettings && typeof payload.seoSettings === 'object') {
        setSeoSettings(payload.seoSettings as SeoSettings)
      }
      if (payload.presentation) {
        setScreenPresentation(payload.presentation)
        screenPresentationRef.current = payload.presentation
      }
      if (Array.isArray(payload.screenPropDefs)) {
        setScreenPropDefs(payload.screenPropDefs)
        screenPropDefsRef.current = payload.screenPropDefs
      }
      if (Array.isArray(payload.customTypes) && payload.customTypes.length > 0) {
        // Backward compat: per-screen customTypes used as initial fallback; globals override once loaded
        setCustomTypes(payload.customTypes)
        customTypesRef.current = payload.customTypes
      }
      if (payload.aiProtected != null) {
        setAiProtected(!!payload.aiProtected)
        aiProtectedRef.current = !!payload.aiProtected
      }
    } else if (raw && typeof raw === 'object' && 'id' in raw) {
      setRoot(raw as Node)
      undoStackRef.current = []
      redoStackRef.current = []
      setUndoRedoVersion((v) => v + 1)
      setScriptsHydrated(true)
    }
  }, [screen?.id])
  useEffect(() => {
    if (screen?.script != null) setScript(String(screen.script))
  }, [screen?.script])
  // Load globals: server is source of truth; localStorage is a fallback for offline / first paint
  useEffect(() => {
    if (!projectId) return
    axios.get(`/api/projects/${projectId}/globals`)
      .then((res) => {
        const raw = res.data?.globals
        if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
          const g = raw as Partial<BuilderGlobals>
          if (Array.isArray(g.globalReusables)) setGlobalReusables(g.globalReusables)
          if (Array.isArray(g.globalStateDefinitions)) setGlobalStateDefinitions(g.globalStateDefinitions)
          if (Array.isArray(g.globalCustomTypes)) { setCustomTypes(g.globalCustomTypes); customTypesRef.current = g.globalCustomTypes }
          if (g.globalTheme && typeof g.globalTheme === 'object') setGlobalTheme(g.globalTheme)
          // keep localStorage in sync for offline fallback
          try { localStorage.setItem(projectGlobalsCacheKey, JSON.stringify(raw)) } catch {}
          return
        }
        // Nothing on server yet — try localStorage and auto-migrate to server
        const cached = localStorage.getItem(projectGlobalsCacheKey)
        if (cached) {
          const parsed = JSON.parse(cached) as Partial<BuilderGlobals>
          const globals = { ...EMPTY_BUILDER_GLOBALS, ...(parsed ?? {}) }
          setGlobalReusables(Array.isArray(globals.globalReusables) ? globals.globalReusables : [])
          setGlobalStateDefinitions(Array.isArray(globals.globalStateDefinitions) ? globals.globalStateDefinitions : [])
          if (Array.isArray(globals.globalCustomTypes)) { setCustomTypes(globals.globalCustomTypes); customTypesRef.current = globals.globalCustomTypes }
          if (globals.globalTheme && typeof globals.globalTheme === 'object') setGlobalTheme(globals.globalTheme)
          // Auto-migrate: push localStorage globals to server so other devices can load them
          axios.put(`/api/projects/${projectId}/globals`, parsed).catch(() => {})
        }
      })
      .catch(() => {
        // Server unreachable — fall back to localStorage
        try {
          const cached = localStorage.getItem(projectGlobalsCacheKey)
          if (cached) {
            const parsed = JSON.parse(cached) as Partial<BuilderGlobals>
            const globals = { ...EMPTY_BUILDER_GLOBALS, ...(parsed ?? {}) }
            setGlobalReusables(Array.isArray(globals.globalReusables) ? globals.globalReusables : [])
            setGlobalStateDefinitions(Array.isArray(globals.globalStateDefinitions) ? globals.globalStateDefinitions : [])
            if (Array.isArray(globals.globalCustomTypes)) { setCustomTypes(globals.globalCustomTypes); customTypesRef.current = globals.globalCustomTypes }
            if (globals.globalTheme && typeof globals.globalTheme === 'object') setGlobalTheme(globals.globalTheme)
          }
        } catch {}
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Fetch from server and apply layout/script. Only on demand: initial load (via useQuery) + explicit Refresh button. No polling.
  const refreshFromServer = useCallback(async () => {
    if (!projectId || !screenId) return
    try {
      setRefreshing(true)
      const res = await axios.get(editPayloadUrl)
      const screen = res.data?.screen
      const raw = screen?.layout
      if (pendingLayoutSaveRef.current) return
      if (raw && typeof raw === 'object' && (raw as ScreenLayoutPayload).root?.id) {
        const payload = raw as ScreenLayoutPayload
        flushSync(() => {
          setRoot(payload.root)
          setStateDefinitions(Array.isArray(payload.stateDefinitions) ? payload.stateDefinitions : [])
          setDataSources(Array.isArray(payload.dataSources) ? payload.dataSources : [])
          setNamedScripts(payload.namedScripts && typeof payload.namedScripts === 'object' ? payload.namedScripts : {})
          setScriptsHydrated(true)
          if (payload.theme && typeof payload.theme === 'object') setTheme((t) => ({ ...t, ...payload.theme }))
          if (payload.seoSettings && typeof payload.seoSettings === 'object') setSeoSettings(payload.seoSettings as SeoSettings)
        })
        undoStackRef.current = []
        redoStackRef.current = []
        setUndoRedoVersion((v) => v + 1)
      } else if (raw && typeof raw === 'object' && 'id' in raw) {
        flushSync(() => setRoot(raw as Node))
        undoStackRef.current = []
        redoStackRef.current = []
        setUndoRedoVersion((v) => v + 1)
        setScriptsHydrated(true)
      }
      if (screen?.script != null) setScript(String(screen.script))
      // Also refresh globals from server
      try {
        const globalsRes = await axios.get(`/api/projects/${projectId}/globals`)
        const graw = globalsRes.data?.globals
        if (graw && typeof graw === 'object' && Object.keys(graw).length > 0) {
          const g = graw as Partial<BuilderGlobals>
          if (Array.isArray(g.globalReusables)) setGlobalReusables(g.globalReusables)
          if (Array.isArray(g.globalStateDefinitions)) setGlobalStateDefinitions(g.globalStateDefinitions)
          if (g.globalTheme && typeof g.globalTheme === 'object') setGlobalTheme(g.globalTheme)
          try { localStorage.setItem(projectGlobalsCacheKey, JSON.stringify(graw)) } catch {}
        }
      } catch {}
      setLastSyncedAt(Date.now())
      setSyncError(null)
      queryClient.invalidateQueries({ queryKey: ['edit-payload', projectId, screenId] })
    } catch (e: any) {
      const msg = e?.response?.status === 401 ? 'Not logged in' : e?.response?.status === 403 ? 'No access' : e?.message || 'Sync failed'
      setSyncError(msg)
    } finally {
      setRefreshing(false)
    }
  }, [projectId, screenId, editPayloadUrl, queryClient])

  const requestRefreshFromServer = useCallback((delayMs = REMOTE_REFRESH_DEBOUNCE_MS) => {
    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current)
      refreshDebounceRef.current = null
    }

    const run = async () => {
      if (refreshInFlightRef.current) {
        refreshQueuedRef.current = true
        return
      }
      refreshInFlightRef.current = true
      try {
        await refreshFromServer()
      } finally {
        refreshInFlightRef.current = false
        if (refreshQueuedRef.current) {
          refreshQueuedRef.current = false
          void refreshFromServer()
        }
      }
    }

    if (delayMs <= 0) {
      void run()
      return
    }
    refreshDebounceRef.current = setTimeout(() => {
      refreshDebounceRef.current = null
      void run()
    }, delayMs)
  }, [refreshFromServer])

  useEffect(() => {
    return () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current)
        refreshDebounceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const onCortexRefresh = () => {
      requestRefreshFromServer(0)
    }
    window.addEventListener('cortex:refresh', onCortexRefresh)
    return () => window.removeEventListener('cortex:refresh', onCortexRefresh)
  }, [requestRefreshFromServer])

  const patchMutation = useMutation({
    mutationFn: async (payload: { layout?: Node | ScreenLayoutPayload; script?: string }) => {
      await axios.patch(`${base}/${screenId}`, payload, {
        headers: { 'x-dcc-client-id': clientIdRef.current },
      })
    },
    onMutate: () => setSaveStatus('saving'),
    onSuccess: () => {
      setSaveStatus('saved')
      queryClient.invalidateQueries({ queryKey: ['edit-payload', projectId, screenId] })
      // Invalidate screens list so other screens' presentation/propDefs changes are visible immediately
      queryClient.invalidateQueries({ queryKey: ['screens', projectId] })
      setTimeout(() => setSaveStatus('idle'), 2000)
    },
    onSettled: (_data, _error, variables) => {
      if (variables?.layout != null) {
        pendingLayoutSaveRef.current = false
        if (pendingServerRefreshRef.current) {
          pendingServerRefreshRef.current = false
          requestRefreshFromServer(REMOTE_REFRESH_DEBOUNCE_MS)
        }
      }
    },
  })
  const saveGlobalsMutation = useMutation({
    mutationFn: async (builderGlobals: BuilderGlobals) => {
      // Store globals in the dedicated __globals__ AppScreen row — works on all deployments
      await axios.put(`/api/projects/${projectId}/globals`, builderGlobals, {
        headers: { 'x-dcc-client-id': clientIdRef.current },
      })
    },
  })

  const activeRoot = editingReusableRoot ?? root
  const activeSelectedId = editingReusableId ? reusableSelectedId : selectedId
  selectionIdRef.current = activeSelectedId
  const activeReusablePropsCtx = useMemo(() => {
    if (!editingReusableId || !editingReusableRoot) return undefined
    const ctx: Record<string, unknown> = {}
    const schema = collectReusablePropsSchema(editingReusableRoot)
    for (const entry of schema) {
      if (!entry.key) continue
      const rootValue = (editingReusableRoot.props as Record<string, unknown>)[entry.key]
      if (rootValue !== undefined) {
        ctx[entry.key] = rootValue
        continue
      }
      if (entry.defaultValue === undefined) continue
      if (entry.type === 'number') {
        const parsed = Number(entry.defaultValue)
        ctx[entry.key] = Number.isFinite(parsed) ? parsed : entry.defaultValue
      } else if (entry.type === 'boolean') {
        ctx[entry.key] = entry.defaultValue === 'true'
      } else {
        ctx[entry.key] = entry.defaultValue
      }
    }
    return ctx
  }, [editingReusableId, editingReusableRoot])
  const uniquePresence = useMemo(
    () => Array.from(new Map((presence || []).map((p) => [p.clientId ?? p.userId, p])).values()),
    [presence]
  )
  const selfPresence = useMemo(
    () => uniquePresence.find((p) => p.clientId === clientIdRef.current) ?? null,
    [uniquePresence]
  )
  const visibleCollaborators = useMemo(
    () => uniquePresence.filter((p) => p.clientId !== clientIdRef.current && p.userId !== selfPresence?.userId),
    [uniquePresence, selfPresence]
  )
  const visibleCursors = useMemo(
    () => visibleCollaborators.filter((p) => p.screenId === screenId && p.cursorX != null && p.cursorY != null),
    [visibleCollaborators, screenId]
  )
  const collaboratorsForDialog = useMemo(
    () => [...visibleCollaborators].sort((a, b) => {
      const aOnCurrent = a.screenId === screenId ? 1 : 0
      const bOnCurrent = b.screenId === screenId ? 1 : 0
      if (aOnCurrent !== bOnCurrent) return bOnCurrent - aOnCurrent
      return String(a.name || a.userId).localeCompare(String(b.name || b.userId))
    }),
    [visibleCollaborators, screenId]
  )
  const presenceSendingEnabled = previewSettingsLoaded && (presenceMode === 'slow' || (presenceMode === 'panel' && collaboratorsDialogOpen))
  const buildPresenceViewState = useCallback((): CollaboratorViewState => ({
    previewSize,
    deviceFrameEnabled,
    frameConfigByCategory,
    clientSentAt: Date.now(),
  }), [previewSize, deviceFrameEnabled, frameConfigByCategory])

  useEffect(() => {
    if (applyingRemoteViewStateRef.current) return
    lastLocalViewStateChangeAtRef.current = Date.now()
  }, [previewSize, deviceFrameEnabled, frameConfigByCategory])

  const postPresence = useCallback((overrides?: Partial<{ cursorX: number | null; cursorY: number | null; selectionId: string | null }>) => {
    if (!presenceSendingEnabled) return
    const payload = {
      selectionId: overrides?.selectionId ?? selectionIdRef.current,
      cursorX: overrides?.cursorX ?? cursorRef.current.x,
      cursorY: overrides?.cursorY ?? cursorRef.current.y,
      viewState: buildPresenceViewState(),
    }

    const send = (next: typeof payload) => {
      lastPresencePostAtRef.current = Date.now()
      axios.post(`/api/projects/${projectId}/presence`, {
        clientId: clientIdRef.current,
        screenId,
        ...next,
      }).catch(() => {})
    }

    const elapsed = Date.now() - lastPresencePostAtRef.current
    if (elapsed >= PRESENCE_POST_THROTTLE_MS) {
      send(payload)
      return
    }

    pendingPresencePayloadRef.current = payload
    if (presencePostTimeoutRef.current) return

    const waitMs = Math.max(PRESENCE_POST_THROTTLE_MS - elapsed, 0)
    presencePostTimeoutRef.current = setTimeout(() => {
      presencePostTimeoutRef.current = null
      const queued = pendingPresencePayloadRef.current
      pendingPresencePayloadRef.current = null
      if (!queued || !presenceSendingEnabled) return
      send(queued)
    }, waitMs)
  }, [presenceSendingEnabled, projectId, screenId, buildPresenceViewState])

  useEffect(() => {
    return () => {
      if (presencePostTimeoutRef.current) {
        clearTimeout(presencePostTimeoutRef.current)
        presencePostTimeoutRef.current = null
      }
      pendingPresencePayloadRef.current = null
    }
  }, [])
  const updateCursorPresence = useCallback((x: number | null, y: number | null) => {
    if (!presenceSendingEnabled) return
    cursorRef.current = { x, y }
    postPresence({ cursorX: x, cursorY: y })
  }, [presenceSendingEnabled, postPresence])
  const handleCanvasPointerMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const host = canvasViewportRef.current
    if (!host) return
    const rect = host.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = clamp01((e.clientX - rect.left) / rect.width)
    const y = clamp01((e.clientY - rect.top) / rect.height)
    const prev = cursorRef.current
    if (prev.x != null && prev.y != null && Math.abs(prev.x - x) < 0.01 && Math.abs(prev.y - y) < 0.01) return
    updateCursorPresence(x, y)
  }, [updateCursorPresence])
  const handleCanvasPointerLeave = useCallback(() => {
    if (cursorRef.current.x == null && cursorRef.current.y == null) return
    updateCursorPresence(null, null)
  }, [updateCursorPresence])

  useEffect(() => {
    if (!projectId || !screenId) return
    if (!previewSettingsLoaded) return

    const es = new EventSource(`/api/projects/${projectId}/sync`)
    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as {
          type?: string
          screenId?: string
          clientId?: string
          payload?: unknown
        }

        if (!msg?.type) return

        if (msg.type === 'presence') {
          const payload = Array.isArray(msg.payload) ? msg.payload : []
          setPresence(payload as CollaboratorPresence[])
          return
        }

        if (msg.clientId && msg.clientId === clientIdRef.current) return

        if (msg.type === 'globals' && msg.payload && typeof msg.payload === 'object') {
          const globals = { ...EMPTY_BUILDER_GLOBALS, ...(msg.payload as Partial<BuilderGlobals>) }
          setGlobalReusables(Array.isArray(globals.globalReusables) ? globals.globalReusables : [])
          setGlobalStateDefinitions(Array.isArray(globals.globalStateDefinitions) ? globals.globalStateDefinitions : [])
          if (Array.isArray(globals.globalCustomTypes)) {
            setCustomTypes(globals.globalCustomTypes)
            customTypesRef.current = globals.globalCustomTypes
          }
          if (globals.globalTheme && typeof globals.globalTheme === 'object') {
            setGlobalTheme(globals.globalTheme)
          }
          try {
            localStorage.setItem(projectGlobalsCacheKey, JSON.stringify(msg.payload))
          } catch {}
          setLastSyncedAt(Date.now())
          setSyncError(null)
          return
        }

        const changedCurrentScreen = msg.screenId && msg.screenId === screenId
        if (msg.type === 'layout' || msg.type === 'script') {
          if (!changedCurrentScreen) return
          if (pendingLayoutSaveRef.current) {
            pendingServerRefreshRef.current = true
            return
          }
          requestRefreshFromServer(REMOTE_REFRESH_DEBOUNCE_MS)
        }
      } catch {}
    }
    es.onerror = () => {
      setSyncError((prev) => prev ?? 'Realtime connection lost')
    }

    return () => es.close()
  }, [projectId, screenId, projectGlobalsCacheKey, requestRefreshFromServer, previewSettingsLoaded])

  useEffect(() => {
    if (!projectId || !screenId) return
    if (!previewSettingsLoaded) return
    if (!presenceSendingEnabled) return

    let stopped = false
    let heartbeat: ReturnType<typeof setInterval> | null = null
    const clientId = clientIdRef.current
    const heartbeatMs = presenceMode === 'slow' ? 60_000 : 15_000

    const pingPresence = async () => {
      try {
        const res = await axios.post(`/api/projects/${projectId}/presence`, {
          clientId,
          screenId,
          selectionId: selectionIdRef.current,
          cursorX: cursorRef.current.x,
          cursorY: cursorRef.current.y,
          viewState: buildPresenceViewState(),
        })
        if (stopped) return
        const next = Array.isArray(res.data?.presence) ? res.data.presence : []
        setPresence(next)
      } catch {
        // Presence failures should not block editing.
      }
    }

    pingPresence()
    heartbeat = setInterval(() => {
      pingPresence()
    }, heartbeatMs)

    return () => {
      stopped = true
      if (heartbeat) clearInterval(heartbeat)
      axios.delete(`/api/projects/${projectId}/presence`, { data: { clientId } }).catch(() => {})
    }
  }, [projectId, screenId, presenceSendingEnabled, presenceMode, buildPresenceViewState, previewSettingsLoaded])

  useEffect(() => {
    if (!presenceSendingEnabled) return
    const t = setTimeout(() => {
      postPresence()
    }, 120)
    return () => clearTimeout(t)
  }, [activeSelectedId, presenceSendingEnabled, postPresence])

  useEffect(() => {
    if (!presenceSendingEnabled) return
    const t = window.setTimeout(() => {
      postPresence()
    }, 100)
    return () => window.clearTimeout(t)
  }, [presenceSendingEnabled, postPresence, previewSize, deviceFrameEnabled, frameConfigByCategory])

  const lastAppliedRemoteViewAtRef = useRef(0)
  useEffect(() => {
    // Do not apply remote view sync until we can identify the current client/user.
    // This avoids stale presence from a previous tab/session overriding restored local settings.
    if (!selfPresence?.userId) return

    // Deterministic leader/follower rule prevents two-way ping-pong when multiple users
    // actively change viewport settings at the same time.
    const localClientId = clientIdRef.current
    const collaboratorClientIds = visibleCollaborators
      .map((p) => p.clientId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
    const allClientIds = Array.from(new Set([localClientId, ...collaboratorClientIds])).sort()
    const leaderClientId = allClientIds[0]
    if (!leaderClientId || leaderClientId === localClientId) return

    const candidates = visibleCollaborators
      .filter((p) => p.clientId === leaderClientId && p.screenId === screenId && p.viewState && typeof p.viewState === 'object')
      .map((p) => p.viewState as CollaboratorViewState)
      .filter((s) => typeof s.clientSentAt === 'number' && Number.isFinite(s.clientSentAt))

    if (!candidates.length) return
    const latest = candidates.sort((a, b) => (b.clientSentAt ?? 0) - (a.clientSentAt ?? 0))[0]
    const sentAt = latest.clientSentAt ?? 0
    if (sentAt <= lastAppliedRemoteViewAtRef.current) return
    if (Date.now() - lastLocalViewStateChangeAtRef.current < REMOTE_VIEW_APPLY_COOLDOWN_MS) return

    const nextPreviewSize = latest.previewSize === 'mobile' || latest.previewSize === 'tablet' || latest.previewSize === 'desktop' || latest.previewSize === 'freeform'
      ? latest.previewSize
      : null
    const normalizedFrames = latest.frameConfigByCategory
      ? {
          mobile: normalizeFrameConfig('mobile', latest.frameConfigByCategory.mobile),
          tablet: normalizeFrameConfig('tablet', latest.frameConfigByCategory.tablet),
          desktop: normalizeFrameConfig('desktop', latest.frameConfigByCategory.desktop),
        }
      : null
    const frameConfigChanged = normalizedFrames
      ? normalizedFrames.mobile.device !== frameConfigByCategory.mobile.device
        || normalizedFrames.mobile.color !== frameConfigByCategory.mobile.color
        || normalizedFrames.mobile.landscape !== frameConfigByCategory.mobile.landscape
        || normalizedFrames.tablet.device !== frameConfigByCategory.tablet.device
        || normalizedFrames.tablet.color !== frameConfigByCategory.tablet.color
        || normalizedFrames.tablet.landscape !== frameConfigByCategory.tablet.landscape
        || normalizedFrames.desktop.device !== frameConfigByCategory.desktop.device
        || normalizedFrames.desktop.color !== frameConfigByCategory.desktop.color
        || normalizedFrames.desktop.landscape !== frameConfigByCategory.desktop.landscape
      : false
    const previewChanged = nextPreviewSize != null ? nextPreviewSize !== previewSize : false
    const frameEnabledChanged = typeof latest.deviceFrameEnabled === 'boolean' ? latest.deviceFrameEnabled !== deviceFrameEnabled : false
    if (!previewChanged && !frameEnabledChanged && !frameConfigChanged) return

    lastAppliedRemoteViewAtRef.current = sentAt
    applyingRemoteViewStateRef.current = true

    if (nextPreviewSize != null) {
      setPreviewSize(nextPreviewSize)
    }
    if (typeof latest.deviceFrameEnabled === 'boolean') setDeviceFrameEnabled(latest.deviceFrameEnabled)
    if (normalizedFrames) {
      setFrameConfigByCategory(normalizedFrames)
    }
    window.setTimeout(() => {
      applyingRemoteViewStateRef.current = false
    }, 0)
  }, [visibleCollaborators, selfPresence, screenId, previewSize, deviceFrameEnabled, frameConfigByCategory, readPreviewCacheSnapshot])

  useEffect(() => {
    for (const painted of paintedSelectionsRef.current) {
      painted.el.style.outline = painted.outline
      painted.el.style.outlineOffset = painted.outlineOffset
      painted.el.style.boxShadow = painted.boxShadow
    }
    paintedSelectionsRef.current = []

    const remoteOnSameScreen = visibleCollaborators.filter((p) => p.screenId === screenId && p.selectionId)
    for (const collaborator of remoteOnSameScreen) {
      const targetId = collaborator.selectionId as string
      const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(targetId)
        : targetId.replace(/(["\\])/g, '\\$1')
      const el = document.querySelector(`[data-node-id="${escaped}"]`) as HTMLElement | null
      if (!el) continue
      paintedSelectionsRef.current.push({
        el,
        outline: el.style.outline,
        outlineOffset: el.style.outlineOffset,
        boxShadow: el.style.boxShadow,
      })
      const color = colorForPresence(collaborator.clientId || collaborator.userId)
      el.style.outline = `2px solid ${color}`
      el.style.outlineOffset = '2px'
      el.style.boxShadow = `0 0 0 1px ${color}33`
    }

    return () => {
      for (const painted of paintedSelectionsRef.current) {
        painted.el.style.outline = painted.outline
        painted.el.style.outlineOffset = painted.outlineOffset
        painted.el.style.boxShadow = painted.boxShadow
      }
      paintedSelectionsRef.current = []
    }
  }, [visibleCollaborators, screenId, root, activeRoot])

  const persistGlobals = useCallback((next: Partial<BuilderGlobals>) => {
    const payload: BuilderGlobals = {
      globalReusables,
      globalStateDefinitions,
      globalCustomTypes: customTypesRef.current,
      globalTheme,
      ...next,
    }
    try {
      localStorage.setItem(projectGlobalsCacheKey, JSON.stringify(payload))
    } catch {}
    saveGlobalsMutation.mutate(payload)
  }, [globalReusables, globalStateDefinitions, globalTheme, saveGlobalsMutation, projectGlobalsCacheKey])

  const persistEditingReusableRoot = useCallback((nextRoot: Node) => {
    if (!editingReusableId) return
    // Push current reusable root onto undo stack before applying the change
    if (editingReusableRootRef.current) {
      reusableUndoStackRef.current = [...reusableUndoStackRef.current.slice(-99), editingReusableRootRef.current]
      reusableRedoStackRef.current = []
      setUndoRedoVersion((v) => v + 1)
    }
    setEditingReusableRoot(nextRoot)
    editingReusableRootRef.current = nextRoot
    // Recompute propsSchema from all __propContract entries in the reusable tree.
    const propsSchema = collectReusablePropsSchema(nextRoot)
    const nextReusables = globalReusables.map((r) =>
      r.id === editingReusableId ? { ...r, root: deepCloneNode(nextRoot), propsSchema, updatedAt: new Date().toISOString() } : r
    )
    setGlobalReusables(nextReusables)
    persistGlobals({ globalReusables: nextReusables })
  }, [editingReusableId, globalReusables, persistGlobals])

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<Node>(root)
  rootRef.current = root
  editingReusableRootRef.current = editingReusableRoot

  const persistLayoutSnapshot = useCallback((nextScript?: string) => {
    pendingLayoutSaveRef.current = true
    patchMutation.mutate({
      layout: {
        root: rootRef.current,
        stateDefinitions: stateDefinitionsRef.current,
        dataSources: dataSourcesRef.current,
        namedScripts: namedScriptsRef.current,
        theme: themeRef.current,
        seoSettings: seoRef.current,
        presentation: screenPresentationRef.current,
        screenPropDefs: screenPropDefsRef.current,
        customTypes: customTypesRef.current,
        aiProtected: aiProtectedRef.current,
      },
      ...(nextScript !== undefined ? { script: nextScript } : {}),
    })
  }, [patchMutation])

  const scheduleLayoutPersist = useCallback((delayMs = 1500) => {
    pendingLayoutSaveRef.current = true
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    if (delayMs <= 0) {
      persistLayoutSnapshot()
      return
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null
      persistLayoutSnapshot()
    }, delayMs)
  }, [persistLayoutSnapshot])

  const handleSave = useCallback(() => {
    if (editingReusableId && editingReusableRootRef.current) {
      persistEditingReusableRoot(editingReusableRootRef.current)
      return
    }
    persistLayoutSnapshot(script)
  }, [editingReusableId, script, persistEditingReusableRoot, persistLayoutSnapshot])

  const commitLayoutChange = useCallback((newRoot: Node, trackHistory = true) => {
    if (trackHistory) {
      undoStackRef.current = [...undoStackRef.current.slice(-99), rootRef.current]
      redoStackRef.current = []
      setUndoRedoVersion((v) => v + 1)
    }
    flushSync(() => {
      setRoot(newRoot)
      rootRef.current = newRoot
    })
    scheduleLayoutPersist(1500)
  }, [scheduleLayoutPersist])

  const handleLayoutChange = useCallback((newRoot: Node) => {
    commitLayoutChange(newRoot, true)
  }, [commitLayoutChange])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const selectedNode = activeSelectedId ? findNode(activeRoot, activeSelectedId) : null
  const selectedLayoutSummary = useMemo(() => {
    if (!selectedNode) return null
    const p = selectedNode.props ?? {}
    const format = (v: unknown, fallback = '-') => {
      if (v == null) return fallback
      const s = String(v).trim()
      return s.length ? s : fallback
    }
    return {
      display: format((p as any).display, selectedNode.type === 'container' ? 'flex' : '-'),
      direction: format((p as any).flexDirection),
      gap: format((p as any).gap),
      padding: format((p as any).padding),
      margin: format((p as any).margin),
      width: format((p as any).width, 'auto'),
      height: format((p as any).height, 'auto'),
    }
  }, [selectedNode])

  useEffect(() => {
    if (previewMode || !showLayoutInspector || !activeSelectedId) {
      setLayoutGuideRect(null)
      return
    }
    const host = layoutOverlayHostRef.current
    if (!host) {
      setLayoutGuideRect(null)
      return
    }

    let raf = 0
    const updateRect = () => {
      const el = host.querySelector(`[data-node-id="${activeSelectedId}"]`) as HTMLElement | null
      if (!el) {
        setLayoutGuideRect(null)
        return
      }
      const hostRect = host.getBoundingClientRect()
      const rect = el.getBoundingClientRect()
      setLayoutGuideRect({
        left: rect.left - hostRect.left + host.scrollLeft,
        top: rect.top - hostRect.top + host.scrollTop,
        width: rect.width,
        height: rect.height,
      })
    }
    const requestUpdate = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(updateRect)
    }

    requestUpdate()
    host.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    const ro = new ResizeObserver(() => requestUpdate())
    ro.observe(host)
    const selectedEl = host.querySelector(`[data-node-id="${activeSelectedId}"]`) as HTMLElement | null
    if (selectedEl) ro.observe(selectedEl)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      host.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      ro.disconnect()
    }
  }, [previewMode, showLayoutInspector, activeSelectedId, activeRoot, canvasZoom, previewSize])
  const parentPropSchema = useMemo((): { key: string; type: 'string' | 'number' | 'boolean'; required?: boolean }[] => {
    const mergeByKey = (
      primary: { key: string; type: 'string' | 'number' | 'boolean'; required?: boolean }[],
      fallback: { key: string; type: 'string' | 'number' | 'boolean'; required?: boolean }[]
    ) => {
      const map = new Map<string, { key: string; type: 'string' | 'number' | 'boolean'; required?: boolean }>()
      for (const item of fallback) map.set(item.key, item)
      for (const item of primary) map.set(item.key, item)
      return Array.from(map.values())
    }

    const liveContract = activeSelectedId ? (findContainingPropContract(activeRoot, activeSelectedId) ?? []) : []

    if (editingReusableId) {
      const savedSchema = globalReusables.find((r) => r.id === editingReusableId)?.propsSchema ?? []
      if (liveContract.length > 0) return mergeByKey(liveContract, savedSchema)
      return savedSchema
    }
    if (!activeSelectedId) return []
    const containingId = findContainingReusableId(activeRoot, activeSelectedId)
    if (containingId) {
      const savedSchema = globalReusables.find((r) => r.id === containingId)?.propsSchema ?? []
      if (liveContract.length > 0) return mergeByKey(liveContract, savedSchema)
      return savedSchema
    }
    return liveContract
  }, [editingReusableId, activeSelectedId, activeRoot, globalReusables])
  const handlePropChange = useCallback(
    (props: Record<string, unknown>) => {
      if (!activeSelectedId) return
      const currentRoot = editingReusableId ? (editingReusableRootRef.current ?? rootRef.current) : rootRef.current
      const nextRoot = updateNodeInTree(currentRoot, activeSelectedId, (n) => ({ ...n, props }))
      if (editingReusableId) persistEditingReusableRoot(nextRoot)
      else commitLayoutChange(nextRoot, true)
    },
    [activeSelectedId, editingReusableId, persistEditingReusableRoot, commitLayoutChange]
  )

  const handleWrapSelectedWithSuspense = useCallback(() => {
    if (!activeSelectedId) return
    const currentRoot = editingReusableId ? (editingReusableRootRef.current ?? rootRef.current) : rootRef.current
    const targetNode = findNode(currentRoot, activeSelectedId)
    if (!targetNode) return

    if (targetNode.type === 'suspense') {
      const nextRoot = updateNodeInTree(currentRoot, targetNode.id, (n) => ({
        ...n,
        props: {
          ...n.props,
          suspenseEnabled: true,
          suspenseSmart: n.props.suspenseSmart ?? true,
          suspenseVariant: n.props.suspenseVariant ?? 'skeleton',
        },
      }))
      if (editingReusableId) persistEditingReusableRoot(nextRoot)
      else commitLayoutChange(nextRoot, true)
      return
    }

    const suspenseNode = createNode('suspense')
    suspenseNode.props = {
      ...suspenseNode.props,
      suspenseEnabled: true,
      suspenseSmart: true,
      suspenseVariant: 'skeleton',
    }
    suspenseNode.children = [targetNode]

    const nextRoot = replaceNodeInTree(currentRoot, activeSelectedId, suspenseNode)
    if (editingReusableId) {
      persistEditingReusableRoot(nextRoot)
      setReusableSelectedId(suspenseNode.id)
    } else {
      commitLayoutChange(nextRoot, true)
      setSelectedId(suspenseNode.id)
    }
    pushEditorNotice('success', 'Wrapped component in Suspense.')
  }, [activeSelectedId, editingReusableId, persistEditingReusableRoot, commitLayoutChange, pushEditorNotice])

  const handleDeleteNode = useCallback((id: string) => {
    const currentRoot = editingReusableId ? (editingReusableRootRef.current ?? rootRef.current) : rootRef.current
    if (id === currentRoot.id) return
    const nextRoot = deleteNodeInTree(currentRoot, id)
    if (editingReusableId) {
      persistEditingReusableRoot(nextRoot)
      if (reusableSelectedId === id) setReusableSelectedId(null)
      return
    }
    commitLayoutChange(nextRoot, true)
    if (selectedId === id) setSelectedId(null)
  }, [editingReusableId, reusableSelectedId, selectedId, persistEditingReusableRoot, commitLayoutChange])

  const handleMoveNode = useCallback((nodeId: string, targetParentId: string, index: number) => {
    const currentRoot = editingReusableId ? (editingReusableRootRef.current ?? rootRef.current) : rootRef.current
    let nextRoot = moveNodeInTree(currentRoot, nodeId, targetParentId, index)
    // Auto-flex: if target parent is a row-flex container and moved node is a layout block,
    // set flex:1 so it fills the available space (mirrors addChild behaviour)
    const targetParent = findNode(nextRoot, targetParentId)
    const movedNode = findNode(nextRoot, nodeId)
    const ROW_FLEX_TYPES = ['header', 'footer', 'nav', 'stackH']
    const EXPANDABLE = ['container', 'section', 'stackV', 'stackH', 'main', 'aside', 'article', 'reusableInstance']
    if (targetParent && movedNode) {
      const parentFd = String((targetParent.props as Record<string, unknown>)?.flexDirection ?? '').trim()
      const isRowParent = ROW_FLEX_TYPES.includes(targetParent.type) || parentFd === 'row'
      const existingFlex = String((movedNode.props as Record<string, unknown>)?.flex ?? '').trim()
      const existingWidth = String((movedNode.props as Record<string, unknown>)?.width ?? '').trim()
      if (isRowParent && EXPANDABLE.includes(movedNode.type) && !existingFlex && !existingWidth) {
        nextRoot = replaceNodeInTree(nextRoot, nodeId, { ...movedNode, props: { ...movedNode.props, flex: '1' } })
      }
    }
    if (editingReusableId) persistEditingReusableRoot(nextRoot)
    else commitLayoutChange(nextRoot, true)
  }, [editingReusableId, persistEditingReusableRoot, commitLayoutChange])

  const handleQuickAddComponent = useCallback((type: string) => {
    const currentRoot = editingReusableId ? (editingReusableRootRef.current ?? rootRef.current) : rootRef.current
    const activeSelected = editingReusableId ? reusableSelectedId : selectedId

    const resolveInsertParentId = (): string => {
      if (!activeSelected) return currentRoot.id
      const path = getPathToNode(currentRoot, activeSelected)
      if (!path || path.length === 0) return currentRoot.id
      const nearestContainer = [...path].reverse().find((n) => !!getComponentDef(n.type)?.allowsChildren)
      return nearestContainer?.id ?? currentRoot.id
    }

    const parentId = resolveInsertParentId()
    const child = createNode(type)
    if (type === 'reusableInstance') {
      child.props.reusableId = ''
      child.props.reusableProps = {}
    }
    const nextRoot = insertNodeIntoParent(currentRoot, parentId, child)
    if (editingReusableId) {
      persistEditingReusableRoot(nextRoot)
      setReusableSelectedId(child.id)
    } else {
      commitLayoutChange(nextRoot, true)
      setSelectedId(child.id)
    }
  }, [editingReusableId, reusableSelectedId, selectedId, persistEditingReusableRoot, commitLayoutChange])

  const handlePanelWidthsChange = useCallback(() => {
    if (canvasStageRef.current) {
      const rect = canvasStageRef.current.getBoundingClientRect()
      const parent = canvasStageRef.current.parentElement
      const width = rect.width || canvasStageRef.current.clientWidth || parent?.clientWidth || window.innerWidth || 1
      const height = rect.height || canvasStageRef.current.clientHeight || parent?.clientHeight || window.innerHeight || 1
      setCanvasStageSize({ width, height })
      const fit = Math.min(width / fitLogicalSize.width, height / fitLogicalSize.height, 1)
      setCanvasFitScale(Number.isFinite(fit) && fit > 0 ? fit : 1)
      setPanelWidthsVersion((v) => v + 1)
    }
  }, [fitLogicalSize.width, fitLogicalSize.height])

  useEffect(() => {
    const rafA = requestAnimationFrame(handlePanelWidthsChange)
    const rafB = requestAnimationFrame(() => requestAnimationFrame(handlePanelWidthsChange))
    return () => {
      cancelAnimationFrame(rafA)
      cancelAnimationFrame(rafB)
    }
  }, [handlePanelWidthsChange, canvasExpanded, previewMode])

  const handleThemeChange = useCallback((updates: Partial<ScreenTheme>) => {
    setTheme((t) => {
      const next = { ...t, ...updates }
      themeRef.current = next
      scheduleLayoutPersist(1500)
      return next
    })
  }, [scheduleLayoutPersist])

  const handleSeoChange = useCallback((updates: Partial<SeoSettings>) => {
    setSeoSettings((s) => {
      const next = { ...s, ...updates }
      seoRef.current = next
      scheduleLayoutPersist(1500)
      return next
    })
  }, [scheduleLayoutPersist])

  const handlePresentationChange = useCallback((p: 'page' | 'modal') => {
    setScreenPresentation(p)
    screenPresentationRef.current = p
    persistLayoutSnapshot()
  }, [persistLayoutSnapshot])

  const handleScreenPropDefsChange = useCallback((defs: { name: string; type: string; defaultValue?: string }[]) => {
    setScreenPropDefs(defs)
    screenPropDefsRef.current = defs
    persistLayoutSnapshot()
  }, [persistLayoutSnapshot])

  const handleCustomTypesChange = useCallback((types: CustomTypeDef[]) => {
    // Validate: strip empty names, deduplicate, ensure field names are non-empty
    const seen = new Set<string>()
    const validated = types.filter((ct) => {
      const name = ct.name.trim()
      if (!name) return false
      if (seen.has(name)) return false
      seen.add(name)
      return true
    }).map((ct) => ({
      ...ct,
      name: ct.name.trim(),
      fields: ct.fields.filter((f) => f.name.trim()).map((f) => ({ ...f, name: f.name.trim() })),
    }))
    setCustomTypes(validated)
    customTypesRef.current = validated
    // Save to project-level globals so all screens share the same custom types
    persistGlobals({ globalCustomTypes: validated })
  }, [persistGlobals])

  const copySelected = useCallback(() => {
    const id = editingReusableId ? reusableSelectedId : selectedId
    const currentRoot = editingReusableId ? (editingReusableRootRef.current ?? rootRef.current) : rootRef.current
    if (!id) return
    const node = findNode(currentRoot, id)
    if (!node || node.id === currentRoot.id) return
    setClipboardNode(deepCloneNode(node))
  }, [editingReusableId, reusableSelectedId, selectedId])

  const pasteClipboard = useCallback(() => {
    if (!clipboardNode) return
    const id = editingReusableId ? reusableSelectedId : selectedId
    const currentRoot = editingReusableId ? (editingReusableRootRef.current ?? rootRef.current) : rootRef.current
    const candidateParent = id ? findNode(currentRoot, id) : null
    const parentId =
      candidateParent && getComponentDef(candidateParent.type)?.allowsChildren
        ? candidateParent.id
        : currentRoot.id
    const pasted = cloneNodeWithFreshIds(clipboardNode)
    const nextRoot = insertNodeIntoParent(currentRoot, parentId, pasted)
    if (editingReusableId) {
      persistEditingReusableRoot(nextRoot)
      setReusableSelectedId(pasted.id)
    } else {
      commitLayoutChange(nextRoot, true)
      setSelectedId(pasted.id)
    }
  }, [clipboardNode, editingReusableId, reusableSelectedId, selectedId, persistEditingReusableRoot, commitLayoutChange])

  const duplicateSelected = useCallback(() => {
    const id = editingReusableId ? reusableSelectedId : selectedId
    const currentRoot = editingReusableId ? (editingReusableRootRef.current ?? rootRef.current) : rootRef.current
    if (!id) return
    const source = findNode(currentRoot, id)
    if (!source || source.id === currentRoot.id) return
    const parentId = findParentId(currentRoot, id) ?? currentRoot.id
    const dup = cloneNodeWithFreshIds(source)
    const nextRoot = insertNodeIntoParent(currentRoot, parentId, dup)
    if (editingReusableId) {
      persistEditingReusableRoot(nextRoot)
      setReusableSelectedId(dup.id)
    } else {
      commitLayoutChange(nextRoot, true)
      setSelectedId(dup.id)
    }
  }, [editingReusableId, reusableSelectedId, selectedId, persistEditingReusableRoot, commitLayoutChange])

  const undo = useCallback(() => {
    if (editingReusableId) {
      if (!reusableUndoStackRef.current.length) return
      const previous = reusableUndoStackRef.current[reusableUndoStackRef.current.length - 1]
      reusableUndoStackRef.current = reusableUndoStackRef.current.slice(0, -1)
      reusableRedoStackRef.current = [...reusableRedoStackRef.current, editingReusableRootRef.current!]
      setUndoRedoVersion((v) => v + 1)
      // Apply without pushing to undo stack again — pass through the setter directly
      setEditingReusableRoot(previous)
      editingReusableRootRef.current = previous
      // Sync to globals
      const propsSchema = collectReusablePropsSchema(previous)
      const nextReusables = globalReusables.map((r) =>
        r.id === editingReusableId ? { ...r, root: deepCloneNode(previous), propsSchema, updatedAt: new Date().toISOString() } : r
      )
      setGlobalReusables(nextReusables)
      persistGlobals({ globalReusables: nextReusables })
      return
    }
    if (!undoStackRef.current.length) return
    const previous = undoStackRef.current[undoStackRef.current.length - 1]
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    redoStackRef.current = [...redoStackRef.current, rootRef.current]
    setUndoRedoVersion((v) => v + 1)
    commitLayoutChange(previous, false)
  }, [commitLayoutChange, editingReusableId, globalReusables, persistGlobals])

  const redo = useCallback(() => {
    if (editingReusableId) {
      if (!reusableRedoStackRef.current.length) return
      const next = reusableRedoStackRef.current[reusableRedoStackRef.current.length - 1]
      reusableRedoStackRef.current = reusableRedoStackRef.current.slice(0, -1)
      reusableUndoStackRef.current = [...reusableUndoStackRef.current, editingReusableRootRef.current!]
      setUndoRedoVersion((v) => v + 1)
      setEditingReusableRoot(next)
      editingReusableRootRef.current = next
      const propsSchema = collectReusablePropsSchema(next)
      const nextReusables = globalReusables.map((r) =>
        r.id === editingReusableId ? { ...r, root: deepCloneNode(next), propsSchema, updatedAt: new Date().toISOString() } : r
      )
      setGlobalReusables(nextReusables)
      persistGlobals({ globalReusables: nextReusables })
      return
    }
    if (!redoStackRef.current.length) return
    const next = redoStackRef.current[redoStackRef.current.length - 1]
    redoStackRef.current = redoStackRef.current.slice(0, -1)
    undoStackRef.current = [...undoStackRef.current, rootRef.current]
    setUndoRedoVersion((v) => v + 1)
    commitLayoutChange(next, false)
  }, [commitLayoutChange, editingReusableId, globalReusables, persistGlobals])

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = String(target.tagName ?? '').toLowerCase()
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (previewMode || isTypingTarget(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      const key = String(e.key ?? '').toLowerCase()
      const currentRoot = editingReusableId ? (editingReusableRootRef.current ?? rootRef.current) : rootRef.current
      const currentSelected = editingReusableId ? reusableSelectedId : selectedId
      if (!mod) {
        if (key === 'delete' || key === 'backspace') {
          if (currentSelected && currentSelected !== currentRoot.id) {
            e.preventDefault()
            handleDeleteNode(currentSelected)
          }
        }
        return
      }
      if (key === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
        return
      }
      if (key === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if (key === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (key === 'c') {
        e.preventDefault()
        copySelected()
        return
      }
      if (key === 'v') {
        e.preventDefault()
        pasteClipboard()
        return
      }
      if (key === 'd') {
        e.preventDefault()
        duplicateSelected()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewMode, editingReusableId, reusableSelectedId, selectedId, handleDeleteNode, undo, redo, copySelected, pasteClipboard, duplicateSelected])

  const handleCreateReusableFromNode = useCallback(
    (nodeId: string) => {
      const currentRoot = editingReusableId ? (editingReusableRoot ?? rootRef.current) : rootRef.current
      const picked = findNode(currentRoot, nodeId)
      if (!picked || picked.id === currentRoot.id) return
      const referencedStateKeys = collectStateRefs(picked)
      const existingGlobal = new Set(globalStateDefinitions.map((s) => s.name.trim()).filter(Boolean))
      const sourceByName = new Map(
        stateDefinitions
          .filter((s) => s.name.trim())
          .map((s) => [s.name.trim(), s] as const)
      )
      const promoted = referencedStateKeys
        .filter((key) => !existingGlobal.has(key))
        .map((key) => {
          const source = sourceByName.get(key)
          return {
            id: `global-state-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: key,
            initialValue: source?.initialValue ?? '',
            type: source?.type ?? 'string',
          } satisfies StateDefinition
        })
      const propsSchema = collectReusablePropsSchema(picked)
      const nextReusable: ReusableDefinition = {
        id: `reusable-${Date.now()}`,
        name: `${picked.type}-${Date.now().toString().slice(-4)}`,
        root: deepCloneNode(picked),
        propsSchema,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const nextReusables = [...globalReusables, nextReusable]
      const nextGlobalState = promoted.length ? [...globalStateDefinitions, ...promoted] : globalStateDefinitions

      const instanceNode: Node = {
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'reusableInstance',
        props: { reusableId: nextReusable.id, reusableProps: {} },
        children: [],
      }

      if (editingReusableId) {
        const nextRoot = replaceNodeInTree(currentRoot, nodeId, instanceNode)
        // Push current reusable root onto undo stack
        if (editingReusableRootRef.current) {
          reusableUndoStackRef.current = [...reusableUndoStackRef.current.slice(-99), editingReusableRootRef.current]
          reusableRedoStackRef.current = []
          setUndoRedoVersion((v) => v + 1)
        }
        setEditingReusableRoot(nextRoot)
        editingReusableRootRef.current = nextRoot
        // IMPORTANT: update the parent reusable root within nextReusables (which already includes
        // the new sub-reusable). Do NOT call persistEditingReusableRoot here — it has a stale
        // globalReusables closure and would overwrite nextReusables, losing the sub-reusable.
        const parentPropsSchema = collectReusablePropsSchema(nextRoot)
        const finalReusables = nextReusables.map((r) =>
          r.id === editingReusableId
            ? { ...r, root: deepCloneNode(nextRoot), propsSchema: parentPropsSchema, updatedAt: new Date().toISOString() }
            : r
        )
        setGlobalReusables(finalReusables)
        if (promoted.length) setGlobalStateDefinitions(nextGlobalState)
        persistGlobals({ globalReusables: finalReusables, globalStateDefinitions: nextGlobalState })
        setReusableSelectedId(instanceNode.id)
      } else {
        setGlobalReusables(nextReusables)
        if (promoted.length) setGlobalStateDefinitions(nextGlobalState)
        persistGlobals({ globalReusables: nextReusables, globalStateDefinitions: nextGlobalState })
        setRoot((prevRoot) => {
          const next = replaceNodeInTree(prevRoot, nodeId, instanceNode)
          rootRef.current = next
          return next
        })
        setSelectedId(instanceNode.id)
        undoStackRef.current = [...undoStackRef.current.slice(-99), currentRoot]
        redoStackRef.current = []
        scheduleLayoutPersist(1500)
      }
    },
    [
      editingReusableId,
      editingReusableRoot,
      globalReusables,
      globalStateDefinitions,
      persistGlobals,
      scheduleLayoutPersist,
    ]
  )

  type PendingInsert = { reusableId: string; schema: import('@/components/builder/globals').ReusableDefinition['propsSchema']; vals: Record<string, string> }
  const [pendingInsert, setPendingInsert] = useState<PendingInsert | null>(null)
  const [bindingForInsertProp, setBindingForInsertProp] = useState<string | null>(null)

  const doInsertReusable = useCallback(
    (reusableId: string, reusableProps: Record<string, unknown>) => {
      const inserted: Node = {
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'reusableInstance',
        props: { reusableId, reusableProps },
        children: [],
      }
      const currentRoot = editingReusableId ? (editingReusableRootRef.current ?? rootRef.current) : rootRef.current
      const nextRoot = insertNodeIntoParent(currentRoot, currentRoot.id, inserted)
      if (editingReusableId) {
        persistEditingReusableRoot(nextRoot)
        setReusableSelectedId(inserted.id)
      } else {
        commitLayoutChange(nextRoot, true)
        setSelectedId(inserted.id)
      }
    },
    [editingReusableId, commitLayoutChange, persistEditingReusableRoot]
  )

  const handleInsertReusable = useCallback(
    (reusableId: string) => {
      const reusable = globalReusables.find((r) => r.id === reusableId)
      const schema = reusable?.propsSchema ?? []
      const hasRequired = schema.some((e) => e.required)
      if (schema.length > 0 && hasRequired) {
        const vals: Record<string, string> = {}
        schema.forEach((e) => { vals[e.key] = e.defaultValue ?? '' })
        setPendingInsert({ reusableId, schema, vals })
      } else {
        // No required props — insert immediately with defaults; fill optionals later via Property Panel
        const defaultProps: Record<string, unknown> = {}
        schema.forEach((e) => {
          if (e.defaultValue != null && e.defaultValue !== '') {
            defaultProps[e.key] = e.type === 'number' ? Number(e.defaultValue) : e.type === 'boolean' ? e.defaultValue === 'true' : e.defaultValue
          }
        })
        doInsertReusable(reusableId, defaultProps)
      }
    },
    [globalReusables, doInsertReusable]
  )

  const importOrgReusableIntoProject = useCallback(async (
    orgReusable: OrgResourceCatalog['reusables']['organization'][number],
    insertNow: boolean
  ) => {
    if (!orgReusable || !orgReusable.id || !orgReusable.name || !orgReusable.root || typeof orgReusable.root !== 'object') {
      pushEditorNotice('error', 'Reusable payload is invalid and cannot be imported.')
      return
    }

    if (importingOrgReusableIds.includes(orgReusable.id)) return
    setImportingOrgReusableIds((prev) => (prev.includes(orgReusable.id) ? prev : [...prev, orgReusable.id]))

    try {
      const existing = globalReusables.find((r) => r.id === orgReusable.id)
      if (!existing) {
        const importedReusable: ReusableDefinition = {
          id: orgReusable.id,
          name: orgReusable.name,
          root: deepCloneNode(orgReusable.root as Node),
          propsSchema: Array.isArray(orgReusable.propsSchema)
            ? (orgReusable.propsSchema as ReusableDefinition['propsSchema'])
            : undefined,
          createdAt: orgReusable.createdAt,
          updatedAt: orgReusable.updatedAt,
        }
        const nextReusables = [...globalReusables, importedReusable]
        setGlobalReusables(nextReusables)
        persistGlobals({ globalReusables: nextReusables })
      }

      if (insertNow) {
        handleInsertReusable(orgReusable.id)
      }
      pushEditorNotice('success', insertNow
        ? `Imported and inserted reusable "${orgReusable.name}".`
        : `Imported reusable "${orgReusable.name}" into this project.`)
    } catch (err: any) {
      const msg = err?.message || 'Failed to import reusable'
      pushEditorNotice('error', msg)
    } finally {
      setImportingOrgReusableIds((prev) => prev.filter((id) => id !== orgReusable.id))
    }
  }, [globalReusables, handleInsertReusable, persistGlobals, pushEditorNotice, importingOrgReusableIds])

  const startEditingReusable = useCallback((reusableId: string, preferredSelectedId?: string | null) => {
    const target = globalReusables.find((r) => r.id === reusableId)
    if (!target) return
    // Source editing should always open in freeform without device frame chrome.
    setPreviewSize('freeform')
    setDeviceFrameEnabled(false)
    setEditingReusableId(reusableId)
    const cloned = deepCloneNode(target.root)
    setEditingReusableRoot(cloned)
    editingReusableRootRef.current = cloned
    const initialSelected = preferredSelectedId && findNode(cloned, preferredSelectedId) ? preferredSelectedId : cloned.id
    setReusableSelectedId(initialSelected)
    reusableUndoStackRef.current = []
    reusableRedoStackRef.current = []
    setUndoRedoVersion((v) => v + 1)
  }, [globalReusables])

  const stopEditingReusable = useCallback(() => {
    setEditingReusableId(null)
    setEditingReusableRoot(null)
    editingReusableRootRef.current = null
    setReusableSelectedId(null)
    reusableUndoStackRef.current = []
    reusableRedoStackRef.current = []
    setUndoRedoVersion((v) => v + 1)
  }, [])

  const handleDeleteReusable = useCallback(
    (reusableId: string) => {
      if (!confirm('Remove this global reusable? Instances on the canvas will show as missing until replaced or removed.')) return
      const nextReusables = globalReusables.filter((r) => r.id !== reusableId)
      setGlobalReusables(nextReusables)
      persistGlobals({ globalReusables: nextReusables })
      if (editingReusableId === reusableId) stopEditingReusable()
    },
    [globalReusables, editingReusableId, persistGlobals, stopEditingReusable]
  )

  const effectiveStateDefinitions = useMemo(
    () => upsertByName(stateDefinitions, globalStateDefinitions),
    [stateDefinitions, globalStateDefinitions]
  )

  const initialStateValues = useMemo(() => {
    const out: Record<string, unknown> = {}
    const dateMap = getDateNowMap()
    const resolveDateNow = (val: string) =>
      val.replace(/\{\{dateNow\.(\w+)\}\}/g, (_, key) => {
        const v = dateMap[key]
        return v === undefined ? '' : String(v)
      })
    // Resolve TypeName() constructors: scaffold object from custom type fields + defaults
    const resolveConstructor = (val: string): unknown | undefined => {
      const m = val.match(/^(\w+)\(\)$/)
      if (!m) return undefined
      const ct = customTypesRef.current.find((c) => c.name === m[1])
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
    const typ = (s: (typeof effectiveStateDefinitions)[0]) => (s as { type?: 'string' | 'number' | 'boolean' | 'date' }).type ?? 'string'
    for (const s of effectiveStateDefinitions) {
      if (!s.name?.trim()) continue
      const raw = String(s.initialValue ?? '').trim()
      // Try constructor first
      const constructed = resolveConstructor(raw)
      if (constructed !== undefined) { out[s.name] = constructed; continue }
      const v = resolveDateNow(raw)
      if (v === '') {
        out[s.name] = typ(s) === 'number' ? 0 : typ(s) === 'boolean' ? false : typ(s) === 'date' ? resolveDateNow('{{dateNow.datetime}}') : ''
        continue
      }
      if (typ(s) === 'number') {
        const n = Number(v)
        out[s.name] = Number.isNaN(n) ? 0 : n
      } else if (typ(s) === 'boolean') {
        const lv = typeof v === 'string' ? v.toLowerCase() : String(v).toLowerCase();
        out[s.name] = v === 'true' || v === '1' || lv === 'yes'
      } else {
        out[s.name] = v
      }
    }
    return out
  }, [effectiveStateDefinitions, customTypes])

  const [runtimeState, setRuntimeState] = useState<Record<string, unknown>>(initialStateValues)
  const runtimeStateRef = useRef<Record<string, unknown>>(runtimeState)
  runtimeStateRef.current = runtimeState
  const debugHandleRef = useRef<DebugConsoleHandle | null>(null)

  const pushApiLog = useCallback((entry: Omit<ApiLogEntry, 'id' | 'ts'>) => {
    setApiLogs((prev) => {
      const next: ApiLogEntry = { ...entry, id: ++apiLogIdRef.current, ts: Date.now() }
      const merged = [...prev, next]
      return merged.length > 400 ? merged.slice(-400) : merged
    })
    debugHandleRef.current?.push({
      level: entry.ok ? 'log' : 'error',
      label: `api ${entry.method.toUpperCase()} ${entry.status ?? (entry.ok ? 'ok' : 'error')}`,
      detail: entry.url,
    })
  }, [])

  useLayoutEffect(() => {
    const host = canvasStageRef.current
    if (!host) return

    const recalcScale = () => {
      const rect = host.getBoundingClientRect()
      const parent = host.parentElement
      const width = rect.width || host.clientWidth || parent?.clientWidth || window.innerWidth || 1
      const height = rect.height || host.clientHeight || parent?.clientHeight || window.innerHeight || 1
      setCanvasStageSize({ width, height })
      const fit = Math.min(width / fitLogicalSize.width, height / fitLogicalSize.height, 1)
      setCanvasFitScale(Number.isFinite(fit) && fit > 0 ? fit : 1)
    }

    recalcScale()
    const rafA = requestAnimationFrame(recalcScale)
    const rafB = requestAnimationFrame(() => requestAnimationFrame(recalcScale))
    const delayed = window.setTimeout(recalcScale, 120)
    const ro = new ResizeObserver(recalcScale)
    ro.observe(host)
    window.addEventListener('resize', recalcScale)
    return () => {
      cancelAnimationFrame(rafA)
      cancelAnimationFrame(rafB)
      window.clearTimeout(delayed)
      ro.disconnect()
      window.removeEventListener('resize', recalcScale)
    }
  }, [fitLogicalSize.height, fitLogicalSize.width])

  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string } | undefined
      const name = String(reason?.name ?? '')
      const message = String(reason?.message ?? reason ?? '')
      if (name.toLowerCase().includes('canceled') || message.toLowerCase().includes('canceled')) {
        event.preventDefault()
      }
    }
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', onUnhandledRejection)
  }, [])

  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use((config) => {
      ;(config as any).__dccStart = performance.now()
      return config
    })

    const responseInterceptor = axios.interceptors.response.use(
      (response) => {
        const cfg = response.config ?? {}
        const url = String(cfg.url ?? '')
        if (shouldTrackApiUrl(url)) {
          const started = Number((cfg as any).__dccStart ?? 0)
          pushApiLog({
            source: 'axios',
            method: String(cfg.method ?? 'GET').toUpperCase(),
            url,
            status: response.status,
            ok: response.status >= 200 && response.status < 400,
            durationMs: started > 0 ? Math.max(0, performance.now() - started) : undefined,
            request: {
              headers: cfg.headers,
              params: cfg.params,
              data: cfg.data,
            },
            response: response.data,
          })
        }
        return response
      },
      (error) => {
        const cfg = error?.config ?? {}
        const url = String(cfg.url ?? '')
        if (shouldTrackApiUrl(url)) {
          const started = Number((cfg as any).__dccStart ?? 0)
          pushApiLog({
            source: 'axios',
            method: String(cfg.method ?? 'GET').toUpperCase(),
            url,
            status: Number(error?.response?.status) || undefined,
            ok: false,
            durationMs: started > 0 ? Math.max(0, performance.now() - started) : undefined,
            request: {
              headers: cfg.headers,
              params: cfg.params,
              data: cfg.data,
            },
            response: error?.response?.data,
            error: String(error?.message ?? 'Request failed'),
          })
        }
        return Promise.reject(error)
      }
    )

    return () => {
      axios.interceptors.request.eject(requestInterceptor)
      axios.interceptors.response.eject(responseInterceptor)
    }
  }, [pushApiLog])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const originalFetch = window.fetch.bind(window)

    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
      const method = String(init?.method ?? ((input as Request)?.method ?? 'GET')).toUpperCase()
      const track = shouldTrackApiUrl(url)
      const started = performance.now()
      let requestBody: unknown = undefined
      if (track && init?.body != null) {
        if (typeof init.body === 'string') {
          requestBody = init.body
        } else {
          requestBody = '[non-text body]'
        }
      }

      try {
        const response = await originalFetch(input as RequestInfo | URL, init)
        if (track) {
          let payload: unknown = undefined
          try {
            const clone = response.clone()
            const ct = clone.headers.get('content-type') ?? ''
            if (ct.includes('application/json')) {
              payload = await clone.json()
            } else {
              const txt = await clone.text()
              payload = txt.length > 4000 ? `${txt.slice(0, 4000)}... [truncated]` : txt
            }
          } catch {
            payload = '[unreadable response body]'
          }
          pushApiLog({
            source: 'fetch',
            method,
            url,
            status: response.status,
            ok: response.ok,
            durationMs: Math.max(0, performance.now() - started),
            request: {
              headers: init?.headers,
              body: requestBody,
            },
            response: payload,
          })
        }
        return response
      } catch (err) {
        if (track) {
          pushApiLog({
            source: 'fetch',
            method,
            url,
            ok: false,
            durationMs: Math.max(0, performance.now() - started),
            request: {
              headers: init?.headers,
              body: requestBody,
            },
            error: err instanceof Error ? err.message : 'Network error',
          })
        }
        throw err
      }
    }

    ;(window as any).fetch = wrappedFetch
    return () => {
      ;(window as any).fetch = originalFetch
    }
  }, [pushApiLog])

  // Build a fingerprint of each state definition's initial value so we can detect changes
  // For constructor types like Note(), include the custom type field defaults in the fingerprint
  const defsFingerprint = useMemo(() => {
    const fp: Record<string, string> = {}
    for (const s of effectiveStateDefinitions) {
      if (!s.name?.trim()) continue
      const iv = String(s.initialValue ?? '').trim()
      const ctMatch = iv.match(/^(\w+)\(\)$/)
      if (ctMatch) {
        // Include the data model's field defaults in the fingerprint so cache invalidates when they change
        const ct = customTypes.find((c) => c.name === ctMatch[1])
        const fieldSig = ct ? ct.fields.map((f) => `${f.name}:${f.type}:${f.defaultValue ?? ''}`).join(',') : ''
        fp[s.name] = `${iv}|${fieldSig}`
      } else {
        fp[s.name] = iv
      }
    }
    return fp
  }, [effectiveStateDefinitions, customTypes])
  const defsFingerprintRef = useRef(defsFingerprint)
  defsFingerprintRef.current = defsFingerprint

  const stateCacheKey = useMemo(() => `dccortex:screen-state:${screenId}`, [screenId])
  useEffect(() => {
    try {
      const raw = localStorage.getItem(stateCacheKey)
      if (!raw) {
        setRuntimeState(initialStateValues)
        return
      }
      const parsed = JSON.parse(raw)
      // Support new format {v: values, d: defsFingerprint} and legacy format (plain object)
      const cached: Record<string, unknown> = parsed?.v && typeof parsed.v === 'object' ? parsed.v : (parsed && typeof parsed === 'object' && !parsed.v ? parsed : {})
      const savedDefs: Record<string, string> = parsed?.d && typeof parsed.d === 'object' ? parsed.d : {}
      // Only use cached value for a key if its definition hasn't changed since it was cached
      const filtered: Record<string, unknown> = {}
      let anyKept = false
      for (const [k, v] of Object.entries(cached)) {
        const currentDef = defsFingerprint[k]
        const savedDef = savedDefs[k]
        // If no saved defs (legacy cache) or definition changed → skip (use fresh initial)
        if (savedDef === undefined || savedDef !== currentDef) continue
        filtered[k] = v
        anyKept = true
      }
      if (!anyKept) {
        // All cached keys are stale — clear cache entirely and use fresh values
        localStorage.removeItem(stateCacheKey)
        setRuntimeState(initialStateValues)
      } else {
        setRuntimeState({ ...initialStateValues, ...filtered })
      }
    } catch {
      setRuntimeState(initialStateValues)
    }
  }, [initialStateValues, stateCacheKey, defsFingerprint])

  const fetchRuntimeData = useCallback(() => {
    if (!projectId) return
    // Build vars map from dataSources urlParamBindings resolved against current runtimeState
    const vars: Record<string, Record<string, string>> = {}
    for (const ds of dataSources) {
      if (!ds.urlParamBindings) continue
      const resolved: Record<string, string> = {}
      for (const [paramName, binding] of Object.entries(ds.urlParamBindings)) {
        if (!binding) continue
        // Simple state.key resolution: {{state.key}} → runtimeState[key]
        const stateMatch = binding.match(/^\{\{state\.([^}]+)\}\}$/)
        if (stateMatch) {
          const val = runtimeStateRef.current[stateMatch[1]]
          if (val !== undefined && val !== null) resolved[paramName] = String(val)
        } else {
          resolved[paramName] = binding
        }
      }
      if (Object.keys(resolved).length) vars[ds.name] = resolved
    }
    const varsParam = Object.keys(vars).length ? `?vars=${encodeURIComponent(JSON.stringify(vars))}` : ''
    if (externalApiSourceNames.length > 0) setRuntimePendingSources(externalApiSourceNames)
    fetch(`/api/projects/${projectId}/runtime-data${varsParam}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d?.data || typeof d.data !== 'object') return
        const incoming = d.data as Record<string, unknown>
        setRuntimeData((prev) => {
          const next: Record<string, unknown> = { ...prev }
          for (const [key, value] of Object.entries(incoming)) {
            for (const alias of expandDataSourceAliases(key)) {
              // Keep last known good snapshot when a source temporarily fails and returns null/undefined.
              if ((value === null || value === undefined) && prev[alias] !== undefined && prev[alias] !== null) continue
              next[alias] = value
            }
          }
          return next
        })
      })
      .catch(() => {})
      .finally(() => setRuntimePendingSources([]))
  }, [projectId, dataSources, externalApiSourceNames])

  // Hydrate runtime data in editor mode too, so bindings/transforms are available before preview.
  useEffect(() => {
    fetchRuntimeData()
  }, [fetchRuntimeData])

  // Fetch runtime data (API sources + internal DB tables) whenever preview mode is activated
  useEffect(() => {
    if (!previewMode) return
    fetchRuntimeData()
  }, [previewMode, fetchRuntimeData])

  // External API polling: refresh runtime data periodically while preview is on.
  useEffect(() => {
    if (!previewMode || !hasExternalApiSources || !apiLiveRefreshEnabled) return
    const timer = setInterval(() => {
      fetchRuntimeData()
    }, 2000)
    return () => clearInterval(timer)
  }, [previewMode, hasExternalApiSources, apiLiveRefreshEnabled, fetchRuntimeData])

  // Real-time streaming: subscribe to SSE when datasource has realtimePollMs > 0.
  // Server pushes DB snapshots over a single persistent connection — no repeated HTTP
  // requests from the client, no WebSocket infrastructure needed.
  useEffect(() => {
    if (!previewMode || !realtimePollMs || realtimePollMs <= 0) return
    const es = new EventSource(
      `/api/projects/${projectId}/runtime-data/stream?pollMs=${realtimePollMs}`
    )
    es.onmessage = (evt) => {
      try {
        const incoming = JSON.parse(evt.data) as Record<string, unknown>
        setRuntimeData((prev) => {
          const next = { ...prev }
          for (const [key, value] of Object.entries(incoming)) {
            for (const alias of expandDataSourceAliases(key)) {
              next[alias] = value
            }
          }
          return next
        })
      } catch {}
    }
    es.onerror = () => {
      // Browser will auto-reconnect; nothing to do here
    }
    return () => es.close()
  }, [previewMode, projectId, realtimePollMs])

  useEffect(() => {
    scriptFnCacheRef.current = {}
  }, [namedScripts])

  const runScript = useCallback(
    (scriptName: string): unknown => {
      const body = namedScripts[scriptName]
      if (!body || typeof body !== 'string') return undefined
      try {
        let fn = scriptFnCacheRef.current[scriptName]
        if (!fn) {
          fn = new Function('state', 'data', 'return (' + body.trim() + ')') as (state: Record<string, unknown>, data: Record<string, unknown>) => unknown
          scriptFnCacheRef.current[scriptName] = fn
        }
        return fn(runtimeState, runtimeData)
      } catch {
        scriptFnCacheRef.current[scriptName] = null
        return undefined
      }
    },
    [namedScripts, runtimeState, runtimeData]
  )

  const resolveBindingFn = useCallback(
    (raw: string, propsCtx?: Record<string, unknown>) => resolveExpression(raw, { state: runtimeState, data: runtimeData, runScript, navProp: previewNavProps, props: propsCtx }),
    [runtimeState, runtimeData, runScript, previewNavProps]
  )

  const stateTypeByKey = useMemo(() => {
    const m: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date'> = {}
    for (const s of effectiveStateDefinitions) {
      if (!s.name?.trim()) continue
      m[s.name] = (s as StateDefinition).type ?? 'string'
    }
    return m
  }, [effectiveStateDefinitions])

  const handleRunEvent = useCallback((config: EventActionConfig, eventCtx?: EventRuntimeContext) => {
    // ── Debug logging ──
    const dbg = debugHandleRef.current
    if (dbg) {
      const action = config.action ?? 'unknown'
      if (action === 'setState') {
        dbg.push({ level: 'event', label: `setState: ${config.stateKey}`, detail: config.value ?? '' })
      } else if (action === 'navigate') {
        dbg.push({ level: 'event', label: `navigate`, detail: config.url ?? config.targetScreenId ?? '' })
      } else if (action === 'runScript') {
        dbg.push({ level: 'event', label: `runScript: ${config.scriptName ?? 'inline'}` })
      } else if (action === 'startAnimationSequence' || action === 'startAnimationStep' || action === 'stopAnimationSequence' || action === 'resetAnimationSequence') {
        dbg.push({ level: 'event', label: action, detail: config.animationTargetId ?? eventCtx?.targetId ?? 'current' })
      } else {
        dbg.push({ level: 'event', label: action })
      }
    }

    const resolveAnimationTarget = (): { el: HTMLElement; nodeId: string } | null => {
      const targetHint = (config.animationTargetId ?? '').trim() || (eventCtx?.targetId ?? '').trim()
      let el: HTMLElement | null = null
      if (targetHint) {
        el = document.getElementById(targetHint)
        if (!el) el = document.querySelector(`[data-node-id="${targetHint}"]`) as HTMLElement | null
      }
      if (!el && eventCtx?.targetId) {
        el = document.getElementById(eventCtx.targetId) || document.querySelector(`[data-node-id="${eventCtx.targetId}"]`) as HTMLElement | null
      }
      if (!el) return null
      const nodeId = el.getAttribute('data-node-id') || targetHint || eventCtx?.targetId || ''
      if (!nodeId) return null
      return { el, nodeId }
    }

    if (config.action === 'startAnimationSequence' || config.action === 'startAnimationStep' || config.action === 'stopAnimationSequence' || config.action === 'resetAnimationSequence') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const target = resolveAnimationTarget()
      if (!target) return

      if (config.action === 'stopAnimationSequence' || config.action === 'resetAnimationSequence') {
        clearAnimationSequence(target.el)
        if (config.action === 'resetAnimationSequence') {
          target.el.style.opacity = ''
          target.el.style.transform = ''
        }
        return
      }

      const targetNode = findNode(activeRoot, target.nodeId)
      const rawSeq = (targetNode?.props?.animationSequence ?? null) as AnimationSequenceConfig | null
      if (!rawSeq || !Array.isArray(rawSeq.steps) || rawSeq.steps.length === 0) return

      let runSeq = rawSeq
      if (config.action === 'startAnimationStep') {
        const n = Math.max(1, Number(config.animationStep ?? '1') || 1)
        runSeq = { ...rawSeq, steps: rawSeq.steps.slice(n - 1) }
      }

      executeAnimationSequence(target.el, runSeq, {
        previewMode: true,
        onStart: () => debugHandleRef.current?.push({ level: 'event', label: 'animation start', detail: target.nodeId }),
        onTick: () => debugHandleRef.current?.push({ level: 'event', label: 'animation tick', detail: target.nodeId }),
        onEnd: () => debugHandleRef.current?.push({ level: 'event', label: 'animation end', detail: target.nodeId }),
      }).catch(() => {})
      return
    }

    if (config.action === 'setState' && config.stateKey) {
      const key = config.stateKey
      const rawValue = (config.value ?? '').trim()
      const exactSelf = `{{state.${key}}}`
      const normalized = rawValue.replace(/\s+/g, ' ').trim()
      const isIncrement = normalized === exactSelf || normalized === `${exactSelf} + 1` || normalized === `${exactSelf}+ 1` || normalized === `${exactSelf} +1` || normalized === `${exactSelf}+1`
      if (isIncrement) {
        setRuntimeState((prev) => {
          if (!evaluateEventCondition(config.condition, prev, eventCtx)) return prev
          const current = prev[key]
          const n = Number(current)
          const next = Number.isNaN(n) ? 0 : n + 1
          const out = { ...prev, [key]: next }
          queueMicrotask(() => debugHandleRef.current?.push({ level: 'state', label: `${key} = ${next}`, detail: `was: ${current}` }))
          if (config.cacheValue) {
            try { localStorage.setItem(stateCacheKey, JSON.stringify({ v: out, d: defsFingerprintRef.current })) } catch {}
          }
          return out
        })
        return
      }
      setRuntimeState((prev) => {
        if (!evaluateEventCondition(config.condition, prev, eventCtx)) return prev
        const resolved = resolveExpression(rawValue, {
          state: prev,
          event: eventCtx as Record<string, unknown> | undefined,
          runScript,
        })
        const typ = stateTypeByKey[key] ?? 'string'
        let value: unknown = resolved
        if (typ === 'number') {
          const num = Number(resolved)
          value = Number.isNaN(num) ? 0 : num
        } else if (typ === 'boolean') {
          const lv = typeof resolved === 'string' ? resolved.toLowerCase() : String(resolved).toLowerCase();
          value = resolved === 'true' || resolved === '1' || lv === 'yes'
        }
        const out = { ...prev, [key]: value }
        queueMicrotask(() => debugHandleRef.current?.push({ level: 'state', label: `${key} = ${JSON.stringify(value)}`, detail: `expr: ${rawValue}` }))
        if (config.cacheValue) {
          try { localStorage.setItem(stateCacheKey, JSON.stringify({ v: out, d: defsFingerprintRef.current })) } catch {}
        }
        return out
      })
      return
    }

    if (config.action === 'mutateState' && config.stateKey) {
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
        const out = { ...prev, [key]: value }
        queueMicrotask(() => debugHandleRef.current?.push({ level: 'state', label: `${key} = ${JSON.stringify(value)} (${op})`, detail: `was: ${current}` }))
        if (config.cacheValue) {
          try { localStorage.setItem(stateCacheKey, JSON.stringify({ v: out, d: defsFingerprintRef.current })) } catch {}
        }
        return out
      })
      return
    }
    
    if (config.action === 'runScript') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      if (config.scriptName && config.scriptName !== '__inline__') {
        runScript(config.scriptName)
        return
      }
      if (config.customScript?.trim()) {
        try {
          const fn = new Function('state', 'event', 'data', config.customScript)
          fn(runtimeState, eventCtx ?? {}, runtimeData)
        } catch {}
      }
      return
    }

    if (config.action === 'navigate') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const targetId = config.targetScreenId?.trim()
      if (targetId) {
        // Resolve navProps: values can be binding expressions
        const resolvedNavProps: Record<string, unknown> = {}
        if (config.navProps && typeof config.navProps === 'object') {
          for (const [k, v] of Object.entries(config.navProps)) {
            resolvedNavProps[k] = resolveBinding(String(v), { state: runtimeState, event: eventCtx as Record<string, unknown> | undefined, data: runtimeData })
          }
        }
        // Auto-detect modal: explicit targetScreenType OR the target screen's own presentation setting
        const targetScreenMeta = screenTargets.find(s => s.id === targetId)
        const isModal = config.targetScreenType === 'modal' || targetScreenMeta?.presentation === 'modal'
        if (isModal) {
          setModalScreenId(targetId)
          modalScreenIdRef.current = targetId
          setModalNavProps(resolvedNavProps)
        } else {
          setPreviewNavHistory((h) => [...h, previewScreenId ?? '__home__'])
          setPreviewScreenId(targetId)
          setPreviewNavProps(resolvedNavProps)
        }
        return
      }
      const url = resolveBinding(config.url ?? '', { state: runtimeState, event: eventCtx as Record<string, unknown> | undefined })
      if (url) window.open(url, '_self')
      return
    }

    if (config.action === 'alert') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const msg = resolveBinding(config.message ?? '', { state: runtimeState, event: eventCtx as Record<string, unknown> | undefined })
      window.alert(msg)
      return
    }

    if (config.action === 'log') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const msg = resolveBinding(config.message ?? '', { state: runtimeState, event: eventCtx as Record<string, unknown> | undefined })
      console.log('[Log]', msg)
      if (debugHandleRef.current) debugHandleRef.current.push({ level: 'event', label: 'log', detail: msg })
      return
    }

    if (config.action === 'haptic') {
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
      if (debugHandleRef.current) debugHandleRef.current.push({ level: 'event', label: 'haptic', detail: `preset=${preset}` })
      return
    }

    if (config.action === 'speak') {
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

    if (config.action === 'playAudio') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const url = resolveBinding(config.audioUrl ?? '', { state: runtimeState, event: eventCtx as Record<string, unknown> | undefined })
      if (url) {
        try { new Audio(url).play() } catch {}
      }
      return
    }

    if (config.action === 'goBack') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      // If a modal is open, close it first instead of popping page history
      if (modalScreenIdRef.current) {
        setModalScreenId(null)
        modalScreenIdRef.current = null
        return
      }
      setPreviewNavHistory((h) => {
        const next = [...h]
        const prev = next.pop()
        if (prev === '__home__') setPreviewScreenId(null)
        else if (prev) setPreviewScreenId(prev)
        return next
      })
      return
    }

    if (config.action === 'uploadFile') {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      const files = eventCtx?.value as FileList | null
      if (!files || files.length === 0) return
      const stateKey = config.uploadStateKey?.trim()
      if (!stateKey) return
      const loadingKey = config.uploadLoadingStateKey?.trim()
      const endpoint = config.uploadUrl?.trim() || `/api/projects/${projectId}/assets`
      const isLocalAssets = !config.uploadUrl?.trim()
      if (loadingKey) {
        setRuntimeState((prev) => ({ ...prev, [loadingKey]: true }))
      }
      ;(async () => {
        try {
          const urls: string[] = []
          for (const file of Array.from(files)) {
            const fd = new FormData()
            fd.append('file', file)
            const res = await fetch(endpoint, { method: 'POST', body: fd })
            if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
            const json = await res.json()
            // Local assets API returns { asset: { url } }, external APIs may return { url } directly
            const url = isLocalAssets ? json?.asset?.url : (json?.url ?? json?.asset?.url ?? json?.Location ?? json?.location ?? '')
            if (url) urls.push(url)
          }
          const result = files.length === 1 ? (urls[0] ?? '') : urls
          setRuntimeState((prev) => ({ ...prev, [stateKey]: result }))
          if (debugHandleRef.current) debugHandleRef.current.push({ level: 'event', label: `uploadFile → ${stateKey}`, detail: String(result) })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed'
          if (debugHandleRef.current) debugHandleRef.current.push({ level: 'event', label: 'uploadFile error', detail: msg })
          setRuntimeState((prev) => ({ ...prev, [stateKey]: '' }))
        } finally {
          if (loadingKey) {
            setRuntimeState((prev) => ({ ...prev, [loadingKey]: false }))
          }
        }
      })()
      return
    }

    if (config.action === 'custom' && config.customScript?.trim()) {
      if (!evaluateEventCondition(config.condition, runtimeState, eventCtx)) return
      try {
        const fn = new Function('state', 'event', 'data', config.customScript)
        fn(runtimeState, eventCtx ?? {}, runtimeData)
      } catch {}
    }
  }, [stateTypeByKey, stateCacheKey, runScript, runtimeState, triggerHaptic, projectId, activeRoot])

  useEffect(() => {
    if (!activeSelectedId) {
      setInspection(null)
      return
    }
    const timer = window.setTimeout(() => {
      const el = document.querySelector(`[data-node-id="${activeSelectedId}"]`) as HTMLElement | null
      if (!el) {
        setInspection(null)
        return
      }
      const html = (el.outerHTML || '').slice(0, 25000)
      setInspection({ nodeId: activeSelectedId, html })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activeSelectedId, root, reusableSelectedId, editingReusableId, previewMode])

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingBar fullPage />
      </DashboardLayout>
    )
  }

  if (isError) {
    const msg = axios.isAxiosError(error) && error.response?.status === 502
      ? 'Server temporarily unavailable (502). Check your deployment or try again in a moment.'
      : axios.isAxiosError(error) && error.message?.toLowerCase().includes('network')
        ? 'Network error. If you’re on a different origin (e.g. localhost), ensure CORS allows it.'
        : 'Failed to load screen.'
    return (
      <DashboardLayout>
        <div className="p-6 max-w-md space-y-3">
          <p className="text-red-600 dark:text-red-400 font-medium">Could not load screen</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{msg}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  if (!screen) {
    return (
      <DashboardLayout>
        <div className="p-6 text-gray-500 dark:text-gray-400">Screen not found.</div>
      </DashboardLayout>
    )
  }

  const breadcrumbs = [
    { label: 'Organizations', href: '/dashboard' },
    { label: 'Org', href: `/organizations/${orgId}` },
    { label: 'Project', href: `/organizations/${orgId}/projects/${projectId}/backend` },
    { label: 'Screens', href: `/organizations/${orgId}/projects/${projectId}/screens` },
    { label: screen.name, href: '#' },
  ]
  const screenTargets = ((screensData?.screens ?? []) as Array<Record<string, unknown>>).map((s) => {
    const layoutPres = ((s.layout as ScreenLayoutPayload | null | undefined)?.presentation)
    const layoutDefs = ((s.layout as ScreenLayoutPayload | null | undefined)?.screenPropDefs)
    return {
      id: String(s.id),
      name: String(s.name ?? s.slug ?? s.id),
      presentation: ((s as any).presentation ?? layoutPres ?? 'page') as 'page' | 'modal' | 'sidebar',
      propDefs: Array.isArray(layoutDefs) ? layoutDefs : [],
    }
  })
  const screenById = new Map(
    ((screensData?.screens ?? []) as Array<Record<string, unknown>>).map((s) => [String(s.id), s])
  )
  const previewScreen = previewScreenId ? screenById.get(previewScreenId) : null
  const previewPayload = (previewScreen?.layout ?? null) as Node | ScreenLayoutPayload | null
  const previewRoot =
    previewMode && previewPayload
      ? (previewPayload && typeof previewPayload === 'object' && 'root' in previewPayload
          ? (previewPayload as ScreenLayoutPayload).root
          : (previewPayload as Node))
      : activeRoot
  const effectiveTheme = { ...globalTheme, ...theme }
  const modalScreen = modalScreenId ? screenById.get(modalScreenId) : null
  const modalPayload = (modalScreen?.layout ?? null) as ScreenLayoutPayload | null
  // Handle both ScreenLayoutPayload format { root: Node, ... } and bare-Node format { id, type, props, children }
  const modalRoot = modalPayload
    ? (typeof modalPayload === 'object' && 'root' in modalPayload
        ? (modalPayload as ScreenLayoutPayload).root
        : (modalPayload as unknown as Node))
    : null
  const modalTheme: typeof effectiveTheme = { ...effectiveTheme, ...(modalPayload?.theme ?? {}) }
  const editingReusable = editingReusableId ? globalReusables.find((r) => r.id === editingReusableId) : null
  const projectMeta = (projectData?.project ?? {}) as { status?: string; customDomain?: string | null }
  const isPublished = projectMeta.status === 'published'
  const liveUrl = isPublished
    ? (projectMeta.customDomain
        ? `${String(projectMeta.customDomain).startsWith('http') ? '' : 'https://'}${projectMeta.customDomain}`
        : `/p/${projectId}`)
    : null

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen bg-white dark:bg-[#0d1117]">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-[#30363d] px-3 sm:px-4 py-2 shrink-0">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 overflow-x-auto whitespace-nowrap pb-1">
            <Breadcrumb items={breadcrumbs} />
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
            {previewMode ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setPreviewMode(false); setPreviewScreenId(null); setPreviewNavHistory([]) }}
                className="flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                Exit preview
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewMode(true)}
                className="flex items-center gap-1.5"
              >
                <Eye className="w-4 h-4" />
                Preview
              </Button>
            )}
            {liveUrl && (
              <a
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
                className="relative inline-flex items-center gap-2 rounded border border-emerald-300/70 dark:border-emerald-500/60 bg-emerald-50/80 dark:bg-emerald-900/30 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                title="Project is live. Open public link"
              >
                <span className="absolute -left-1 -top-1 inline-flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                Live now - open link
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span>Presence</span>
              <select
                value={presenceMode}
                onChange={(e) => setPresenceMode(e.target.value as PresenceMode)}
                className="text-xs border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-black dark:text-white px-1.5 py-1 rounded"
                title="Collaboration presence mode"
              >
                <option value="off">Off</option>
                <option value="slow">Slow (60s)</option>
                <option value="panel">Only when panel open</option>
              </select>
            </label>
            <span className="hidden lg:inline text-[10px] text-gray-400 dark:text-gray-500" title="Presence shows who else is online, where their cursor is, and what they have selected.">
              online cursors and selections
            </span>
            {visibleCollaborators.length > 0 && (
              <button
                type="button"
                onClick={() => setCollaboratorsDialogOpen(true)}
                className="flex items-center gap-2 hover:opacity-85 transition-opacity"
                title="Active collaborators"
              >
                <span className="text-xs text-gray-500 dark:text-gray-400">Collaborators</span>
                <div className="flex items-center -space-x-2">
                  {visibleCollaborators.slice(0, 6).map((p) => {
                    const id = p.clientId || p.userId
                    const color = colorForPresence(id)
                    const label = p.name || p.userId
                    const hasSelection = p.screenId === screenId && !!p.selectionId
                    return (
                      <div
                        key={id}
                        className="h-6 w-6 rounded-full border-2 border-white dark:border-[#0d1117] text-[10px] font-semibold text-white flex items-center justify-center"
                        style={{ backgroundColor: color }}
                        title={hasSelection ? `${label} selecting ${p.selectionId}` : `${label} online`}
                      >
                        {initialsForPresence(p.name, p.userId)}
                      </div>
                    )
                  })}
                </div>
              </button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true)
                await refreshFromServer()
                setRefreshing(false)
              }}
              title="Refresh from server (get latest from other devices)"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline ml-1">Refresh</span>
            </Button>
            {lastSyncedAt != null && Date.now() - lastSyncedAt < 5000 && !syncError && (
              <span className="text-xs text-green-600 dark:text-green-400">Synced</span>
            )}
            {syncError && (
              <span className="text-xs text-amber-600 dark:text-amber-400" title={syncError}>
                {syncError}
              </span>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setPackageManagerOpen(true)}>
              Packages
            </Button>
            {saveStatus === 'saving' && <span className="text-xs text-gray-500">Saving…</span>}
            {saveStatus === 'saved' && <span className="text-xs text-green-600 dark:text-green-400">Saved</span>}
            <Button
              onClick={handleSave}
              size="sm"
              className="bg-black dark:bg-white text-white dark:text-black"
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
        <ResizablePanelLayout
          showLeft={!previewMode && !canvasExpanded}
          showRight={!previewMode && !canvasExpanded}
          storageKey={panelWidthsStorageKey}
          onWidthsChange={handlePanelWidthsChange}
          leftTree={
            <NodeTree
              root={activeRoot}
              selectedId={activeSelectedId}
              onSelect={editingReusableId ? setReusableSelectedId : setSelectedId}
              onDelete={handleDeleteNode}
              onCreateReusable={handleCreateReusableFromNode}
              onMove={handleMoveNode}
              globalReusables={globalReusables}
              storageKey={treeStorageKey}
            />
          }
          leftPalette={({ isMobile, closeMobileSheet }) => (
            <ComponentPalette
              onAddComponent={handleQuickAddComponent}
              autoCloseAfterAdd={mobileAutoClosePalette}
              onAutoCloseAfterAddChange={isMobile ? setMobileAutoClosePalette : undefined}
              onRequestClose={closeMobileSheet}
              scrollStorageKey={paletteScrollStorageKey}
            />
          )}
          center={
            <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
              <div className="shrink-0 flex flex-wrap items-center justify-center gap-3 py-2 border-b border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22]">
                {editingReusableId && !previewMode && (
                  <div className="flex items-center gap-2 rounded border border-[var(--primary)]/45 bg-[var(--primary)]/5 px-2.5 py-1.5 text-xs">
                    <span className="font-medium text-gray-800 dark:text-gray-100">Editing reusable source</span>
                    <span className="text-gray-500 dark:text-gray-400">{editingReusable?.name ?? 'Reusable'}</span>
                    <button type="button" className="underline text-[var(--primary)]" onClick={stopEditingReusable}>Back to screen</button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => undo()}
                  disabled={editingReusableId ? !reusableUndoStackRef.current.length : !undoStackRef.current.length}
                  className="p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#21262d] hover:text-black dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => redo()}
                  disabled={editingReusableId ? !reusableRedoStackRef.current.length : !redoStackRef.current.length}
                  className="p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#21262d] hover:text-black dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <button
                  type="button"
                  onClick={() => setDevSettingsOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]"
                  title="Open developer canvas settings"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Dev Settings
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCanvasZoom(z => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2))))}
                    className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#21262d]"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasZoom(1)}
                    className="text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#21262d] px-1.5 py-1 rounded min-w-[2.75rem] text-center"
                    title="Reset zoom"
                  >
                    {Math.round(canvasZoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasZoom(z => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))}
                    className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#21262d]"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {previewSize} • {Math.round(canvasZoom * 100)}% • {effectiveDeviceFrameEnabled ? 'frame on' : 'frame off'}
                </span>
              </div>
              <div ref={canvasStageRef} className="flex-1 min-w-0 min-h-0 overflow-auto flex flex-col items-start justify-start">
                {(() => {
                  const liveFitScale =
                    canvasStageSize.width > 0 && canvasStageSize.height > 0
                      ? Math.min(
                          canvasStageSize.width / fitLogicalSize.width,
                          canvasStageSize.height / fitLogicalSize.height,
                          1
                        )
                      : canvasFitScale
                  const baseFitScale = Number.isFinite(liveFitScale) && liveFitScale > 0 ? liveFitScale : canvasFitScale
                  const effectiveScale = Math.max(0.05, baseFitScale * canvasZoom)
                  const scaledWidth = logicalViewport.width * effectiveScale
                  const scaledHeight = logicalViewport.height * effectiveScale
                  const renderCanvas = (canvasRoot: Node) => (
                    <BuilderCanvas
                      root={canvasRoot}
                      selectedId={activeSelectedId}
                      onSelect={editingReusableId ? setReusableSelectedId : setSelectedId}
                      onUpdate={editingReusableId ? persistEditingReusableRoot : handleLayoutChange}
                      previewMode={previewMode}
                      suppressRootChrome={!previewMode && previewSize !== 'freeform' && effectiveDeviceFrameEnabled}
                      resolveBinding={resolveBindingFn}
                      theme={effectiveTheme}
                      previewTheme={previewMode ? previewTheme : undefined}
                      onMove={handleMoveNode}
                      onRunEvent={handleRunEvent}
                      reusables={globalReusables}
                      reusablePropsCtx={activeReusablePropsCtx}
                      runtimePendingSources={runtimePendingSources}
                      runtimeResolvedSources={runtimeResolvedSources}
                    />
                  )
                  const themeVars = effectiveTheme
                    ? {
                        ['--border-radius' as string]: effectiveTheme.borderRadius ?? DEFAULT_THEME.borderRadius,
                        ['--border-radius-sm' as string]: effectiveTheme.borderRadiusSm ?? DEFAULT_THEME.borderRadiusSm,
                        ['--border-radius-lg' as string]: effectiveTheme.borderRadiusLg ?? DEFAULT_THEME.borderRadiusLg,
                        ['--border-radius-full' as string]: isZeroBorderRadius(effectiveTheme.borderRadius) ? '0px' : '9999px',
                        ['--primary' as string]: effectiveTheme.primary ?? DEFAULT_THEME.primary,
                        ['--background' as string]: effectiveTheme.background ?? DEFAULT_THEME.background,
                        ['--text' as string]: effectiveTheme.text ?? DEFAULT_THEME.text,
                        ['--surface' as string]: effectiveTheme.surface ?? DEFAULT_THEME.surface,
                        ['--border-color' as string]: effectiveTheme.borderColor ?? DEFAULT_THEME.borderColor,
                      }
                    : undefined
                  const renderThemedCanvas = (canvasRoot: Node) => (
                    <div
                      className={`flex flex-col w-full flex-1 min-h-0 ${
                        (previewMode && (previewTheme === 'dark' || effectiveTheme.colorMode === 'dark')) ||
                        (!previewMode && effectiveTheme.colorMode === 'dark') ||
                        (effectiveTheme.colorMode === 'adaptive' && systemDark)
                          ? 'dark' : ''
                      }`}
                      data-theme={previewMode ? (effectiveTheme.colorMode === 'dark' ? 'dark' : effectiveTheme.colorMode === 'adaptive' ? (systemDark ? 'dark' : 'light') : previewTheme) : (effectiveTheme.colorMode ?? 'light')}
                      style={{
                        ...themeVars,
                        ...(effectiveTheme?.background ? { background: 'var(--background)', color: 'var(--text)' } : {}),
                        width: '100%',
                        height: '100%',
                      }}
                    >
                      {effectiveTheme.customCss && (
                        <style dangerouslySetInnerHTML={{ __html: effectiveTheme.customCss }} />
                      )}
                      {renderCanvas(canvasRoot)}
                    </div>
                  )
                  const renderFramedCanvas = (canvasRoot: Node) => (previewSize !== 'freeform' && effectiveDeviceFrameEnabled)
                    ? (() => {
                        const frameProps: Record<string, unknown> = {
                          device: activeFrameConfig.device,
                        }
                        if (activeFrameOption.hasLandscape) frameProps.landscape = Boolean(activeFrameConfig.landscape)
                        if (activeFrameOption.colors.length > 0) frameProps.color = activeFrameConfig.color ?? activeFrameOption.colors[0]
                        return <DeviceFrameset {...(frameProps as any)}>{renderThemedCanvas(canvasRoot)}</DeviceFrameset>
                      })()
                    : renderThemedCanvas(canvasRoot)
                  const frameGutterScaled = frameGutterLogical * effectiveScale
                  const antiClipPaddingScaled = antiClipPaddingLogical * effectiveScale
                  const framePadScaled = frameGutterScaled + antiClipPaddingScaled
                  const visualWidth = scaledWidth + framePadScaled * 2
                  const visualHeight = scaledHeight + framePadScaled * 2
                  const framedViewport = previewSize !== 'freeform' && effectiveDeviceFrameEnabled
                  const previewUsesDarkBackdrop =
                    previewTheme === 'dark' ||
                    effectiveTheme.colorMode === 'dark' ||
                    (effectiveTheme.colorMode === 'adaptive' && systemDark)
                  const stageBackdropColor = previewMode
                    ? (effectiveTheme.background?.trim() || (previewUsesDarkBackdrop ? '#0f172a' : '#f8fafc'))
                    : canvasBgColor
                  return (
                    <div
                      ref={layoutOverlayHostRef}
                      className="relative w-full h-full min-w-0 overflow-auto"
                      style={{ backgroundColor: stageBackdropColor }}
                    >
                      <div
                        className={`${framedViewport ? 'min-w-full justify-center' : 'w-full justify-start'} min-h-full flex items-start`}
                        style={{
                          padding: framedViewport ? 12 : 0,
                        }}
                      >
                        <div
                          ref={canvasViewportRef}
                          className={`relative shrink-0 ${framedViewport ? 'overflow-visible' : 'overflow-hidden'}`}
                          style={{
                            width: visualWidth,
                            height: visualHeight,
                          }}
                          onMouseMove={!previewMode ? handleCanvasPointerMove : undefined}
                          onMouseLeave={!previewMode ? handleCanvasPointerLeave : undefined}
                        >
                          <div
                            className="absolute"
                            style={{
                              left: framePadScaled,
                              top: framePadScaled,
                              width: logicalViewport.width,
                              height: logicalViewport.height,
                              transform: `scale(${effectiveScale})`,
                              transformOrigin: 'top left',
                              transition: 'transform 120ms ease-out',
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: framedViewport ? 'visible' : 'hidden',
                            }}
                          >
                            {/* Preview navigation bar — shown when navigated away from the home screen */}
                            {previewMode && previewScreenId && (
                              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-gray-900/80 text-white text-xs" style={{ backdropFilter: 'blur(4px)', zIndex: 100 }}>
                                {previewNavHistory.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPreviewNavHistory((h) => {
                                        const next = [...h]
                                        const prev = next.pop()
                                        if (prev === '__home__') setPreviewScreenId(null)
                                        else if (prev) setPreviewScreenId(prev)
                                        return next
                                      })
                                    }}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                                  >
                                    ← Back
                                  </button>
                                )}
                                <span className="opacity-60">Screen:</span>
                                <span className="font-medium">{screenById.get(previewScreenId) ? String((screenById.get(previewScreenId) as any).name ?? previewScreenId) : previewScreenId}</span>
                              </div>
                            )}
                            {!previewMode && showCanvasMesh && (
                              <div
                                className="pointer-events-none absolute inset-0 z-[60]"
                                style={{
                                  backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.14) 1px, transparent 1.1px), radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1.1px)',
                                  backgroundSize: '20px 20px, 80px 80px',
                                  backgroundPosition: '0 0, 10px 10px',
                                  mixBlendMode: 'multiply',
                                }}
                              />
                            )}
                            <div className={`flex-1 flex flex-col min-h-0 ${(previewSize !== 'freeform' && effectiveDeviceFrameEnabled) ? 'overflow-visible' : 'overflow-hidden'}`}>
                              {renderFramedCanvas(previewRoot)}
                            </div>
                          </div>
                        </div>

                        {!previewMode && visibleCursors.map((p) => {
                          const id = p.clientId || p.userId
                          const color = colorForPresence(id)
                          const x = (p.cursorX as number) * 100
                          const y = (p.cursorY as number) * 100
                          const label = p.name || p.userId
                          return (
                            <div
                              key={`cursor-${id}`}
                              className="pointer-events-none absolute z-[120]"
                              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-2px, -2px)' }}
                              title={label}
                            >
                              <div style={{ width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: `14px solid ${color}`, transform: 'rotate(-28deg)', transformOrigin: 'bottom center' }} />
                              <div className="mt-1 px-1.5 py-0.5 text-[10px] font-semibold text-white rounded" style={{ backgroundColor: color }}>
                                {initialsForPresence(p.name, p.userId)}
                              </div>
                            </div>
                          )
                        })}

                        {!previewMode && showLayoutInspector && layoutGuideRect && selectedLayoutSummary && (
                          <>
                            <div
                              className="pointer-events-none absolute z-[121] px-2 py-1 rounded border border-indigo-200 dark:border-indigo-600 bg-white/90 dark:bg-[#0d1117]/90 text-[10px] text-indigo-700 dark:text-indigo-300 whitespace-nowrap"
                              style={{
                                left: Math.max(0, layoutGuideRect.left - 8),
                                top: Math.max(0, layoutGuideRect.top + (layoutGuideRect.height / 2)),
                                transform: 'translate(-100%, -50%)',
                              }}
                            >
                              {Math.round(layoutGuideRect.width)} x {Math.round(layoutGuideRect.height)}
                            </div>
                            <div
                              className="pointer-events-none absolute z-[121] px-2 py-1 rounded border border-emerald-200 dark:border-emerald-600 bg-white/90 dark:bg-[#0d1117]/90 text-[10px] text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
                              style={{
                                left: layoutGuideRect.left + layoutGuideRect.width + 8,
                                top: Math.max(0, layoutGuideRect.top + (layoutGuideRect.height / 2)),
                                transform: 'translateY(-50%)',
                              }}
                            >
                              d:{selectedLayoutSummary.display} fd:{selectedLayoutSummary.direction} gap:{selectedLayoutSummary.gap} p:{selectedLayoutSummary.padding} m:{selectedLayoutSummary.margin}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
              <DebugConsole
                runtimeState={runtimeState}
                stateDefinitions={effectiveStateDefinitions}
                inspection={inspection}
                apiLogs={apiLogs}
                handleRef={(h) => { debugHandleRef.current = h }}
                storageKey={debugConsoleStorageKey}
              />
              <GlobalReusablesPane
                reusables={globalReusables}
                onDropNodeToCreateReusable={handleCreateReusableFromNode}
                onEditReusable={startEditingReusable}
                onDeleteReusable={handleDeleteReusable}
                activeReusableId={editingReusableId}
                onInsertReusable={handleInsertReusable}
                onBrowseOrgResources={() => {
                  setOrgResourceBrowserOpen(true)
                  void fetchOrgResourceCatalog()
                }}
                promotingReusableIds={promotingReusableIds}
                onPromoteReusable={async (reusable) => {
                  if (!orgId) {
                    pushEditorNotice('error', 'Cannot promote reusable: missing organization context.')
                    return
                  }

                  if (promotingReusableIds.includes(reusable.id)) return
                  setPromotingReusableIds((prev) => (prev.includes(reusable.id) ? prev : [...prev, reusable.id]))

                  const progressNoticeId = pushEditorNotice('info', `Promoting "${reusable.name}" to organization...`, 0)
                  try {
                    await axios.post(`/api/organizations/${orgId}/reusables`, {
                      reusable,
                      sourceProjectId: projectId,
                    })
                    dismissEditorNotice(progressNoticeId)
                    pushEditorNotice('success', `Promoted "${reusable.name}" to organization reusables.`)
                  } catch (err: any) {
                    dismissEditorNotice(progressNoticeId)
                    const msg = err?.response?.data?.error || err?.message || 'Unknown error'
                    pushEditorNotice('error', `Failed to promote reusable: ${msg}`)
                  } finally {
                    setPromotingReusableIds((prev) => prev.filter((id) => id !== reusable.id))
                  }
                }}
                onRenameReusable={(id, newName) => {
                  const next = globalReusables.map((r) => r.id === id ? { ...r, name: newName } : r)
                  setGlobalReusables(next)
                  persistGlobals({ globalReusables: next })
                }}
              />
            </div>
          }
          rightPanel={
            <PropertyPanel
              node={selectedNode}
              onUpdate={handlePropChange}
              stateDefinitions={stateDefinitions}
              onStateDefinitionsChange={setStateDefinitions}
              globalStateDefinitions={globalStateDefinitions}
              onGlobalStateDefinitionsChange={(next) => {
                globalStateUndoRef.current = [...globalStateUndoRef.current.slice(-49), globalStateDefinitions]
                globalStateRedoRef.current = []
                setGlobalStateDefinitions(next)
                persistGlobals({ globalStateDefinitions: next })
              }}
              dataSources={dataSources}
              runtimeData={runtimeData}
              onDataSourcesChange={setDataSources}
              namedScripts={namedScripts}
              scriptsLoading={!scriptsHydrated}
              onNamedScriptsChange={setNamedScripts}
              theme={theme}
              onThemeChange={handleThemeChange}
              globalTheme={globalTheme}
              onGlobalThemeChange={(updates) => {
                const next = { ...globalTheme, ...updates }
                setGlobalTheme(next)
                persistGlobals({ globalTheme: next })
              }}
              screenTargets={screenTargets}
              globalReusables={globalReusables}
              parentPropSchema={parentPropSchema}
              presentation={screenPresentation}
              onPresentationChange={handlePresentationChange}
              screenPropDefs={screenPropDefs}
              onScreenPropDefsChange={handleScreenPropDefsChange}
              projectId={projectId}
              projectAssets={projectAssets}
              seoSettings={seoSettings}
              onSeoChange={handleSeoChange}
              onWrapSelectedWithSuspense={handleWrapSelectedWithSuspense}
              onEditReusable={startEditingReusable}
              customTypes={customTypes}
              onCustomTypesChange={handleCustomTypesChange}
              aiProtected={aiProtected}
              onAiProtectedChange={(locked) => { setAiProtected(locked); aiProtectedRef.current = locked }}
              tabStorageKey={propertyPanelTabStorageKey}
              scrollStorageKey={propertyPanelScrollStorageKey}
            />
          }
        />
      </div>

      {devSettingsOpen && (
        <div className="fixed inset-0 z-[142] flex items-center justify-center bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) setDevSettingsOpen(false) }}>
          <div className="w-[980px] max-w-[calc(100vw-1.5rem)] max-h-[86vh] overflow-hidden rounded-lg border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-[#30363d] flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dev Settings</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Canvas diagnostics and viewport controls with live visual previews.</div>
              </div>
              <button type="button" onClick={() => setDevSettingsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section className="rounded border border-gray-200 dark:border-[#30363d] p-3">
                  <h3 className="text-sm font-semibold mb-1 text-gray-900 dark:text-gray-100">Viewport</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">Control frame target and canvas scaling behavior.</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {(['mobile', 'tablet', 'desktop', 'freeform'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setPreviewSize(s)}
                        className={`px-2 py-1.5 text-xs rounded border ${previewSize === s ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                      >
                        {s === 'mobile' ? 'Mobile 375' : s === 'tablet' ? 'Tablet 768' : s === 'desktop' ? 'Desktop 16:9' : 'Freeform'}
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">Use header zoom for quick in/out while editing.</div>
                </section>

                <section className="rounded border border-gray-200 dark:border-[#30363d] p-3">
                  <h3 className="text-sm font-semibold mb-1 text-gray-900 dark:text-gray-100">Device Frame</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">Preview with physical shell framing for mobile/tablet/desktop.</p>
                  {previewSize !== 'freeform' ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={activeFrameConfig.device}
                          onChange={(e) => {
                            const nextDevice = e.target.value as DeviceName
                            const option = DeviceOptions[nextDevice]
                            setFrameConfigByCategory((prev) => ({
                              ...prev,
                              [frameCategory]: normalizeFrameConfig(frameCategory, {
                                device: nextDevice,
                                color: option.colors[0],
                                landscape: option.hasLandscape ? prev[frameCategory]?.landscape : undefined,
                              }),
                            }))
                          }}
                          className="flex-1 text-xs border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-black dark:text-white px-1.5 py-1 rounded"
                        >
                          {availableDevices.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setDeviceFrameEnabled((v) => !v)}
                          disabled={!framesAllowed}
                          className={`px-2 py-1 text-xs rounded border ${effectiveDeviceFrameEnabled ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]'} ${!framesAllowed ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''}`}
                        >
                          {effectiveDeviceFrameEnabled ? 'Frame On' : 'Frame Off'}
                        </button>
                      </div>
                      {activeFrameOption.colors.length > 0 && (
                        <select
                          value={activeFrameConfig.color ?? activeFrameOption.colors[0]}
                          onChange={(e) => {
                            const nextColor = e.target.value
                            setFrameConfigByCategory((prev) => ({
                              ...prev,
                              [frameCategory]: normalizeFrameConfig(frameCategory, {
                                ...prev[frameCategory],
                                color: nextColor,
                              }),
                            }))
                          }}
                          className="w-full text-xs border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-black dark:text-white px-1.5 py-1 rounded"
                        >
                          {activeFrameOption.colors.map((c: string) => (
                            <option key={c} value={c}>{String(c)}</option>
                          ))}
                        </select>
                      )}
                      {activeFrameOption.hasLandscape && (
                        <button
                          type="button"
                          onClick={() => {
                            setFrameConfigByCategory((prev) => ({
                              ...prev,
                              [frameCategory]: normalizeFrameConfig(frameCategory, {
                                ...prev[frameCategory],
                                landscape: !prev[frameCategory]?.landscape,
                              }),
                            }))
                          }}
                          className={`px-2 py-1 text-xs rounded border ${activeFrameConfig.landscape ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                        >
                          {activeFrameConfig.landscape ? 'Landscape' : 'Portrait'}
                        </button>
                      )}
                      <div className="h-16 rounded border border-dashed border-gray-300 dark:border-[#30363d] flex items-center justify-center">
                        <div className={`transition-all ${effectiveDeviceFrameEnabled ? 'w-20 h-10' : 'w-16 h-8'} border ${effectiveDeviceFrameEnabled ? 'border-gray-900 dark:border-gray-100' : 'border-gray-400'} bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#161b22] dark:to-[#1f2937]`} />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 dark:text-gray-400">Frame controls are hidden in freeform mode because the viewport fills available space.</div>
                  )}
                </section>

                <section className="rounded border border-gray-200 dark:border-[#30363d] p-3">
                  <h3 className="text-sm font-semibold mb-1 text-gray-900 dark:text-gray-100">Canvas FX</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">Debug visual helpers for alignment and spacing checks.</p>
                  {!previewMode && (
                    <div className="space-y-2">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                        <span>Canvas color</span>
                        <input
                          type="color"
                          value={canvasBgColor}
                          onChange={(e) => setCanvasBgColor(e.target.value)}
                          className="h-6 w-8 cursor-pointer rounded border border-gray-300 dark:border-[#30363d] bg-transparent p-0"
                        />
                      </label>
                      <div className="h-14 rounded border border-gray-200 dark:border-[#30363d] overflow-hidden" style={{ backgroundColor: canvasBgColor }} />
                      <button
                        type="button"
                        onClick={() => setShowCanvasMesh((v) => !v)}
                        className={`px-2 py-1 text-xs rounded border ${showCanvasMesh ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                      >
                        Mesh {showCanvasMesh ? 'On' : 'Off'}
                      </button>
                      <div
                        className="h-14 rounded border border-gray-200 dark:border-[#30363d]"
                        style={{
                          backgroundImage: showCanvasMesh
                            ? 'radial-gradient(circle, rgba(0,0,0,0.14) 1px, transparent 1.1px), radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1.1px)'
                            : 'linear-gradient(135deg, rgba(148,163,184,0.15), rgba(148,163,184,0.02))',
                          backgroundSize: showCanvasMesh ? '20px 20px, 80px 80px' : 'auto',
                          backgroundPosition: showCanvasMesh ? '0 0, 10px 10px' : 'center',
                        }}
                      />
                    </div>
                  )}
                  {previewMode && <div className="text-xs text-gray-500 dark:text-gray-400">Mesh and canvas-color overlays are editor-only so exported preview remains clean.</div>}
                </section>

                <section className="rounded border border-gray-200 dark:border-[#30363d] p-3">
                  <h3 className="text-sm font-semibold mb-1 text-gray-900 dark:text-gray-100">Preview Runtime</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">Theme and API behavior for runtime simulation.</p>
                  <div className="space-y-2">
                    {!previewMode && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCanvasExpanded((v) => !v)}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded border ${canvasExpanded ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                        >
                          {canvasExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                          {canvasExpanded ? 'Collapse canvas' : 'Expand canvas'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLayoutInspector((v) => !v)}
                          className={`ml-2 px-2 py-1 text-xs rounded border ${showLayoutInspector ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                        >
                          Layout {showLayoutInspector ? 'On' : 'Off'}
                        </button>
                      </>
                    )}
                    {previewMode && (
                      <>
                        <button
                          type="button"
                          onClick={() => setApiLiveRefreshEnabled((v) => !v)}
                          className={`px-2 py-1 text-xs rounded border ${apiLiveRefreshEnabled ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                          title={apiLiveRefreshEnabled ? 'Disable external API auto-refresh while in preview' : 'Enable external API auto-refresh while in preview'}
                        >
                          API Live {apiLiveRefreshEnabled ? 'On' : 'Off'}
                        </button>
                        <div className="flex items-center gap-1 pt-1">
                          <span className="text-xs text-gray-500">Theme:</span>
                          <button
                            type="button"
                            onClick={() => setPreviewTheme('light')}
                            className={`p-1.5 rounded border ${previewTheme === 'light' ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white border-gray-300 dark:border-gray-500' : 'border-gray-200 dark:border-[#30363d] text-gray-500 hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                            title="Light"
                          >
                            <Sun className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewTheme('dark')}
                            className={`p-1.5 rounded border ${previewTheme === 'dark' ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-200 dark:border-[#30363d] text-gray-500 hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                            title="Dark"
                          >
                            <Moon className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {orgResourceBrowserOpen && (
        <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/55" onClick={(e) => { if (e.target === e.currentTarget) setOrgResourceBrowserOpen(false) }}>
          <div className="w-[1100px] max-w-[calc(100vw-1.5rem)] max-h-[86vh] overflow-hidden rounded-lg border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117] shadow-2xl flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-[#30363d] flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Organization resource browser</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Browse org reusables, usage maps, assets, API sources, and databases across projects.</div>
              </div>
              <button type="button" onClick={() => setOrgResourceBrowserOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-3 border-b border-gray-200 dark:border-[#30363d] grid grid-cols-1 md:grid-cols-[1fr_240px_auto] gap-2">
              <input
                value={orgResourceSearch}
                onChange={(e) => setOrgResourceSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void fetchOrgResourceCatalog(orgResourceSearch, orgResourceProjectFilter) }}
                placeholder="Search reusable names, screens, assets, APIs, tables..."
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] rounded bg-white dark:bg-[#161b22] text-black dark:text-white"
              />
              <select
                value={orgResourceProjectFilter}
                onChange={(e) => {
                  const next = e.target.value
                  setOrgResourceProjectFilter(next)
                  void fetchOrgResourceCatalog(orgResourceSearch, next)
                }}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] rounded bg-white dark:bg-[#161b22] text-black dark:text-white"
              >
                <option value="">All projects</option>
                {(orgResourceCatalog?.projects ?? []).map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void fetchOrgResourceCatalog(orgResourceSearch, orgResourceProjectFilter)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d]"
              >
                Refresh
              </button>
            </div>

            {orgResourceCatalog?.permissions?.canManageOrgResources && (
              <div className="px-4 py-2 border-b border-gray-200 dark:border-[#30363d] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-200">Member data sharing rule</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">When disabled, only admins can browse and import shared data resources (APIs, databases, and assets).</div>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={Boolean(orgResourceCatalog.rules?.memberDataSharingEnabled)}
                    disabled={orgRuleSaving}
                    onChange={(e) => void updateOrgMemberDataSharingRule(e.target.checked)}
                  />
                  Members can reuse data
                </label>
              </div>
            )}

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {orgResourceCatalogLoading && <div className="text-sm text-gray-500 dark:text-gray-300">Loading organization resources...</div>}
              {orgResourceCatalogError && <div className="text-sm text-rose-600 dark:text-rose-300">{orgResourceCatalogError}</div>}

              {orgResourceCatalog && !orgResourceCatalogLoading && !orgResourceCatalogError && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
                    <div className="rounded border border-gray-200 dark:border-[#30363d] p-2"><div className="text-[11px] text-gray-500">Projects</div><div className="text-sm font-semibold">{orgResourceCatalog.summary.projectCount}</div></div>
                    <div className="rounded border border-gray-200 dark:border-[#30363d] p-2"><div className="text-[11px] text-gray-500">Org reusables</div><div className="text-sm font-semibold">{orgResourceCatalog.summary.orgReusableCount}</div></div>
                    <div className="rounded border border-gray-200 dark:border-[#30363d] p-2"><div className="text-[11px] text-gray-500">Reusable refs</div><div className="text-sm font-semibold">{orgResourceCatalog.summary.reusableReferenceCount}</div></div>
                    <div className="rounded border border-gray-200 dark:border-[#30363d] p-2"><div className="text-[11px] text-gray-500">Assets</div><div className="text-sm font-semibold">{orgResourceCatalog.summary.assetCount}</div></div>
                    <div className="rounded border border-gray-200 dark:border-[#30363d] p-2"><div className="text-[11px] text-gray-500">API sources</div><div className="text-sm font-semibold">{orgResourceCatalog.summary.apiSourceCount}</div></div>
                    <div className="rounded border border-gray-200 dark:border-[#30363d] p-2"><div className="text-[11px] text-gray-500">Databases</div><div className="text-sm font-semibold">{orgResourceCatalog.summary.datasourceCount}</div></div>
                    <div className="rounded border border-gray-200 dark:border-[#30363d] p-2"><div className="text-[11px] text-gray-500">Tables</div><div className="text-sm font-semibold">{orgResourceCatalog.summary.tableCount}</div></div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <section className="rounded border border-gray-200 dark:border-[#30363d] p-3">
                      <h3 className="text-sm font-semibold mb-2">Organization reusables</h3>
                      <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
                        {orgResourceCatalog.reusables.organization.length === 0 && <div className="text-xs text-gray-500">No reusables found.</div>}
                          {orgResourceCatalog.reusables.organization.map((item) => {
                            const importing = importingOrgReusableIds.includes(item.id)
                            return (
                              <div key={item.id} className="rounded border border-gray-200 dark:border-[#30363d] px-2 py-1.5 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="font-medium text-gray-800 dark:text-gray-100 truncate">{item.name}</div>
                                    <div className="text-[11px] text-gray-500 truncate">
                                      From {item.sourceProjectName ?? 'Unknown project'}
                                      {item.sourceOwnerName ? ` • Owner: ${item.sourceOwnerName}` : ''}
                                    </div>
                                  </div>
                                  <span className="text-gray-500 truncate">{item.id}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    disabled={importing}
                                    onClick={() => void importOrgReusableIntoProject(item, false)}
                                    className={`text-[11px] px-2 py-0.5 border border-gray-300 dark:border-[#30363d] rounded ${importing ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                                  >
                                    {importing ? 'Importing...' : 'Add to this project'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={importing}
                                    onClick={() => void importOrgReusableIntoProject(item, true)}
                                    className={`text-[11px] px-2 py-0.5 border border-gray-300 dark:border-[#30363d] rounded ${importing ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                                  >
                                    Insert now
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </section>

                    <section className="rounded border border-gray-200 dark:border-[#30363d] p-3">
                      <h3 className="text-sm font-semibold mb-2">Reusable usage map</h3>
                      <div className="space-y-2 max-h-56 overflow-auto pr-1">
                        {orgResourceCatalog.reusables.usage.length === 0 && <div className="text-xs text-gray-500">No reusable references found in project screens.</div>}
                        {orgResourceCatalog.reusables.usage.map((entry) => (
                          <div key={entry.reusableId} className="rounded border border-gray-200 dark:border-[#30363d] p-2">
                            <div className="text-xs font-medium text-gray-800 dark:text-gray-100">{entry.reusableName ?? entry.reusableId}</div>
                            <div className="text-[11px] text-gray-500 mb-1">{entry.totalInstances} instances</div>
                            <div className="space-y-1">
                              {entry.usage.slice(0, 4).map((u) => (
                                <div key={`${entry.reusableId}-${u.screenId}`} className="text-[11px] text-gray-600 dark:text-gray-300 truncate">
                                  {u.projectName} / {u.screenName} ({u.instanceCount})
                                </div>
                              ))}
                              {entry.usage.length > 4 && <div className="text-[11px] text-gray-400">+{entry.usage.length - 4} more usages</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="rounded border border-gray-200 dark:border-[#30363d] p-3">
                      <h3 className="text-sm font-semibold mb-2">Project assets</h3>
                      {!orgResourceCatalog.permissions.canViewDataResources && (
                        <div className="text-xs text-amber-600 dark:text-amber-300 mb-2">Data sharing is currently admin-only in this organization.</div>
                      )}
                      <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
                        {orgResourceCatalog.assets.length === 0 && <div className="text-xs text-gray-500">No assets found.</div>}
                        {orgResourceCatalog.assets.map((asset) => (
                          <div key={asset.id} className="rounded border border-gray-200 dark:border-[#30363d] px-2 py-1.5 text-xs">
                            <div className="font-medium text-gray-800 dark:text-gray-100 truncate">{asset.name}</div>
                            <div className="text-gray-500 truncate">{asset.project?.name ?? 'Unknown'} • Owner: {asset.projectOwnerName ?? 'Unknown'} • {asset.mimetype} • {(asset.size / 1024).toFixed(1)} KB</div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="rounded border border-gray-200 dark:border-[#30363d] p-3">
                      <h3 className="text-sm font-semibold mb-2">API sources and databases</h3>
                      <div className="space-y-2 max-h-56 overflow-auto pr-1">
                        <div>
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">API sources</div>
                          <div className="space-y-1">
                            {orgResourceCatalog.apiSources.length === 0 && <div className="text-xs text-gray-500">No API sources found.</div>}
                            {orgResourceCatalog.apiSources.slice(0, 12).map((source) => {
                              const importing = importingApiSourceIds.includes(source.id)
                              return (
                                <div key={source.id} className="rounded border border-gray-200 dark:border-[#30363d] px-2 py-1.5">
                                  <div className="text-[11px] text-gray-700 dark:text-gray-200 truncate">[{source.method}] {source.name}</div>
                                  <div className="text-[11px] text-gray-500 truncate">From {source.project?.name ?? 'Unknown'} • Owner: {source.projectOwnerName ?? 'Unknown'}</div>
                                  <div className="mt-1 flex justify-end">
                                    <button
                                      type="button"
                                      disabled={importing || !orgResourceCatalog.permissions.canViewDataResources}
                                      onClick={() => void importApiSourceFromOrg(source.id, source.name)}
                                      className={`text-[11px] px-2 py-0.5 border border-gray-300 dark:border-[#30363d] rounded ${importing || !orgResourceCatalog.permissions.canViewDataResources ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                                    >
                                      {importing ? 'Linking...' : 'Link API to this project'}
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Databases</div>
                          <div className="space-y-1">
                            {orgResourceCatalog.databases.length === 0 && <div className="text-xs text-gray-500">No internal databases found.</div>}
                            {orgResourceCatalog.databases.slice(0, 8).map((db) => (
                              <div key={db.datasourceId} className="text-[11px] text-gray-600 dark:text-gray-300 truncate">
                                {db.projectName} • Owner: {db.projectOwnerName ?? 'Unknown'}: {db.tableCount} tables
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {editorNotices.length > 0 && (
        <div className="fixed top-4 right-4 z-[140] flex w-[340px] max-w-[calc(100vw-1.5rem)] flex-col gap-2">
          {editorNotices.map((notice) => (
            <div
              key={notice.id}
              className={`rounded-md border px-3 py-2 text-sm shadow-lg backdrop-blur-sm ${notice.kind === 'success' ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800' : notice.kind === 'error' ? 'border-rose-200 bg-rose-50/95 text-rose-800' : 'border-blue-200 bg-blue-50/95 text-blue-800'}`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-current opacity-80" />
                <div className="flex-1">{notice.message}</div>
                <button
                  type="button"
                  onClick={() => dismissEditorNotice(notice.id)}
                  className="text-current/70 transition hover:text-current"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Insert reusable props modal */}
      {pendingInsert && (() => {
        const schema = pendingInsert.schema ?? []
        const hasRequired = schema.some((e) => e.required && !pendingInsert.vals[e.key])
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) { setPendingInsert(null); setBindingForInsertProp(null) } }}>
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded-lg shadow-xl w-[420px] max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#30363d]">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Configure props</span>
                <button type="button" onClick={() => { setPendingInsert(null); setBindingForInsertProp(null) }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-3">
                {schema.map((entry) => {
                  const curVal = pendingInsert.vals[entry.key] ?? ''
                  const isBound = curVal.startsWith('{{') && curVal.endsWith('}}')
                  const bindingOpen = bindingForInsertProp === entry.key
                  return (
                    <div key={entry.key} className="relative">
                      <label className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                        {entry.key}
                        {entry.required && <span className="text-red-500">*</span>}
                        <span className="text-gray-400 font-normal">({entry.type})</span>
                        {entry.type !== 'boolean' && (
                          <button
                            type="button"
                            onClick={() => setBindingForInsertProp(bindingOpen ? null : entry.key)}
                            className={`ml-auto p-0.5 rounded ${isBound ? 'text-amber-500' : 'text-gray-400 hover:text-purple-500'}`}
                            title="Bind to state, data, or prop"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                          </button>
                        )}
                      </label>
                      {bindingOpen && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-1 p-2 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] rounded shadow-lg">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Bind to</div>
                          <select
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white rounded"
                            defaultValue=""
                            onChange={(e) => {
                              const v = e.target.value
                              let token = ''
                              if (v.startsWith('state:')) token = `{{state.${v.slice(6)}}}`
                              else if (v.startsWith('gstate:')) token = `{{globalState.${v.slice(7)}}}`
                              else if (v.startsWith('data:')) token = `{{data.${v.slice(5)}.field}}`
                              if (token) setPendingInsert((p) => p ? { ...p, vals: { ...p.vals, [entry.key]: token } } : p)
                              setBindingForInsertProp(null)
                            }}
                          >
                            <option value="">Select…</option>
                            {stateDefinitions.filter((s) => s.name.trim()).map((s) => (
                              <option key={s.id} value={`state:${s.name}`}>State: {s.name}</option>
                            ))}
                            {globalStateDefinitions.filter((s) => s.name.trim()).map((s) => (
                              <option key={s.id} value={`gstate:${s.name}`}>Global state: {s.name}</option>
                            ))}
                            {dataSources.filter((d) => d.name.trim()).map((d) => (
                              <option key={d.id} value={`data:${d.name}`}>Data: {d.name}</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => setBindingForInsertProp(null)} className="mt-1.5 text-xs text-gray-500 hover:text-gray-700">Close</button>
                        </div>
                      )}
                      {entry.type === 'boolean' ? (
                        <select
                          value={curVal}
                          onChange={(e) => setPendingInsert((p) => p ? { ...p, vals: { ...p.vals, [entry.key]: e.target.value } } : p)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white rounded"
                        >
                          <option value="">— choose —</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          type={entry.type === 'number' && !isBound ? 'number' : 'text'}
                          value={curVal}
                          onChange={(e) => setPendingInsert((p) => p ? { ...p, vals: { ...p.vals, [entry.key]: e.target.value } } : p)}
                          placeholder={entry.type === 'number' ? '0 or {{state.x}}' : '{{state.x}} or literal'}
                          className={`w-full px-2 py-1.5 text-sm border rounded font-mono ${isBound ? 'border-amber-400 dark:border-amber-500' : 'border-gray-300 dark:border-[#30363d]'} bg-white dark:bg-[#0d1117] text-black dark:text-white`}
                          autoFocus={schema.indexOf(entry) === 0}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-[#30363d]">
                <button type="button" onClick={() => setPendingInsert(null)} className="text-sm px-3 py-1.5 border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-50 dark:hover:bg-[#21262d]">Cancel</button>
                <button
                  type="button"
                  disabled={hasRequired}
                  onClick={() => {
                    const props: Record<string, unknown> = {}
                    ;(pendingInsert.schema ?? []).forEach((e) => {
                      const raw = pendingInsert.vals[e.key] ?? ''
                      if (raw === '') return
                      props[e.key] = e.type === 'number' ? Number(raw) : e.type === 'boolean' ? raw === 'true' : raw
                    })
                    doInsertReusable(pendingInsert.reusableId, props)
                    setPendingInsert(null)
                  }}
                  className="text-sm px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded disabled:opacity-40"
                >Insert</button>
              </div>
            </div>
          </div>
        )
      })()}
      {/* Modal screen overlay — shown when a navigate action targets a modal-type screen */}
      {previewMode && modalRoot && (() => {
        const mThemeVars = modalTheme ? {
          ['--primary' as string]: modalTheme.primary ?? '#000',
          ['--background' as string]: modalTheme.background ?? '#fff',
          ['--text' as string]: modalTheme.text ?? '#000',
          ['--surface' as string]: modalTheme.surface ?? '#fff',
          ['--border-color' as string]: modalTheme.borderColor ?? '#e5e7eb',
          ['--border-radius' as string]: modalTheme.borderRadius ?? '0px',
          ['--border-radius-sm' as string]: modalTheme.borderRadiusSm ?? '0px',
          ['--border-radius-lg' as string]: modalTheme.borderRadiusLg ?? '0px',
          ['--border-radius-full' as string]: isZeroBorderRadius(modalTheme.borderRadius) ? '0px' : '9999px',
        } : {}
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(e) => { if (e.target === e.currentTarget) { setModalScreenId(null); modalScreenIdRef.current = null } }}
          >
            <div
              className={previewTheme === 'dark' ? 'dark' : ''}
              style={{ position: 'relative', width: '80%', maxWidth: 700, height: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: modalTheme?.background ?? '#fff', ...mThemeVars }}
            >
              <button
                onClick={() => { setModalScreenId(null); modalScreenIdRef.current = null }}
                style={{ position: 'absolute', top: 10, right: 14, zIndex: 1, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', opacity: 0.5, lineHeight: 1, color: 'var(--text)' }}
              >✕</button>
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--background)', color: 'var(--text)' }}>
                <BuilderCanvas
                  root={modalRoot}
                  selectedId={null}
                  onSelect={() => {}}
                  onUpdate={() => {}}
                  previewMode={true}
                  resolveBinding={(raw, propsCtx) => resolveExpression(raw, { state: runtimeState, data: runtimeData, runScript, navProp: modalNavProps, props: propsCtx })}
                  theme={modalTheme}
                  previewTheme={previewTheme}
                  onRunEvent={handleRunEvent}
                  reusables={globalReusables}
                  runtimePendingSources={runtimePendingSources}
                  runtimeResolvedSources={runtimeResolvedSources}
                />
              </div>
            </div>
          </div>
        )
      })()}
      <PackageManager
        open={packageManagerOpen}
        onClose={() => setPackageManagerOpen(false)}
        orgId={orgId ?? null}
        projectId={projectId}
        globalReusables={globalReusables}
        onInstall={(reusable) => {
          const nextReusables = [...globalReusables, reusable]
          persistGlobals({ globalReusables: nextReusables })
          setPackageManagerOpen(false)
        }}
      />
      <Dialog open={collaboratorsDialogOpen} onOpenChange={setCollaboratorsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Active Collaborators</DialogTitle>
            <DialogDescription>
              People currently online in this project.
            </DialogDescription>
          </DialogHeader>

          {collaboratorsForDialog.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 py-2">No active collaborators right now.</div>
          ) : (
            <div className="max-h-[50vh] overflow-auto space-y-2 pr-1">
              {collaboratorsForDialog.map((p) => {
                const id = p.clientId || p.userId
                const color = colorForPresence(id)
                const label = p.name || p.userId
                const currentScreenName = p.screenId ? String((screenById.get(p.screenId) as any)?.name ?? p.screenId) : null
                const status = p.screenId === screenId
                  ? 'Editing this screen'
                  : p.screenId
                    ? `Editing ${currentScreenName}`
                    : 'Online in project'

                return (
                  <div key={`active-collab-${id}`} className="flex items-start gap-3 border border-gray-200 dark:border-[#30363d] p-2">
                    <div
                      className="h-8 w-8 border-2 border-white dark:border-[#0d1117] text-xs font-semibold text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {initialsForPresence(p.name, p.userId)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{status}</div>
                      {p.selectionId && p.screenId === screenId && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Selecting: {p.selectionId}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
