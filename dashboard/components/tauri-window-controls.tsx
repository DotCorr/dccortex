/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useEffect, useState } from 'react'
import { X, Minus, Square } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { detectDesktopShell, detectPlatform } from '@/components/tauri-detector'

export function WindowControls() {
  const [isTauri, setIsTauri] = useState(false)
  const [platform, setPlatform] = useState<string>('')

  useEffect(() => {
    let attempts = 0
    const timer = setInterval(() => {
      attempts += 1
      if (detectDesktopShell()) {
        setIsTauri(true)
        setPlatform(detectPlatform())
        clearInterval(timer)
        return
      }
      if (attempts >= 20) {
        clearInterval(timer)
      }
    }, 100)

    if (detectDesktopShell()) {
      setIsTauri(true)
      setPlatform(detectPlatform())
      clearInterval(timer)
    }

    return () => clearInterval(timer)
  }, [])

  // Don't render desktop chrome in browser.
  if (!isTauri) {
    return null
  }

  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().minimize()
    } catch {}
  }

  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const win = getCurrentWindow()
      if (await win.isMaximized()) {
        await win.unmaximize()
      } else {
        await win.maximize()
      }
    } catch {}
  }

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().close()
    } catch {}
  }

  const startWindowDrag = async () => {
    try {
      const win = getCurrentWindow()
      await win.startDragging()
    } catch {}
  }

  const handleDragStart = (e: React.MouseEvent | React.PointerEvent) => {
    if ('button' in e && e.button !== 0) return
    e.preventDefault()
    void startWindowDrag()
  }

  // Keep dragging on explicit controls only (thumb + titlebar buttons area)
  // so we never block clicks on app headers/navigation underneath.
  return (
    <>
      {/* Center drag handle hint: makes the draggable area discoverable. */}
      <div
        data-tauri-drag-region
        data-window-drag-handle="true"
        onPointerDown={handleDragStart}
        onMouseDown={handleDragStart}
        className="fixed left-1/2 -translate-x-1/2 z-[10000] h-7 w-24 rounded-full border border-black/20 dark:border-white/25 bg-white/90 dark:bg-black/55 shadow-sm backdrop-blur-md flex items-center justify-center gap-1.5 cursor-grab active:cursor-grabbing"
        title="Drag window"
        style={{
          top: platform === 'darwin' ? 18 : 14,
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-black/40 dark:bg-white/55" />
        <span className="h-1.5 w-1.5 rounded-full bg-black/40 dark:bg-white/55" />
        <span className="h-1.5 w-1.5 rounded-full bg-black/40 dark:bg-white/55" />
      </div>

      {/* Windows/Linux window controls (right side). macOS keeps native traffic lights. */}
      {platform !== 'darwin' && (
        <div
          className="fixed top-0 right-0 z-[10000] flex items-center"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handleMinimize}
            className="px-4 py-2 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Minimize"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={handleMaximize}
            className="px-4 py-2 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Maximize"
          >
            <Square size={14} />
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 hover:bg-red-500 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  )
}
