/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, Loader2 } from 'lucide-react'

/** Font category tabs */
const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'sans-serif', label: 'Sans-serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'monospace', label: 'Monospace' },
  { id: 'display', label: 'Display' },
  { id: 'handwriting', label: 'Handwriting' },
]

/** Curated popular fonts shown initially before full API list loads */
const POPULAR_FONTS = [
  { family: 'Inter', category: 'sans-serif' },
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Nunito', category: 'sans-serif' },
  { family: 'Source Sans 3', category: 'sans-serif' },
  { family: 'Noto Sans', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Ubuntu', category: 'sans-serif' },
  { family: 'Oswald', category: 'sans-serif' },
  { family: 'Merriweather', category: 'serif' },
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'Georgia', category: 'serif' },
  { family: 'EB Garamond', category: 'serif' },
  { family: 'Cormorant Garamond', category: 'serif' },
  { family: 'DM Serif Display', category: 'serif' },
  { family: 'Source Serif 4', category: 'serif' },
  { family: 'Fira Code', category: 'monospace' },
  { family: 'JetBrains Mono', category: 'monospace' },
  { family: 'Source Code Pro', category: 'monospace' },
  { family: 'Space Mono', category: 'monospace' },
  { family: 'Inconsolata', category: 'monospace' },
  { family: 'Roboto Mono', category: 'monospace' },
  { family: 'Bebas Neue', category: 'display' },
  { family: 'Anton', category: 'display' },
  { family: 'Righteous', category: 'display' },
  { family: 'Bangers', category: 'display' },
  { family: 'Abril Fatface', category: 'display' },
  { family: 'Pacifico', category: 'handwriting' },
  { family: 'Dancing Script', category: 'handwriting' },
  { family: 'Caveat', category: 'handwriting' },
  { family: 'Satisfy', category: 'handwriting' },
  { family: 'Great Vibes', category: 'handwriting' },
]

type FontEntry = { family: string; category: string }

