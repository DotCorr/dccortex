/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useEffect } from 'react'

export function useTauri() {
  if (typeof window === 'undefined') return { isTauri: false, platform: '' }
  const isTauri = !!(window as any).__TAURI__
  const ua = navigator.userAgent.toLowerCase()
  const platform = ua.includes('mac') ? 'darwin' : ua.includes('win') ? 'windows' : ua.includes('linux') ? 'linux' : ''
  return { isTauri, platform }
}

export function TauriDetector() {
  useEffect(() => {
    const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI__
    if (!isTauri) return

    const ua = navigator.userAgent.toLowerCase()
    let platform = 'unknown'
    if (ua.includes('mac')) platform = 'darwin'
    else if (ua.includes('win')) platform = 'windows'
    else if (ua.includes('linux')) platform = 'linux'

    document.documentElement.classList.add('tauri-app', `platform-${platform}`)
    document.body.classList.add('tauri-app')

    document.body.style.margin = '0'
    document.body.style.padding = '0'
    document.body.style.height = '100vh'
    document.documentElement.style.height = '100%'
    document.documentElement.style.margin = '0'
    document.documentElement.style.padding = '0'

    const style = document.createElement('style')
    style.textContent = `
      /* Desktop shell baseline: feel native, not like selectable webpage */
      .tauri-app,
      .tauri-app body,
      .tauri-app * {
        user-select: none !important;
        -webkit-user-select: none !important;
      }

      /* macOS: push body below the native traffic-light area */
      .tauri-app.platform-darwin body {
        padding-top: 28px !important;
      }
      /* Windows/Linux: taller title bar for custom window controls */
      .tauri-app.platform-windows body,
      .tauri-app.platform-linux body {
        padding-top: 32px !important;
      }
      /* Mark elements with [data-tauri-drag-region] as draggable via WebKit */
      .tauri-app [data-tauri-drag-region] {
        -webkit-app-region: drag;
      }
      /* All interactive elements inside a drag region must be no-drag */
      .tauri-app [data-tauri-drag-region] a,
      .tauri-app [data-tauri-drag-region] button,
      .tauri-app [data-tauri-drag-region] input,
      .tauri-app [data-tauri-drag-region] select,
      .tauri-app [data-tauri-drag-region] textarea,
      .tauri-app [data-tauri-drag-region] [role="button"],
      .tauri-app [data-tauri-drag-region] [draggable="true"] {
        -webkit-app-region: no-drag;
      }

      /* Keep text editing/selection where users expect it */
      .tauri-app input,
      .tauri-app textarea,
      .tauri-app select,
      .tauri-app option,
      .tauri-app [contenteditable="true"],
      .tauri-app [data-allow-select="true"],
      .tauri-app .monaco-editor,
      .tauri-app .monaco-editor *,
      .tauri-app .ql-editor,
      .tauri-app .ql-editor *,
      .tauri-app .ProseMirror,
      .tauri-app .ProseMirror * {
        user-select: text !important;
        -webkit-user-select: text !important;
      }

      /* Desktop runtime UX guard: avoid accidental text/image dragging in app runtime */
      .tauri-app [data-desktop-runtime="true"] {
        user-select: none !important;
        -webkit-user-select: none !important;
      }

      .tauri-app [data-desktop-runtime="true"] img,
      .tauri-app [data-desktop-runtime="true"] a {
        -webkit-user-drag: none;
        user-drag: none;
      }

      /* Keep native text selection and editing behavior for form controls */
      .tauri-app [data-desktop-runtime="true"] input,
      .tauri-app [data-desktop-runtime="true"] textarea,
      .tauri-app [data-desktop-runtime="true"] select,
      .tauri-app [data-desktop-runtime="true"] option,
      .tauri-app [data-desktop-runtime="true"] [contenteditable="true"],
      .tauri-app [data-desktop-runtime="true"] [data-allow-select="true"] {
        user-select: text;
        -webkit-user-select: text;
      }
    `
    document.head.appendChild(style)

    const preventNativeDrag = (ev: DragEvent) => {
      const target = ev.target as HTMLElement | null
      if (!target) return
      if (target.closest('input, textarea, select, option, [contenteditable="true"], [draggable="true"], [data-allow-native-drag="true"], .monaco-editor, .ql-editor, .ProseMirror')) {
        return
      }
      ev.preventDefault()
    }
    const preventSelection = (ev: Event) => {
      const target = ev.target as HTMLElement | null
      if (!target) return
      if (target.closest('input, textarea, select, option, [contenteditable="true"], [data-allow-select="true"], .monaco-editor, .ql-editor, .ProseMirror')) {
        return
      }
      ev.preventDefault()
    }
    const suppressMouseSelection = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null
      if (!target) return
      if (target.closest('input, textarea, select, option, button, a, [role="button"], [contenteditable="true"], [data-allow-select="true"], [data-tauri-drag-region], [data-window-drag-handle="true"], .monaco-editor, .ql-editor, .ProseMirror, [data-node-id]')) {
        return
      }
      if (ev.button === 0) {
        ev.preventDefault()
      }
    }
    document.addEventListener('dragstart', preventNativeDrag, true)
    document.addEventListener('selectstart', preventSelection, true)
    document.addEventListener('mousedown', suppressMouseSelection, true)

    return () => {
      document.documentElement.classList.remove('tauri-app', `platform-${platform}`)
      document.body.classList.remove('tauri-app')
      document.body.style.background = ''
      document.removeEventListener('dragstart', preventNativeDrag, true)
      document.removeEventListener('selectstart', preventSelection, true)
      document.removeEventListener('mousedown', suppressMouseSelection, true)
      style.remove()
    }
  }, [])

  return null
}
