/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { ChevronDown, ChevronUp, Search, PackagePlus, Pencil, Trash2 } from 'lucide-react'
import type { ReusableDefinition } from './globals'
import { clearBuilderDragPayload, getBuilderDragPayload, setBuilderDragPayload } from './drag-payload'

const TREE_DRAG_TYPE = 'application/x-builder-tree-node'

const STORAGE_KEY = 'builder-global-reusables-pane'

function loadPaneState() {
  if (typeof window === 'undefined') return { collapsed: false, height: 210 }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { collapsed: false, height: 210 }
    const parsed = JSON.parse(raw) as { collapsed?: boolean; height?: number }
    return {
      collapsed: !!parsed.collapsed,
      height: typeof parsed.height === 'number' ? Math.max(120, Math.min(460, parsed.height)) : 210,
    }
  } catch {
    return { collapsed: false, height: 210 }
  }
}

function persistPaneState(next: { collapsed: boolean; height: number }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
}

type Props = {
  reusables: ReusableDefinition[]
  onDropNodeToCreateReusable?: (nodeId: string) => void
  onInsertReusable?: (reusableId: string) => void
  onEditReusable?: (reusableId: string) => void
  onDeleteReusable?: (reusableId: string) => void
  onPromoteReusable?: (reusable: ReusableDefinition) => void
  onRenameReusable?: (id: string, newName: string) => void
  activeReusableId?: string | null
  promotingReusableIds?: string[]
  onBrowseOrgResources?: () => void
}