/** Inject a font CSS link into the document head if not already present */
function injectFontLink(family: string) {
  if (typeof document === 'undefined') return
  const encoded = family.replace(/\s+/g, '+')
  const id = `bunny-font-${encoded}`
  if (document.getElementById(id)) return
  // Preconnect
  if (!document.getElementById('bunny-preconnect')) {
    const pc = document.createElement('link')
    pc.id = 'bunny-preconnect'
    pc.rel = 'preconnect'
    pc.href = 'https://fonts.bunny.net'
    document.head.appendChild(pc)
  }
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.bunny.net/css?family=${encoded}:400`
  document.head.appendChild(link)
}

type Props = {
  open: boolean
  currentValue?: string
  onClose: () => void
  onSelect: (fontFamily: string) => void
}

export function FontPickerModal({ open, currentValue, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [allFonts, setAllFonts] = useState<FontEntry[]>(POPULAR_FONTS)
  const [apiLoaded, setApiLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadedPreviews = useRef<Set<string>>(new Set())

  // Fetch full font list from Bunny Fonts API on first open
  useEffect(() => {
    if (!open || apiLoaded) return
    setLoading(true)
    fetch('https://fonts.bunny.net/api')
      .then((r) => r.json())
      .then((data: Record<string, { category?: string }>) => {
        const fonts: FontEntry[] = Object.entries(data)
          .map(([family, meta]) => ({ family, category: meta?.category ?? 'sans-serif' }))
          .sort((a, b) => a.family.localeCompare(b.family))
        setAllFonts(fonts)
        setApiLoaded(true)
      })
      .catch(() => {
        // Keep curated list on failure
        setApiLoaded(true)
      })
      .finally(() => setLoading(false))
  }, [open, apiLoaded])

  // Focus search + reset on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setActiveCategory('all')
    }
  }, [open])

  // Filtered + searched results
  const results = (() => {
    let list = allFonts
    if (activeCategory !== 'all') list = list.filter((f) => f.category === activeCategory)
    if (query.trim()) {
      const q = String(query ?? '').toLowerCase()
      list = list.filter((f) => String(f.family ?? '').toLowerCase().includes(q))
    }
    return list.slice(0, 120)
  })()

  // Lazy-load font previews as they scroll into view
  const handlePreviewLoad = useCallback((family: string) => {
    if (!loadedPreviews.current.has(family)) {
      loadedPreviews.current.add(family)
      injectFontLink(family)
    }
  }, [])

  const handleSelect = (family: string) => {
    injectFontLink(family)
    onSelect(family)
    onClose()
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
        className="relative z-10 w-[700px] max-w-[95vw] max-h-[85vh] flex flex-col bg-white dark:bg-[#161b22] shadow-2xl border border-gray-200 dark:border-[#30363d] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-[#30363d]">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search fonts… (e.g. Inter, Playfair, Mono)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" />}
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#21262d]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="shrink-0 flex gap-1 px-4 py-2 border-b border-gray-100 dark:border-[#30363d] overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`shrink-0 px-2.5 py-1 text-xs font-medium transition-colors border ${
                activeCategory === c.id
                  ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                  : 'bg-transparent text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#30363d] hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              {c.label}
            </button>
          ))}
          <span className="ml-2 self-center text-xs text-gray-400 shrink-0">
            {results.length} fonts{!apiLoaded && ' (loading…)'}
          </span>
        </div>

        {/* Font list */}
        <div className="flex-1 overflow-y-auto p-3">
          {results.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
              <span>No fonts found for &quot;{query}&quot;</span>
              <span className="text-xs mt-1 text-gray-300">Try a different term or category</span>
            </div>
          )}
          <div className="divide-y divide-gray-100 dark:divide-[#21262d]">
            {results.map((font) => {
              const isActive = font.family === currentValue
              return (
                <FontPreviewRow
                  key={font.family}
                  font={font}
                  isActive={isActive}
                  onVisible={handlePreviewLoad}
                  onSelect={handleSelect}
                />
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-2.5 border-t border-gray-100 dark:border-[#30363d] flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Click to insert · Fonts served by{' '}
            <a
              href="https://fonts.bunny.net"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="underline hover:text-gray-600"
            >
              Bunny Fonts
            </a>{' '}
            (privacy-friendly Google Fonts alternative)
          </p>
          {currentValue && (
            <span className="text-xs font-mono text-gray-500 truncate max-w-[200px]">{currentValue}</span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Individual font row with intersection observer for lazy preview loading */
function FontPreviewRow({
  font,
  isActive,
  onVisible,
  onSelect,
}: {
  font: FontEntry
  isActive: boolean
  onVisible: (family: string) => void
  onSelect: (family: string) => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const notified = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !notified.current) {
          notified.current = true
          onVisible(font.family)
        }
      },
      { rootMargin: '200px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [font.family, onVisible])

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(font.family)}
      className={`w-full flex items-center justify-between gap-4 px-3 py-2.5 text-left transition-colors group ${
        isActive
          ? 'bg-black dark:bg-white'
          : 'hover:bg-gray-50 dark:hover:bg-[#21262d]'
      }`}
    >
      {/* Font name */}
      <div className="shrink-0 w-40">
        <div className={`text-xs font-medium ${isActive ? 'text-white dark:text-black' : 'text-gray-700 dark:text-gray-300'}`}>
          {font.family}
        </div>
        <div className={`text-[10px] ${isActive ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400'}`}>
          {font.category}
        </div>
      </div>

      {/* Font preview */}
      <div
        className={`flex-1 text-lg leading-tight truncate ${isActive ? 'text-white dark:text-black' : 'text-gray-800 dark:text-gray-200'}`}
        style={{ fontFamily: `'${font.family}', sans-serif` }}
      >
        The quick brown fox jumps
      </div>

      {/* Active badge */}
      {isActive && (
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-widest text-white dark:text-black border border-white dark:border-black px-1.5 py-0.5">
          Active
        </span>
      )}
    </button>
  )
}
