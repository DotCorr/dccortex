/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_STORAGE_KEY = 'builder-panel-widths'
const DEFAULTS = { tree: 240, palette: 220, panel: 420 }
const MIN = 160
const MAX = 600

function loadWidths(storageKey: string): typeof DEFAULTS {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const s = localStorage.getItem(storageKey)
    if (s) {
      const o = JSON.parse(s) as Partial<typeof DEFAULTS>
      return { ...DEFAULTS, ...o }
    }
  } catch (_) {}
  return DEFAULTS
}

function saveWidths(storageKey: string, w: typeof DEFAULTS) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(w))
  } catch (_) {}
}

type Props = {
  leftTree: React.ReactNode
  leftPalette: React.ReactNode | ((ctx: { isMobile: boolean; closeMobileSheet: () => void }) => React.ReactNode)
  center: React.ReactNode
  rightPanel: React.ReactNode
  showLeft: boolean
  showRight: boolean
  storageKey?: string
  onWidthsChange?: () => void
}

export function ResizablePanelLayout({ leftTree, leftPalette, center, rightPanel, showLeft, showRight, storageKey = DEFAULT_STORAGE_KEY, onWidthsChange }: Props) {
  const [widths, setWidths] = useState(() => loadWidths(storageKey))
  const [isMobile, setIsMobile] = useState(false)
  const [mobileSheet, setMobileSheet] = useState<'tree' | 'palette' | 'props' | null>(null)
  const [dragging, setDragging] = useState<'tree' | 'palette' | 'panel' | null>(null)
  const hasMountedRef = useRef(false)
  const onWidthsChangeRef = useRef(onWidthsChange)
  useEffect(() => { onWidthsChangeRef.current = onWidthsChange })

  useEffect(() => {
    setWidths(loadWidths(storageKey))
  }, [storageKey])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    if (dragging) return
    saveWidths(storageKey, widths)
    onWidthsChangeRef.current?.()
  }, [dragging, storageKey, widths])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(max-width: 1023px)')
    const apply = () => setIsMobile(mql.matches)
    apply()
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', apply)
      return () => mql.removeEventListener('change', apply)
    }
    mql.addListener(apply)
    return () => mql.removeListener(apply)
  }, [])

  useEffect(() => {
    if (mobileSheet === 'tree' && !showLeft) setMobileSheet(null)
    if (mobileSheet === 'palette' && !showLeft) setMobileSheet(null)
    if (mobileSheet === 'props' && !showRight) setMobileSheet(null)
  }, [showLeft, showRight, mobileSheet])

  const clamp = useCallback((v: number) => Math.min(MAX, Math.max(MIN, v)), [])

  const setTree = useCallback((v: number) => setWidths((w) => ({ ...w, tree: clamp(v) })), [clamp])
  const setPalette = useCallback((v: number) => setWidths((w) => ({ ...w, palette: clamp(v) })), [clamp])
  const setPanel = useCallback((v: number) => setWidths((w) => ({ ...w, panel: clamp(v) })), [clamp])

  const handleMouseDown = useCallback((which: 'tree' | 'palette' | 'panel') => (e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(which)
  }, [])

  useEffect(() => {
    if (!dragging) return

    const previousUserSelect = document.body.style.userSelect
    const previousWebkitUserSelect = document.body.style.webkitUserSelect
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'

    const onMove = (e: MouseEvent) => {
      if (dragging === 'tree') setTree(widths.tree + e.movementX)
      if (dragging === 'palette') setPalette(widths.palette + e.movementX)
      if (dragging === 'panel') setPanel(widths.panel - e.movementX)
    }
    const onUp = () => setDragging(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = previousUserSelect
      document.body.style.webkitUserSelect = previousWebkitUserSelect
    }
  }, [dragging, widths, setTree, setPalette, setPanel])

  const resizeClass = 'w-1 shrink-0 hover:bg-[var(--primary)]/30 bg-gray-200 dark:bg-[#30363d] cursor-col-resize flex items-center justify-center select-none'
  const resizeBar = (which: 'tree' | 'palette' | 'panel') => (
    <div
      role="separator"
      aria-label={`Resize ${which}`}
      tabIndex={-1}
      onMouseDown={handleMouseDown(which)}
      className={`${resizeClass} ${dragging === which ? 'bg-[var(--primary)]/50' : ''}`}
    >
      <div className="w-0.5 h-8 rounded-full bg-gray-400 dark:bg-gray-500" />
    </div>
  )

  const renderLeftPalette = useCallback((mobile: boolean) => {
    if (typeof leftPalette === 'function') {
      return leftPalette({ isMobile: mobile, closeMobileSheet: () => setMobileSheet(null) })
    }
    return leftPalette
  }, [leftPalette])

  if (isMobile) {
    const sheetTitle = mobileSheet === 'tree' ? 'Node Tree' : mobileSheet === 'palette' ? 'Component Palette' : 'Properties'

    return (
      <div className="relative flex flex-1 min-h-0 overflow-hidden flex-col">
        <div className="flex-1 min-h-0 overflow-hidden">{center}</div>
        {showLeft && (
          <button
            type="button"
            onClick={() => setMobileSheet('palette')}
            className="absolute right-4 bottom-16 z-30 h-11 w-11 rounded-full bg-black text-white dark:bg-white dark:text-black shadow-lg flex items-center justify-center text-xl"
            title="Add component"
          >
            +
          </button>
        )}
        {(showLeft || showRight) && (
          <div className="shrink-0 border-t border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] px-2 py-2">
            <div className="flex items-center justify-center gap-2">
              {showLeft && (
                <>
                  <button
                    type="button"
                    onClick={() => setMobileSheet('tree')}
                    className="px-3 py-1.5 text-xs rounded border bg-transparent text-gray-600 dark:text-gray-300 border-gray-300 dark:border-[#30363d]"
                  >
                    Tree
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileSheet('palette')}
                    className="px-3 py-1.5 text-xs rounded border bg-transparent text-gray-600 dark:text-gray-300 border-gray-300 dark:border-[#30363d]"
                  >
                    Add Components
                  </button>
                </>
              )}
              {showRight && (
                <button
                  type="button"
                  onClick={() => setMobileSheet('props')}
                  className="px-3 py-1.5 text-xs rounded border bg-transparent text-gray-600 dark:text-gray-300 border-gray-300 dark:border-[#30363d]"
                >
                  Properties
                </button>
              )}
            </div>
          </div>
        )}

        {mobileSheet && (
          <div className="absolute inset-0 z-40 bg-black/40" onClick={() => setMobileSheet(null)}>
            <div
              className="absolute bottom-0 left-0 right-0 max-h-[80vh] bg-white dark:bg-[#161b22] border-t border-gray-200 dark:border-[#30363d] rounded-t-xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 px-3 py-2 border-b border-gray-200 dark:border-[#30363d] flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{sheetTitle}</span>
                <button
                  type="button"
                  onClick={() => setMobileSheet(null)}
                  className="ml-auto px-2 py-1 text-xs rounded border border-gray-300 dark:border-[#30363d] text-gray-500 dark:text-gray-300"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {mobileSheet === 'tree' && showLeft && leftTree}
                {mobileSheet === 'palette' && showLeft && renderLeftPalette(true)}
                {mobileSheet === 'props' && showRight && rightPanel}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-1 h-full w-full min-w-0 min-h-0 overflow-hidden">
      {showLeft && (
        <>
          <div className="shrink-0 w-0 overflow-hidden flex flex-col h-full" style={{ width: widths.tree, minWidth: widths.tree, maxWidth: widths.tree }}>
            {leftTree}
          </div>
          {resizeBar('tree')}
          <div className="shrink-0 w-0 overflow-hidden flex flex-col h-full" style={{ width: widths.palette, minWidth: widths.palette, maxWidth: widths.palette }}>
            {renderLeftPalette(false)}
          </div>
          {resizeBar('palette')}
        </>
      )}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 h-full">{center}</div>
      {showRight && (
        <>
          {resizeBar('panel')}
          <div className="shrink-0 w-0 overflow-hidden flex flex-col h-full min-h-0" style={{ width: widths.panel, minWidth: widths.panel, maxWidth: widths.panel }}>
            {rightPanel}
          </div>
        </>
      )}
    </div>
  )
}