export function GlobalReusablesPane({ reusables, onDropNodeToCreateReusable, onInsertReusable, onEditReusable, onDeleteReusable, onPromoteReusable, onRenameReusable, activeReusableId = null, promotingReusableIds = [], onBrowseOrgResources }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const startRename = useCallback((r: ReusableDefinition, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingId(r.id)
    setRenameVal(r.name)
    setTimeout(() => renameInputRef.current?.select(), 30)
  }, [])

  const commitRenameFor = useCallback((id: string) => {
    const trimmed = renameVal.trim()
    if (trimmed && onRenameReusable) onRenameReusable(id, trimmed)
    setRenamingId(null)
  }, [renameVal, onRenameReusable])
  const [search, setSearch] = useState('')
  const initial = useMemo(loadPaneState, [])
  const [collapsed, setCollapsed] = useState(initial.collapsed)
  const [height, setHeight] = useState(initial.height)
  const heightRef = useRef(initial.height)
  const [draggingResize, setDraggingResize] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const dropHandledRef = useRef(false)

  useEffect(() => {
    heightRef.current = height
  }, [height])

  useEffect(() => {
    const onDragEnd = () => {
      setIsDragOver(false)
      dropHandledRef.current = false
    }
    window.addEventListener('dragend', onDragEnd)
    return () => window.removeEventListener('dragend', onDragEnd)
  }, [])

  const onDropNodeRef = useRef(onDropNodeToCreateReusable)
  onDropNodeRef.current = onDropNodeToCreateReusable
  useEffect(() => {
    const el = dropZoneRef.current
    if (!el || collapsed) return
    const handleDragOver = (e: DragEvent) => {
      const payload = getBuilderDragPayload()
      const isTreeDrag = !!e.dataTransfer?.types.includes(TREE_DRAG_TYPE) || payload?.kind === 'tree-node'
      if (!isTreeDrag) return
      if (!e.dataTransfer) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      flushSync(() => setIsDragOver(true))
    }
    const handleDrop = (e: DragEvent) => {
      if (!e.dataTransfer) return
      e.preventDefault()
      e.stopPropagation()
      if (dropHandledRef.current) return
      try {
        const raw = e.dataTransfer.getData('application/json')
        const data = raw ? (JSON.parse(raw) as { nodeId?: string }) : null
        const payload = getBuilderDragPayload()
        const nodeId = data?.nodeId || (payload?.kind === 'tree-node' ? payload.nodeId : undefined)
        if (!nodeId) return
        const fn = onDropNodeRef.current
        if (!fn) return
        dropHandledRef.current = true
        setIsDragOver(false)
        fn(String(nodeId))
      } catch {}
    }
    el.addEventListener('dragover', handleDragOver, { capture: true })
    el.addEventListener('drop', handleDrop, { capture: true })
    return () => {
      el.removeEventListener('dragover', handleDragOver, { capture: true })
      el.removeEventListener('drop', handleDrop, { capture: true })
    }
  }, [collapsed])

  const filtered = useMemo(
    () => {
      const s = String(search ?? '').toLowerCase().trim()
      return reusables.filter((r) => String(r.name ?? '').toLowerCase().includes(s))
    },
    [reusables, search]
  )

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    persistPaneState({ collapsed: next, height })
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setDraggingResize(true)
  }

  useEffect(() => {
    if (!draggingResize) return

    const previousUserSelect = document.body.style.userSelect
    const previousWebkitUserSelect = document.body.style.webkitUserSelect
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'

    const onMove = (e: MouseEvent) => {
      if (collapsed) return
      const next = Math.max(120, Math.min(460, height - e.movementY))
      setHeight(next)
    }
    const onUp = () => {
      setDraggingResize(false)
      persistPaneState({ collapsed, height: heightRef.current })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = previousUserSelect
      document.body.style.webkitUserSelect = previousWebkitUserSelect
    }
  }, [collapsed, draggingResize])

  const isTreeNodeDrag = useCallback((e: React.DragEvent) => {
    const payload = getBuilderDragPayload()
    return e.dataTransfer.types.includes(TREE_DRAG_TYPE) || payload?.kind === 'tree-node'
  }, [])

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!isTreeNodeDrag(e)) return
      e.preventDefault()
      e.stopPropagation()
      flushSync(() => setIsDragOver(true))
    },
    [isTreeNodeDrag]
  )

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isTreeNodeDrag(e)) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      setIsDragOver(true)
    },
    [isTreeNodeDrag]
  )

  const onDragLeave = useCallback((e: React.DragEvent) => {
    const zone = dropZoneRef.current
    if (!zone) return
    const related = e.relatedTarget as Node | null
    if (related != null && zone.contains(related)) return
    setIsDragOver(false)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (dropHandledRef.current) return
      try {
        const raw = e.dataTransfer.getData('application/json')
        const data = raw ? (JSON.parse(raw) as { nodeId?: string }) : null
        const payload = getBuilderDragPayload()
        const nodeId = data?.nodeId || (payload?.kind === 'tree-node' ? payload.nodeId : undefined)
        if (!nodeId || !onDropNodeToCreateReusable) return
        dropHandledRef.current = true
        setIsDragOver(false)
        onDropNodeToCreateReusable(String(nodeId))
      } catch {}
    },
    [onDropNodeToCreateReusable]
  )

  return (
    <div className="w-full shrink-0 border-t border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22]">
      <div className="h-1 cursor-row-resize hover:bg-[var(--primary)]/40 select-none" tabIndex={-1} onMouseDown={startResize} />
      <div className="px-3 py-2 border-b border-gray-200 dark:border-[#30363d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleCollapsed} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#21262d]">
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Global Reusables</div>
        </div>
        <div className="flex items-center gap-2">
          {onBrowseOrgResources && (
            <button
              type="button"
              onClick={onBrowseOrgResources}
              className="text-[11px] px-2 py-1 border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d] text-gray-600 dark:text-gray-300"
            >
              Browse org
            </button>
          )}
          <div className="text-xs text-gray-500">{reusables.length}</div>
        </div>
      </div>
      {!collapsed && (
        <div
          ref={dropZoneRef}
          style={{ height }}
          className={`relative p-3 overflow-auto min-h-0 transition-colors duration-150 ${isDragOver ? 'bg-[var(--primary)]/10 ring-2 ring-[var(--primary)] ring-inset' : ''}`}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {/* Overlay always in DOM when pane open: captures drop only when isDragOver so drop always lands here */}
          <div
            className={`absolute inset-0 z-10 flex items-center justify-center rounded border-2 border-dashed transition-colors ${isDragOver ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-transparent'}`}
            style={{ pointerEvents: isDragOver ? 'auto' : 'none' }}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            {isDragOver && (
              <div className="text-sm font-medium text-[var(--primary)] flex items-center gap-2 pointer-events-none">
                <PackagePlus className="w-5 h-5" />
                Drop here to create a global reusable
              </div>
            )}
          </div>
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reusable components..."
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] rounded bg-white dark:bg-[#0d1117] text-black dark:text-white"
            />
          </div>
          <div className="mb-3 px-3 py-2 border border-dashed border-gray-300 dark:border-[#30363d] rounded text-xs text-gray-500 dark:text-gray-400">
            Or drag a tree node anywhere in this panel to create a global reusable
          </div>
          {filtered.length === 0 ? (
            <div className="text-xs text-gray-500 dark:text-gray-400">No global reusables yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {filtered.map((r) => {
                const isPromoting = promotingReusableIds.includes(r.id)
                return (
                <div
                  key={r.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'reusableInstance', reusableId: r.id }))
                    e.dataTransfer.setData('text/plain', r.name)
                    e.dataTransfer.effectAllowed = 'copy'
                    setBuilderDragPayload({ kind: 'component', type: 'reusableInstance', reusableId: r.id })
                  }}
                  onDragEnd={() => clearBuilderDragPayload()}
                  className={`border rounded p-2 bg-white dark:bg-[#0d1117] cursor-grab active:cursor-grabbing ${activeReusableId === r.id ? 'border-[var(--primary)]' : 'border-gray-200 dark:border-[#30363d]'}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      {renamingId === r.id ? (
                        <input
                          ref={renameInputRef}
                          value={renameVal}
                          onChange={(e) => setRenameVal(e.target.value)}
                          onBlur={() => commitRenameFor(r.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRenameFor(r.id)
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          className="w-full text-sm border border-[var(--primary)] rounded px-1 py-0.5 bg-white dark:bg-[#0d1117] text-black dark:text-white outline-none focus:ring-1 focus:ring-[var(--primary)]"
                          autoFocus
                        />
                      ) : (
                        <div
                          className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate cursor-pointer hover:text-[var(--primary)] group/name flex items-center gap-1"
                          title="Double-click to rename"
                          onDoubleClick={(e) => startRename(r, e)}
                        >
                          {r.name}
                          <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover/name:opacity-50 shrink-0"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </div>
                      )}
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 truncate">{r.root.type}</div>
                    </div>
                    {onDeleteReusable && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteReusable(r.id) }}
                        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-500/10 shrink-0"
                        title="Remove this reusable"
                        aria-label="Remove reusable"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onInsertReusable?.(r.id)}
                    className="mt-2 w-full text-xs px-2 py-1 border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d] flex items-center justify-center gap-1"
                  >
                    <PackagePlus className="w-3 h-3" />
                    Insert
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditReusable?.(r.id)}
                    className="mt-1 w-full text-xs px-2 py-1 border border-gray-300 dark:border-[#30363d] rounded hover:bg-gray-100 dark:hover:bg-[#21262d] flex items-center justify-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit source
                  </button>
                  {onPromoteReusable && (
                    <button
                      type="button"
                      onClick={() => onPromoteReusable(r)}
                      disabled={isPromoting}
                      className={`mt-1 w-full text-xs px-2 py-1 border border-gray-300 dark:border-[#30363d] rounded ${isPromoting ? 'opacity-60 cursor-wait' : 'hover:bg-gray-100 dark:hover:bg-[#21262d]'}`}
                    >
                      {isPromoting ? 'Promoting...' : 'Promote to org'}
                    </button>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
