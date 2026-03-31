/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, Loader2 } from 'lucide-react'

/** Icon prefix options shown in the picker's tabs. */
const PREFIXES = [
  { id: 'mdi', label: 'Material' },
  { id: 'lucide', label: 'Lucide' },
  { id: 'heroicons', label: 'Heroicons' },
  { id: 'tabler', label: 'Tabler' },
  { id: 'ph', label: 'Phosphor' },
  { id: 'ri', label: 'Remix' },
]

/** Pre-loaded popular icons shown when no search query is typed. */
const POPULAR: string[] = [
  'mdi:home', 'mdi:account', 'mdi:settings', 'mdi:magnify', 'mdi:heart',
  'mdi:star', 'mdi:bell', 'mdi:email', 'mdi:phone', 'mdi:map-marker',
  'mdi:calendar', 'mdi:clock', 'mdi:check', 'mdi:close', 'mdi:plus',
  'mdi:minus', 'mdi:menu', 'mdi:dots-vertical', 'mdi:chevron-right', 'mdi:chevron-down',
  'mdi:arrow-left', 'mdi:arrow-right', 'mdi:upload', 'mdi:download', 'mdi:share',
  'mdi:pencil', 'mdi:delete', 'mdi:eye', 'mdi:eye-off', 'mdi:lock',
  'mdi:lock-open', 'mdi:shield', 'mdi:information', 'mdi:alert', 'mdi:check-circle',
  'mdi:close-circle', 'mdi:help-circle', 'mdi:image', 'mdi:file', 'mdi:folder',
  'mdi:chart-line', 'mdi:chart-bar', 'mdi:chart-pie', 'mdi:trending-up', 'mdi:trending-down',
  'mdi:cart', 'mdi:tag', 'mdi:cash', 'mdi:credit-card', 'mdi:bank',
  'mdi:account-group', 'mdi:message', 'mdi:logout', 'mdi:login', 'mdi:refresh',
  'mdi:view-dashboard', 'mdi:view-grid', 'mdi:list-bulleted', 'mdi:table', 'mdi:text',
  'lucide:home', 'lucide:user', 'lucide:settings', 'lucide:search', 'lucide:heart',
  'lucide:star', 'lucide:bell', 'lucide:mail', 'lucide:phone', 'lucide:map-pin',
  'lucide:calendar', 'lucide:clock', 'lucide:check', 'lucide:x', 'lucide:plus',
  'lucide:menu', 'lucide:more-vertical', 'lucide:chevron-right', 'lucide:arrow-left',
  'lucide:upload', 'lucide:download', 'lucide:share-2', 'lucide:edit', 'lucide:trash-2',
  'lucide:eye', 'lucide:lock', 'lucide:shield', 'lucide:info', 'lucide:alert-circle',
  'lucide:image', 'lucide:file', 'lucide:folder', 'lucide:bar-chart-2', 'lucide:trending-up',
]

function iconUrl(icon: string, color?: string): string {
  const [prefix, ...rest] = icon.split(':')
  const name = rest.join(':')
  if (!prefix || !name) return ''
  return `https://api.iconify.design/${prefix}/${name}.svg${color ? `?color=${encodeURIComponent(color)}` : ''}`
}

type Props = {
  open: boolean
  currentValue?: string
  onClose: () => void
  onSelect: (icon: string) => void
}

export function IconPickerModal({ open, currentValue, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [activePrefix, setActivePrefix] = useState('mdi')
  const [results, setResults] = useState<string[]>(POPULAR)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      search('', activePrefix)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const search = useCallback(async (q: string, prefix: string) => {
    setLoading(true)
    try {
      if (!q.trim()) {
        // Browse mode: fetch the first 80 icons from this collection
        const res = await fetch(`https://api.iconify.design/collection?prefix=${prefix}&limit=80`)
        const data = await res.json()
        // icons object keys are bare names; categories values are arrays of bare names; uncategorized is an array
        let names: string[] = Object.keys(data.icons ?? {})
        if (!names.length) {
          // some collections use uncategorized array
          names = (data.uncategorized as string[] | undefined) ?? []
        }
        if (!names.length) {
          // try flattening category arrays
          names = Object.values((data.categories ?? {}) as Record<string, string[]>).flat()
        }
        setResults(names.slice(0, 80).map(n => `${prefix}:${n}`))
      } else {
        const url = `https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=80&prefix=${prefix}`
        const res = await fetch(url)
        const data = await res.json()
        setResults((data.icons as string[]) ?? [])
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query, activePrefix), 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, activePrefix, open, search])

  const handleSelect = (icon: string) => {
    onSelect(icon)
    onClose()
  }

  const handleCopy = async (icon: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(icon)
    setCopied(icon)
    setTimeout(() => setCopied(null), 1200)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-[680px] max-w-[95vw] max-h-[80vh] flex flex-col bg-white dark:bg-[#161b22] rounded-xl shadow-2xl border border-gray-200 dark:border-[#30363d] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-[#30363d]">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search icons… (e.g. home, arrow, check)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />}
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#21262d]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Prefix tabs */}
        <div className="shrink-0 flex gap-1 px-4 py-2 border-b border-gray-100 dark:border-[#30363d] overflow-x-auto">
          {PREFIXES.map(p => (
            <button
              key={p.id}
              onClick={() => setActivePrefix(p.id)}
              className={`shrink-0 px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                activePrefix === p.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-[#21262d] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#30363d]'
              }`}
            >
              {p.label}
            </button>
          ))}
          <span className="ml-2 self-center text-xs text-gray-400 shrink-0">
            {results.length > 0 ? `${results.length} icons` : 'No results'}
          </span>
        </div>

        {/* Icon grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {results.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
              <span>No icons found for "{query}"</span>
              <span className="text-xs mt-1 text-gray-300">Try a different term or prefix</span>
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-1">
            {results.map(icon => {
              const url = iconUrl(icon, '#4b5563')
              const isActive = icon === currentValue
              return (
                <button
                  key={icon}
                  onClick={() => handleSelect(icon)}
                  title={icon}
                  className={`group relative flex flex-col items-center gap-1 p-2 rounded-lg text-center transition-colors ${
                    isActive
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 ring-2 ring-indigo-500'
                      : 'hover:bg-gray-100 dark:hover:bg-[#21262d]'
                  }`}
                >
                  {url ? (
                    <img
                      src={url}
                      alt={icon}
                      width={24}
                      height={24}
                      className="block opacity-80 dark:invert"
                      style={{ minWidth: 24, minHeight: 24 }}
                    />
                  ) : (
                    <span className="w-6 h-6 flex items-center justify-center text-gray-300 text-xs">?</span>
                  )}
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 leading-tight truncate w-full">
                    {icon.split(':')[1] ?? icon}
                  </span>
                  {/* Copy on right-click / hover action */}
                  <button
                    onClickCapture={e => handleCopy(icon, e)}
                    className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded text-[8px] text-gray-400 hover:text-gray-700 bg-white dark:bg-[#161b22] shadow"
                    title="Copy name"
                  >
                    {copied === icon ? '✓' : '⎘'}
                  </button>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-2.5 border-t border-gray-100 dark:border-[#30363d] flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Click to insert · Right-click button to copy name · Powered by{' '}
            <a
              href="https://iconify.design"
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="underline hover:text-gray-600"
            >
              Iconify
            </a>
          </p>
          {currentValue && (
            <span className="text-xs font-mono text-indigo-500 truncate max-w-[200px]">{currentValue}</span>
          )}
        </div>
      </div>
    </div>
  )
}
