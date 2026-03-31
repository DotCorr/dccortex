/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0d1117', color: '#e6edf3', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</h2>
        <p style={{ fontSize: 14, color: '#8b949e', maxWidth: 400, textAlign: 'center' }}>{error.message}</p>
        <button
          onClick={reset}
          style={{ marginTop: 16, padding: '8px 16px', background: '#238636', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
