/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-white dark:bg-[#0d1117]">
      <p className="text-8xl font-black tracking-tighter text-black dark:text-white select-none">404</p>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-black dark:text-white mb-2">Page not found</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-80 transition-opacity"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
