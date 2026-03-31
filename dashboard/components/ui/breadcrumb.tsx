/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
  isActive?: boolean
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  // Filter out empty labels
  const validItems = items.filter(item => item.label && item.label.trim() !== '')
  
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
      <Link href="/dashboard" className="hover:text-black dark:hover:text-white transition-colors">
        <Home size={14} />
      </Link>
      {validItems.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight size={14} className="text-gray-400 dark:text-gray-500" />
          {item.href ? (
            <Link 
              href={item.href} 
              className={`hover:text-black dark:hover:text-white transition-colors ${
                item.isActive ? 'text-black dark:text-white font-medium' : ''
              }`}
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-black dark:text-white font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}

