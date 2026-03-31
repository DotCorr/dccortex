/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Horizontal Loading Bar
 * Minimal loading indicator matching design language
 */

'use client'

interface LoadingBarProps {
  fullPage?: boolean
}

export function LoadingBar({ fullPage = false }: LoadingBarProps) {
  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="w-48">
          <div className="w-full h-3 bg-gray-200 overflow-hidden">
            <div className="h-full w-1/3 bg-black animate-loading-bar" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-0.5 bg-gray-100 overflow-hidden">
      <div className="h-full bg-black animate-loading-bar" />
    </div>
  )
}

