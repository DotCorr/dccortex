/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useState, useCallback, useEffect, useRef, useMemo, useLayoutEffect } from 'react'
import { flushSync } from 'react-dom'
import { useWebHaptics } from 'web-haptics/react'
import { Save, Eye, X, Sun, Moon, RefreshCw, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Minimize2, ExternalLink, SlidersHorizontal, Code2, LayoutGrid, Layers, Database, Terminal } from 'lucide-react'
import { DeviceFrameset, DeviceOptions } from 'react-device-frameset'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ComponentPalette } from '@/components/builder/ComponentPalette'
import { BuilderCanvas } from '@/components/builder/BuilderCanvas'
import { resolveBinding, resolveExpression, getDateNowMap } from '@dccortex/runtime-kernel'
import { DebugConsole, type DebugConsoleHandle, type ApiLogEntry } from '@/components/builder/DebugConsole'
import { executeAnimationSequence, clearAnimationSequence } from '@dccortex/runtime-kernel'
import { PropertyPanel } from '@/components/builder/PropertyPanel'
import { NodeTree } from '@/components/builder/NodeTree'
import { ResizablePanelLayout } from '@/components/builder/ResizablePanel'
import { GlobalReusablesPane } from '@/components/builder/GlobalReusablesPane'
import { createNode, getComponentDef, type Node } from '@/components/builder/registry'
import type { StateDefinition, DataSourceDef, ScreenTheme, SeoSettings, CustomTypeDef } from '@/components/builder/PropertyPanel'
import type { EventActionConfig, EventRuntimeContext } from '@dccortex/runtime-kernel'
import type { AnimationSequenceConfig } from '@dccortex/runtime-kernel';
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
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const orgId = params.id as string
  const projectId = params.projectId as string
  const screenId = params.screenId as string

  // If screenId is not a real UUID, redirect to the screens list immediately
  // before making any API calls. This handles stale /screens/new/edit URLs.
  const isValidScreenId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(screenId)
  useEffect(() => {
    if (!isValidScreenId) {
      router.replace(`/organizations/${orgId}/projects/${projectId}/screens`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Prevent hydration mismatches by rendering a stable placeholder on the first paint
  // (server + initial client render) and only mounting the full editor UI after mount.
  useEffect(() => {
    setMounted(true)
  }, [])
  const [root, setRoot] = useState<Node>(defaultLayout)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [leftPanelTab, setLeftPanelTab] = useState<'layers' | 'screens'>('layers')
  // Keep initial render deterministic for SSR hydration; hydrate from storage in effects below.
  const [previewMode, setPreviewMode] = useState(false)
  const [runtimeData, setRuntimeData] = useState<Record<string, unknown>>({})
  const [runtimePendingSources, setRuntimePendingSources] = useState<string[]>([])
  const [previewSize, setPreviewSize] = useState<PreviewViewport>('desktop')
  const [canvasZoom, setCanvasZoom] = useState(1)
  const ZOOM_STEP = 0.1
  const ZOOM_MIN = 0.25
  const ZOOM_MAX = 3
  const [canvasBgColor, setCanvasBgColor] = useState('#f3f4f6')
  const [showCanvasMesh, setShowCanvasMesh] = useState(false)
  const [canvasExpanded, setCanvasExpanded] = useState(false)
  const [devSettingsOpen, setDevSettingsOpen] = useState(false)
  const [deviceFrameEnabled, setDeviceFrameEnabled] = useState(true)
  const [frameConfigByCategory, setFrameConfigByCategory] = useState<Record<FrameCategory, FrameConfig>>(DEFAULT_FRAME_CONFIG_BY_CATEGORY)
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light')
  const [apiLiveRefreshEnabled, setApiLiveRefreshEnabled] = useState(true)
  const [showLayoutInspector, setShowLayoutInspector] = useState(true)
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
  const [showGeneratedSource, setShowGeneratedSource] = useState(false)
  const [generatedSource, setGeneratedSource] = useState('')
  const [generatedSourceWarnings, setGeneratedSourceWarnings] = useState<string[]>([])
  const [generatedSourceLoading, setGeneratedSourceLoading] = useState(false)
  const [generatedSourceError, setGeneratedSourceError] = useState<string | null>(null)
  const [generatedSourceNodeCount, setGeneratedSourceNodeCount] = useState<number | null>(null)
  const [generatedSourceCached, setGeneratedSourceCached] = useState(false)
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
  const generatedSourceUrl = useMemo(() => `/api/projects/${projectId}/screens/${screenId}/nextjs-source`, [projectId, screenId])
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
  const generatedSourceRequestIdRef = useRef(0)

  const fetchGeneratedSource = useCallback(async (force = false) => {
    if (!projectId || !screenId) return
    const requestId = ++generatedSourceRequestIdRef.current
    setGeneratedSourceLoading(true)
    setGeneratedSourceError(null)
    try {
      const response = await axios.get(generatedSourceUrl, {
        params: force ? { t: Date.now() } : undefined,
      })
      if (requestId !== generatedSourceRequestIdRef.current) return
      const data = response.data as {
        source?: string
        warnings?: string[]
        nodeCount?: number
        cached?: boolean
      }
      setGeneratedSource(typeof data.source === 'string' ? data.source : '')
      setGeneratedSourceWarnings(Array.isArray(data.warnings) ? data.warnings.map((w) => String(w)) : [])
      setGeneratedSourceNodeCount(typeof data.nodeCount === 'number' ? data.nodeCount : null)
      setGeneratedSourceCached(Boolean(data.cached))
    } catch (err: any) {
      if (requestId !== generatedSourceRequestIdRef.current) return
      const msg = err?.response?.data?.error || err?.message || 'Failed to generate interpolated source'
      setGeneratedSourceError(msg)
    } finally {
      if (requestId === generatedSourceRequestIdRef.current) setGeneratedSourceLoading(false)
    }
  }, [generatedSourceUrl, projectId, screenId])

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

  useEffect(() => {
    if (previewMode && showGeneratedSource) setShowGeneratedSource(false)
  }, [previewMode, showGeneratedSource])

  useEffect(() => {
    if (!showGeneratedSource || previewMode) return
    const t = setTimeout(() => {
      void fetchGeneratedSource()
    }, 200)
    return () => clearTimeout(t)
  }, [showGeneratedSource, previewMode, lastSyncedAt, fetchGeneratedSource])

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
        if (typeof parsed.canvasBgColor === 'string' && parsed.canvasBgColor.trim()) setCanvasBgColor(parsed.canvasBgColor)
        if (typeof parsed.showCanvasMesh === 'boolean') setShowCanvasMesh(parsed.showCanvasMesh)
        if (typeof parsed.deviceFrameEnabled === 'boolean') setDeviceFrameEnabled(parsed.deviceFrameEnabled)
        if (typeof parsed.canvasExpanded === 'boolean') setCanvasExpanded(parsed.canvasExpanded)
        if (typeof parsed.canvasZoom === 'number' && Number.isFinite(parsed.canvasZoom)) {
          setCanvasZoom(Math.min(3, Math.max(0.25, parsed.canvasZoom)))
        }
        if (parsed.frameConfigByCategory) {
          setFrameConfigByCategory({
            mobile: normalizeFrameConfig('mobile', parsed.frameConfigByCategory.mobile),
            tablet: normalizeFrameConfig('tablet', parsed.frameConfigByCategory.tablet),
            desktop: normalizeFrameConfig('desktop', parsed.frameConfigByCategory.desktop),
          })
        }
        if (parsed.previewSize === 'mobile' || parsed.previewSize === 'tablet' || parsed.previewSize === 'desktop' || parsed.previewSize === 'freeform') {
          setPreviewSize(parsed.previewSize)
        }
      }
    } catch {}
    setPreviewSettingsLoaded(true)
  }, [previewSettingsKey])

  useEffect(() => {
    if (!previewSettingsLoaded) return
    const state: StoredPreviewSettings = {
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
    }
    try {
      window.localStorage.setItem(previewSettingsKey, JSON.stringify(state))
    } catch {}
  }, [
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
    previewSettingsKey,
    previewSettingsLoaded,
  ])

  useEffect(() => {
    const handleResize = () => {
      if (canvasStageRef.current) {
        setCanvasStageSize({
          width: canvasStageRef.current.offsetWidth,
          height: canvasStageRef.current.offsetHeight,
        })
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [panelWidthsVersion])

  useEffect(() => {
    const scaleX = canvasStageSize.width / fitLogicalSize.width
    const scaleY = canvasStageSize.height / fitLogicalSize.height
    setCanvasFitScale(Math.min(scaleX, scaleY))
  }, [canvasStageSize, fitLogicalSize])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSystemDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  const effectiveTheme = useMemo(() => {
    const base = previewTheme === 'dark' ? { background: '#111827', text: '#f9fafb', surface: '#1f2937', borderColor: '#374151' } : {}
    return { ...base, ...theme }
  }, [theme, previewTheme])

  const {
    data: screenPayload,
    isLoading: screenIsLoading,
    error: screenError,
  } = useQuery<ScreenLayoutPayload>({
    queryKey: ['screenLayout', projectId, screenId],
    queryFn: async () => {
      const { data } = await axios.get(`/api/projects/${projectId}/screens/${screenId}/edit-payload`)
      return data
    },
    enabled: !!screenId && isValidScreenId,
    refetchOnWindowFocus: false,
    retry: (count, error) => {
      const status = (error as any)?.response?.status
      return typeof status !== 'number' || status >= 500
    },
  })

  useEffect(() => {
    if (screenPayload) {
      setRoot(screenPayload.root || defaultLayout)
      setStateDefinitions(screenPayload.stateDefinitions || [])
      setDataSources(screenPayload.dataSources || [])
      setNamedScripts(screenPayload.namedScripts || {})
      setTheme(screenPayload.theme || DEFAULT_THEME)
      setScreenPresentation(screenPayload.presentation || 'page')
      setScreenPropDefs(screenPayload.screenPropDefs || [])
      setCustomTypes(screenPayload.customTypes || [])
      setAiProtected(screenPayload.aiProtected || false)
    }
  }, [screenPayload])

  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => (await axios.get(`/api/projects/${projectId}`)).data,
  })

  const { data: screenData } = useQuery({
    queryKey: ['screen', screenId],
    queryFn: async () => (await axios.get(`/api/projects/${projectId}/screens/${screenId}`)).data,
    enabled: !!screenId && isValidScreenId,
    retry: (count, error) => {
      const status = (error as any)?.response?.status
      return typeof status !== 'number' || status >= 500
    },
  })

  // If the screen cannot be loaded (404 or any error), redirect back to the
  // screens list so the redirect page can pick the correct screen (or create one).
  useEffect(() => {
    if (!screenError) return
    const status = (screenError as any)?.response?.status
    const message = String((screenError as Error)?.message ?? '')
    if (status === 404 || message.includes('404')) {
      router.replace(`/organizations/${orgId}/projects/${projectId}/screens`)
    }
  }, [screenError, orgId, projectId, router])

  const { data: orgData } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => (await axios.get(`/api/organizations/${orgId}`)).data,
    enabled: !!orgId,
  })

  const handleNodeSelect = (nodeId: string | null) => {
    if (editingReusableId) {
      setReusableSelectedId(nodeId)
    } else {
      setSelectedId(nodeId)
    }
  }

  const handleMoveNode = (nodeId: string, newParentId: string, index: number) => {
    const newRoot = moveNodeInTree(root, nodeId, newParentId, index)
    setRoot(newRoot)
  }

  const handleDeleteNode = (nodeId: string) => {
    const newRoot = deleteNodeInTree(root, nodeId)
    setRoot(newRoot)
  }

  const handleDuplicateNode = (nodeId: string) => {
    const path = getPathToNode(root, nodeId)
    if (!path) return
    const nodeToClone = path[path.length - 1]
    const parent = path.length > 1 ? path[path.length - 2] : root
    const cloned = cloneNodeWithFreshIds(nodeToClone)
    const newRoot = insertNodeIntoParent(root, parent.id, cloned)
    setRoot(newRoot)
    setSelectedId(cloned.id)
  }

  const handleAddComponent = (type: string) => {
    const newNode = createNode(type)
    const newRoot = insertNodeIntoParent(root, 'root', newNode)
    setRoot(newRoot)
    setSelectedId(newNode.id)
  }

  const mutation = useMutation({
    mutationFn: (newLayout: ScreenLayoutPayload) => {
      return axios.put(
        `/api/projects/${projectId}/screens/${screenId}`,
        newLayout
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenLayout', projectId, screenId] })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    },
    onError: () => {
      setSaveStatus('idle')
    },
  })

  const handleSave = () => {
    setSaveStatus('saving')
    const payload: ScreenLayoutPayload = {
      root,
      stateDefinitions,
      dataSources,
      namedScripts,
      theme,
      presentation: screenPresentation,
      seoSettings,
      screenPropDefs,
      customTypes,
      aiProtected,
    }
    mutation.mutate(payload)
  }

  const handleExecuteEvent = () => {
    // This will be implemented later
  }

  if (!mounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900" />
    )
  }

  if (!isValidScreenId || screenIsLoading || screenError) {
    return null
  }

  const selectedNode = selectedId ? findNode(root, selectedId) : null
  const screen = screenData?.screen
  const project = projectData?.project
  const org = orgData?.organization

  return (
    <DashboardLayout hideSidebar>
      <div className="h-screen overflow-hidden flex flex-col bg-white dark:bg-[#0d1117]">
        <div className="shrink-0 h-12 border-b border-gray-200 dark:border-[#30363d] px-3 flex items-center gap-3 select-none">
          <div className="flex items-center gap-2 mr-1">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-gray-300 dark:bg-gray-700" />
              <div className="h-2.5 w-2.5 rounded-full bg-gray-300 dark:bg-gray-700" />
              <div className="h-2.5 w-2.5 rounded-full bg-gray-300 dark:bg-gray-700" />
            </div>
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
              DCCortex / {project?.name ?? 'Project'} / {screen?.name ?? 'Screen'}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeviceFrameEnabled(!deviceFrameEnabled)}>
              {deviceFrameEnabled ? 'Frame On' : 'Frame Off'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCanvasExpanded(!canvasExpanded)}>
              {canvasExpanded ? 'Collapse' : 'Expand'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCanvasZoom(1)}>
              {Math.round(canvasZoom * 100)}%
            </Button>
            <Button variant="outline" size="sm" onClick={() => { /* reserved: background mode */ }}>
              Canvas
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCanvasMesh(!showCanvasMesh)}>
              {showCanvasMesh ? 'Mesh On' : 'Mesh Off'}
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex">
          {/* Far-left icon sidebar */}
          <div className="shrink-0 w-12 border-r border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117] flex flex-col items-center py-2 gap-2">
            {[
              { id: 'components', icon: LayoutGrid, label: 'Components' },
              { id: 'layers', icon: Layers, label: 'Layers' },
              { id: 'symbols', icon: LayoutGrid, label: 'Symbols' },
              { id: 'data', icon: Database, label: 'Data' },
              { id: 'console', icon: Terminal, label: 'Console' },
            ].map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  className="h-9 w-9 rounded-md border border-gray-200 dark:border-[#30363d] bg-gray-50 dark:bg-[#161b22] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#21262d] flex items-center justify-center"
                  title={item.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              )
            })}
            <div className="mt-auto" />
          </div>

          <ResizablePanelLayout
            leftTree={
              <div className="h-full min-h-0 flex flex-col">
                <div className="shrink-0 h-10 px-3 flex items-center border-b border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22]">
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-gray-500 dark:text-gray-400 uppercase">Layers</div>
                </div>
                <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-[#161b22]">
                  <NodeTree
                    root={root}
                    selectedId={selectedId}
                    onSelect={handleNodeSelect}
                    onMove={handleMoveNode}
                    onDelete={handleDeleteNode}
                  />
                </div>
                <div className="shrink-0 border-t border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] p-3">
                  <div className="text-[11px] font-semibold tracking-[0.14em] text-gray-500 dark:text-gray-400 uppercase mb-2">Reusable Components</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(globalReusables.length ? globalReusables.slice(0, 8).map((r) => r.name) : ['Card/KPI', 'Table/Compact', 'Chart/Area']).map((name) => (
                      <span key={name} className="px-2 py-1 rounded-md border border-gray-200 dark:border-[#30363d] text-[11px] text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-[#0d1117]">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            }
            leftPalette={
              <ComponentPalette onAddComponent={handleAddComponent} scrollStorageKey={paletteScrollStorageKey} />
            }
            center={
              <div className="flex h-full flex-col bg-gray-100 dark:bg-gray-900" ref={canvasStageRef}>
                {/* Canvas toolbar (Viewport/Desktop, Fit, Guides) */}
                <div className="shrink-0 h-10 border-b border-gray-200/70 dark:border-[#30363d] px-3 flex items-center gap-2 bg-white/70 dark:bg-[#0d1117]/70 backdrop-blur">
                  <div className="inline-flex rounded-md border border-gray-200 dark:border-[#30363d] overflow-hidden">
                    <button
                      type="button"
                      className={`px-2.5 py-1 text-[11px] ${previewMode ? 'bg-gray-100 dark:bg-[#161b22]' : 'bg-black text-white dark:bg-white dark:text-black'}`}
                      onClick={() => setPreviewMode(false)}
                    >
                      Viewport
                    </button>
                    <button
                      type="button"
                      className={`px-2.5 py-1 text-[11px] ${previewMode ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-gray-100 dark:bg-[#161b22] text-gray-700 dark:text-gray-200'}`}
                      onClick={() => setPreviewMode(true)}
                    >
                      Desktop
                    </button>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCanvasZoom(1)}>Fit</Button>
                    <Button variant="outline" size="sm" onClick={() => setShowLayoutInspector((v) => !v)}>Guides</Button>
                  </div>
                </div>

                <div className="relative flex-1 min-h-0 overflow-hidden">
                  <BuilderCanvas
                    root={root}
                    selectedId={selectedId}
                    onSelect={handleNodeSelect}
                    onUpdate={setRoot}
                    onMove={handleMoveNode}
                    previewMode={previewMode}
                    onRunEvent={handleExecuteEvent}
                    theme={effectiveTheme}
                  />

                  {/* Bottom zoom control (visual parity with screenshot) */}
                  <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-md border border-gray-200 dark:border-[#30363d] bg-white/80 dark:bg-[#0d1117]/80 backdrop-blur px-2 py-1">
                    <button
                      type="button"
                      className="text-xs text-gray-700 dark:text-gray-200 px-1"
                      onClick={() => setCanvasZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100))}
                      title="Zoom out"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="text-xs text-gray-700 dark:text-gray-200 tabular-nums"
                      onClick={() => setCanvasZoom(1)}
                      title="Reset zoom"
                    >
                      {Math.round(canvasZoom * 100)}%
                    </button>
                    <button
                      type="button"
                      className="text-xs text-gray-700 dark:text-gray-200 px-1"
                      onClick={() => setCanvasZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100))}
                      title="Zoom in"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            }
            rightPanel={
              <div className="flex h-full flex-col min-h-0">
                <div className="shrink-0 h-12 flex items-center border-b border-gray-200 dark:border-gray-700 px-4 gap-2 bg-white dark:bg-[#161b22]">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Component Props</h2>
                  {selectedNode && (
                    <span className="ml-auto px-2 py-1 rounded-md border border-gray-200 dark:border-[#30363d] text-[11px] bg-gray-50 dark:bg-[#0d1117] text-gray-700 dark:text-gray-200">
                      {String(selectedNode.type ?? '').trim() || 'Component'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                  {selectedNode ? (
                    <PropertyPanel
                      key={selectedNode.id}
                      node={selectedNode}
                      onUpdate={(newProps) => {
                        const newRoot = updateNodeInTree(root, selectedNode.id, (n) => ({ ...n, props: newProps }))
                        setRoot(newRoot)
                      }}
                      stateDefinitions={stateDefinitions}
                      dataSources={dataSources}
                      namedScripts={namedScripts}
                    />
                  ) : (
                    <div className="p-4 text-sm text-gray-500">Select a layer to see its properties.</div>
                  )}
                </div>
                <div className="shrink-0 border-t border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] p-3">
                  <div className="text-[11px] font-semibold tracking-[0.14em] text-gray-500 dark:text-gray-400 uppercase mb-2">AI Assistant</div>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 h-9 rounded-md border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117] px-3 text-sm text-gray-800 dark:text-gray-200"
                      placeholder="Describe what you want to build…"
                    />
                    <Button variant="outline" size="sm" onClick={() => { /* wired via Cortex UI elsewhere */ }}>
                      Send
                    </Button>
                  </div>
                </div>
                <DebugConsole
                  runtimeState={runtimeData}
                  stateDefinitions={stateDefinitions}
                  inspection={inspection}
                  apiLogs={apiLogs}
                  storageKey={debugConsoleStorageKey}
                />
              </div>
            }
            showLeft={true}
            showRight={true}
            storageKey={panelWidthsStorageKey}
            onWidthsChange={() => setPanelWidthsVersion((v) => v + 1)}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
