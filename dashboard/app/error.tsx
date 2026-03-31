/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-white dark:bg-[#0d1117]">
      <h2 className="text-lg font-medium text-black dark:text-white">Something went wrong</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md text-center">
        {error.message}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
