/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import type { Metadata } from 'next'
import './globals.css'
import 'react-device-frameset/styles/marvel-devices.min.css'
import { Providers } from './providers'
import { TauriDetector } from '@/components/tauri-detector'
import { WindowControls } from '@/components/tauri-window-controls'
import dynamic from 'next/dynamic'

import CortexLoader from '@/components/cortex/CortexLoader'

export const metadata: Metadata = {
  title: 'DCCortex - No-Code App Builder',
  description: 'Build no-code apps. Design screens, manage data, and deploy.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <TauriDetector />
        <WindowControls />
        <Providers>
          {children}
          <CortexLoader />
        </Providers>
      </body>
    </html>
  )
}

