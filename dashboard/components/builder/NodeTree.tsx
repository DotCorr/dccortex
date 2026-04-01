/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronRight, ChevronDown, Trash2, PackagePlus } from 'lucide-react'
import type { Node } from './registry'
import { getDomId } from './registry'
import { clearBuilderDragPayload, getBuilderDragPayload, setBuilderDragPayload } from './drag-payload'

const TREE_DRAG_TYPE = 'application/x-builder-tree-node'
const SLOT = 16 // px per indent level
const GUIDE_COLOR = 'rgba(90,107,126,0.28)' // subtle VS Code-like guide lines

type ReusableMeta = { id: string; name: string; propsSchema?: { key: string }[] }

type Props = {
  root: Node
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onCreateReusable?: (id: string) => void
  onMove?: (nodeId: string, targetParentId: string, index: number) => void
  globalReusables?: ReusableMeta[]
  storageKey?: string
}

type DropZone = 'above' | 'below' | 'inside' | null

// ancestorLines[i] = true  → ancestor at level i still has siblings below → draw │
// ancestorLines[i] = false → ancestor at level i was the last child → stop line (use └)

function NodeTreeItem({
  node, rootId, parentId, indexInParent,
  selectedId, onSelect, onDelete, onCreateReusable, onMove,
  depth, ancestorLines, draggingNodeId, onDragStartNode, onDragEndNode,
  reusablesMap, storageKey,
}: {
  node: Node; rootId: string; parentId: string; indexInParent: number
  selectedId: string | null; onSelect: (id: string) => void
  onDelete: (id: string) => void; onCreateReusable?: (id: string) => void
  onMove?: (nodeId: string, targetParentId: string, index: number) => void
  depth: number; ancestorLines: boolean[]
  draggingNodeId: string | null; onDragStartNode: (id: string) => void; onDragEndNode: () => void
  reusablesMap?: Map<string, ReusableMeta>
  storageKey?: string
}) {
  // Auto-collapse deep subtrees with many children to keep the tree performant
  const childCount = node.children?.length ?? 0
  const expandedStorageKey = storageKey ? `${storageKey}:expanded:${node.id}` : null
  const [expanded, setExpanded] = useState(() => {
    if (typeof window !== 'undefined' && expandedStorageKey) {
      try {
        const raw = window.localStorage.getItem(expandedStorageKey)
        if (raw === '1') return true
        if (raw === '0') return false
      } catch {}
    }
    return depth < 3 || childCount <= 10
  })
  const [dropZone, setDropZone] = useState<DropZone>(null)
  const isSelected = selectedId === node.id
  const domId = getDomId(node)
  const rowRef = useRef<HTMLDivElement>(null)
  const hasChildren = (node.children?.length ?? 0) > 0
  const canDelete = node.id !== rootId
  const canDrag = node.id !== rootId && !!onMove

  useEffect(() => {
    if (isSelected) rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [isSelected])

  useEffect(() => {
    if (!expandedStorageKey || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(expandedStorageKey, expanded ? '1' : '0')
    } catch {}
  }, [expandedStorageKey, expanded])

  // Auto-expand if selected node is a descendant of this collapsed node
  useEffect(() => {
    if (!selectedId || expanded || !hasChildren) return
    const hasDescendant = (n: Node): boolean => {
      if (n.id === selectedId) return true
      return (n.children ?? []).some(hasDescendant)
    }
    if (hasDescendant(node)) setExpanded(true)
  }, [selectedId, expanded, hasChildren, node])

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ nodeId: node.id }))
    e.dataTransfer.setData(TREE_DRAG_TYPE, node.id)
    e.dataTransfer.effectAllowed = 'move'
    setBuilderDragPayload({ kind: 'tree-node', nodeId: node.id })
    onDragStartNode(node.id)
  }
  const handleDragEnd = () => {
    onDragEndNode()
    setDropZone(null)
    clearBuilderDragPayload()
  }
  const handleDragOver = (e: React.DragEvent, zone: DropZone) => {
    const payload = getBuilderDragPayload()
    const isTreeDrag = e.dataTransfer.types.includes(TREE_DRAG_TYPE) || payload?.kind === 'tree-node'
    if (!onMove || !isTreeDrag || !zone || draggingNodeId === node.id) return
    e.preventDefault(); e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDropZone(zone)
  }
  const handleDragLeave = () => setDropZone(null)
  const handleDrop = (e: React.DragEvent, zone: DropZone) => {
    e.preventDefault(); e.stopPropagation(); setDropZone(null)
    if (!onMove || !zone) return
    try {
      const raw = e.dataTransfer.getData('application/json')
      const parsed = raw ? JSON.parse(raw) : null
      const fallback = getBuilderDragPayload()
      const nodeId = parsed?.nodeId || (fallback?.kind === 'tree-node' ? fallback.nodeId : undefined)
      if (!nodeId || nodeId === node.id) return
      if (zone === 'above') onMove(nodeId, parentId, indexInParent)
      else if (zone === 'below') onMove(nodeId, parentId, indexInParent + 1)
      else onMove(nodeId, node.id, 0)
    } catch (_) {}
  }
  const dropClass = (z: DropZone) =>
    dropZone === z ? 'bg-[var(--primary)]/20 ring-1 ring-inset ring-[var(--primary)]/40' : ''

  // VS Code-style guide lines: each level = SLOT px wide column
  // Elbow column (depth-1): top-half vertical always + bottom-half if continuing + horizontal connector
  // Ancestor columns (0..depth-2): full vertical if ancestorLines[i] = true, else empty
  const MID = Math.floor(SLOT / 2)
  const guides = depth === 0 ? null : (
    <div className="flex-shrink-0 self-stretch flex" style={{ width: depth * SLOT, position: 'relative' }}>
      {Array.from({ length: depth }, (_, i) => {
        const isElbow = i === depth - 1
        const cont = ancestorLines[i]
        return (
          <div key={i} style={{ width: SLOT, flexShrink: 0, position: 'relative' }}>
            {isElbow ? (
              <>
                <div style={{ position: 'absolute', left: MID, top: 0, width: 1, height: '50%', background: GUIDE_COLOR }} />
                {cont && <div style={{ position: 'absolute', left: MID, top: '50%', width: 1, bottom: 0, background: GUIDE_COLOR }} />}
                <div style={{ position: 'absolute', left: MID, top: '50%', width: MID + 2, height: 1, background: GUIDE_COLOR, transform: 'translateY(-0.5px)' }} />
              </>
            ) : (
              cont && <div style={{ position: 'absolute', left: MID, top: 0, width: 1, bottom: 0, background: GUIDE_COLOR }} />
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="select-none">
      {onMove && (
        <div className={`h-[5px] rounded-sm transition-colors ${dropClass('above')}`}
          onDragOver={(e) => handleDragOver(e, 'above')} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, 'above')} />
      )}

      <div
        ref={rowRef}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-level={depth + 1}
        tabIndex={isSelected ? 0 : -1}
        className={`flex items-center group rounded-[3px] transition-colors
          ${isSelected ? 'bg-[var(--primary)] text-white' : 'hover:bg-gray-100 dark:hover:bg-[#2a2d2e]'}
          ${dropClass('inside')}`}
        style={{ height: 22 }}
        draggable={canDrag ? 'true' : 'false'}
        onDragStart={canDrag ? handleDragStart : undefined}
        onDragEnd={canDrag ? handleDragEnd : undefined}
        onDragOver={onMove ? (e) => handleDragOver(e, 'inside') : undefined}
        onDragLeave={onMove ? handleDragLeave : undefined}
        onDrop={onMove ? (e) => handleDrop(e, 'inside') : undefined}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' && hasChildren && !expanded) { setExpanded(true); e.preventDefault() }
          else if (e.key === 'ArrowLeft' && expanded) { setExpanded(false); e.preventDefault() }
          else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const items = Array.from(rowRef.current?.closest('[role="tree"]')?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])
            const idx = items.indexOf(rowRef.current!)
            const next = e.key === 'ArrowDown' ? items[idx + 1] : items[idx - 1]
            if (next) { next.focus(); next.click() }
          }
          else if (e.key === 'Enter' || e.key === ' ') { onSelect(node.id); e.preventDefault() }
          else if (e.key === 'Delete' && canDelete) { onDelete(node.id); e.preventDefault() }
        }}
      >
        {guides}

        {/* chevron */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-sm
            ${isSelected ? 'hover:bg-white/20' : 'hover:bg-gray-200 dark:hover:bg-[#3c3c3c]'}`}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {hasChildren
            ? (expanded ? <ChevronDown className="w-3 h-3 opacity-60" /> : <ChevronRight className="w-3 h-3 opacity-60" />)
            : <span className="w-3 h-3 block" />
          }
        </button>

        {/* label */}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex-1 min-w-0 text-left text-[11.5px] truncate pl-0.5 leading-none"
        >
          {node.type === 'reusableInstance' ? (() => {
            const rid = String(node.props?.reusableId ?? '')
            const meta = rid ? reusablesMap?.get(rid) : undefined
            const passedProps = (node.props?.reusableProps ?? {}) as Record<string, unknown>
            const entries = Object.entries(passedProps).filter(([, v]) => v !== '' && v !== undefined && v !== null)
            const propsStr = entries.length
              ? `(${entries.map(([k, v]) => `${k}: ${String(v).slice(0, 12)}`).join(', ')})`
              : ''
            return (
              <>
                <span className={`font-medium ${isSelected ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`}>
                  {meta?.name ?? 'reusableInstance'}
                </span>
                {propsStr && (
                  <span className={`ml-0.5 font-mono text-[9.5px] ${isSelected ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'}`}>
                    {propsStr}
                  </span>
                )}
              </>
            )
          })() : (
            <>
              <span className={`font-medium ${isSelected ? 'text-white' : 'text-gray-800 dark:text-[#d4d4d4]'}`}>
                {node.type}
              </span>
              {domId !== node.id && (
                <span className={`ml-1 font-mono text-[10px] ${isSelected ? 'text-white/55' : 'text-gray-400 dark:text-[#6a9955]'}`}>
                  #{domId}
                </span>
              )}
            </>
          )}
        </button>

        {/* action icons */}
        <div className="flex-shrink-0 flex items-center pr-1 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {canDelete && onCreateReusable && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onCreateReusable(node.id) }}
              className={`p-0.5 rounded-sm ${isSelected ? 'text-white/60 hover:text-white hover:bg-white/20' : 'text-gray-400 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10'}`}
              aria-label="Add to reusables"><PackagePlus className="w-3 h-3" /></button>
          )}
          {canDelete && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(node.id) }}
              className={`p-0.5 rounded-sm ${isSelected ? 'text-white/60 hover:text-white hover:bg-white/20' : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
              aria-label="Delete"><Trash2 className="w-3 h-3" /></button>
          )}
        </div>
      </div>

      {onMove && (
        <div className={`h-[5px] rounded-sm transition-colors ${dropClass('below')}`}
          onDragOver={(e) => handleDragOver(e, 'below')} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, 'below')} />
      )}

      {hasChildren && expanded && (
        <div>
          {node.children!.map((child, i) => {
            const isLast = i === node.children!.length - 1
            return (
              <NodeTreeItem
                key={child.id}
                node={child} rootId={rootId} parentId={node.id} indexInParent={i}
                selectedId={selectedId} onSelect={onSelect} onDelete={onDelete}
                onCreateReusable={onCreateReusable} onMove={onMove}
                depth={depth + 1}
                ancestorLines={[...ancestorLines, !isLast]}
                draggingNodeId={draggingNodeId} onDragStartNode={onDragStartNode} onDragEndNode={onDragEndNode}
                reusablesMap={reusablesMap}
                storageKey={storageKey}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export function NodeTree({ root, selectedId, onSelect, onDelete, onCreateReusable, onMove, globalReusables, storageKey }: Props) {
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const reusablesMap = globalReusables?.length
    ? new Map(globalReusables.map((r) => [r.id, r]))
    : undefined

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined' || !scrollRef.current) return
    try {
      const raw = window.localStorage.getItem(`${storageKey}:scrollTop`)
      if (raw) scrollRef.current.scrollTop = Math.max(0, Number(raw) || 0)
    } catch {}
  }, [storageKey, root.id])

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined' || !scrollRef.current) return
    const el = scrollRef.current
    const onScroll = () => {
      try { window.localStorage.setItem(`${storageKey}:scrollTop`, String(el.scrollTop)) } catch {}
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [storageKey])

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden py-1 bg-white dark:bg-[#1e1e1e]" role="tree" aria-label="Component Tree">
      <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-1 px-2 pt-1 select-none">
        Component Tree
      </div>
      <NodeTreeItem
        node={root} rootId={root.id} parentId={root.id} indexInParent={0}
        selectedId={selectedId} onSelect={onSelect} onDelete={onDelete}
        onCreateReusable={onCreateReusable} onMove={onMove}
        depth={0} ancestorLines={[]}
        draggingNodeId={draggingNodeId}
        onDragStartNode={setDraggingNodeId}
        onDragEndNode={() => setDraggingNodeId(null)}
        reusablesMap={reusablesMap}
        storageKey={storageKey}
      />
    </div>
  )
}
