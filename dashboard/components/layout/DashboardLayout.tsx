/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { LogOut, Settings } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { ProductSwitcher } from '@/components/product-switcher'
import { useEffect, useState } from 'react'
import { detectDesktopShell, detectPlatform } from '@/components/tauri-detector'

export function DashboardLayout({ children, hideSidebar }: { children: React.ReactNode; hideSidebar?: boolean }) {
  const { data: session } = useSession()
  const [isTauri, setIsTauri] = useState(false)
  const [platform, setPlatform] = useState<string>('')

  useEffect(() => {
    // Detect desktop shell with a short retry window to survive dev-server restarts.
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
      return () => clearInterval(timer)
    }

    // Fallback: detect Electron
    const electronAPI = (window as any).electronAPI
    if (electronAPI?.isElectron) {
      setIsTauri(false) // keep false, but reuse leftPadding logic
      setPlatform(electronAPI.platform || '')
    }

    return () => clearInterval(timer)
  }, [])

  // macOS traffic lights take up ~78px; add padding so logo clears them
  const leftPadding = isTauri && platform === 'darwin' ? 'pl-24' : 'pl-4 sm:pl-6 lg:pl-8'

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d1117]">
      {/* Top Navigation - Matching dotcorr_landing */}
      {!hideSidebar && (
      <header 
        className="fixed top-0 left-0 right-0 bg-white/90 dark:bg-[#0d1117]/90 backdrop-blur-md z-50 border-b border-gray-100 dark:border-[#30363d] select-none"
        data-tauri-drag-region
      >
        <nav className={`max-w-7xl mx-auto ${leftPadding} pr-4 sm:pr-6 lg:pr-8`}>
          <div className="flex justify-between items-center h-14 sm:h-16">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-2 group"
            >
              <Logo />
              <span className="text-base sm:text-lg font-bold tracking-tight text-black dark:text-white">DCCortex</span>
            </Link>
            <ProductSwitcher current="dccortex" />
            
            <div className="flex items-center gap-3 sm:gap-6">
              <span className="hidden sm:inline-block text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate max-w-[150px] sm:max-w-none">
                {session?.user?.email}
              </span>
              <Link
                href="/settings"
                className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                aria-label="Settings"
                title="Settings"
              >
                <Settings size={18} className="sm:w-5 sm:h-5" />
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/login', redirect: true })}
                className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                aria-label="Sign out"
              >
                <LogOut size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </nav>
      </header>
      )}

      <div className={`w-full px-0 ${hideSidebar ? 'pt-0' : 'pt-16'} pb-0`}>
        {/* No sidebar - users navigate through organizations */}
        <main className="w-full h-full">
          {children}
        </main>
      </div>
    </div>
  )
}

