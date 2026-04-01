/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import React from 'react'
import { LayoutGrid, FileInput, Type, MousePointer, Box, Square, AlignVerticalSpaceAround, AlignHorizontalSpaceAround, Image, Table, Link as LinkIcon, Hash, List, CheckSquare, Hand, BarChart2, LineChart, PieChart, TrendingUp, Cookie, LayoutList, Layers, Activity, Hexagon, Gauge, Filter, Minus, Grid3X3, CircleDot } from 'lucide-react'
import { getAllComponentDefs } from './registry'
import { clearBuilderDragPayload, setBuilderDragPayload } from './drag-payload'

const PALETTE_CATEGORIES = ['All', 'Layout', 'Form', 'Display', 'Actions', 'Charts'] as const

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Layout: LayoutGrid,
  Form: FileInput,
  Display: Type,
  Actions: MousePointer,
  Charts: BarChart2,
}

const COMPONENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  container: Box,
  section: Square,
  stackV: AlignVerticalSpaceAround,
  stackH: AlignHorizontalSpaceAround,
  header: Box,
  main: Box,
  footer: Box,
  nav: Box,
  aside: Box,
  article: Box,
  divider: Square,
  spacer: AlignVerticalSpaceAround,
  text: Type,
  image: Image,
  table: Table,
  button: MousePointer,
  link: LinkIcon,
  textInput: FileInput,
  numberInput: Hash,
  dropdown: List,
  checkbox: CheckSquare,
  gestureDetector: Hand,
  lineChart: LineChart,
  barChart: BarChart2,
  pieChart: PieChart,
  areaChart: TrendingUp,
  doughnutChart: Cookie,
  horizontalBarChart: LayoutList,
  stackedBarChart: Layers,
  scatterChart: Activity,
  radarChart: Hexagon,
  gaugeChart: Gauge,
  funnelChart: Filter,
  stepLineChart: Minus,
  heatmapChart: Grid3X3,
  bubbleChart: CircleDot,
}

type Props = {
  onDragStart?: (type: string) => void
  onAddComponent?: (type: string) => void
  autoCloseAfterAdd?: boolean
  onAutoCloseAfterAddChange?: (enabled: boolean) => void
  onRequestClose?: () => void
  scrollStorageKey?: string
}

/** Reusable instance is only added when inserting from Global Reusables pane; hide from palette. */
const PALETTE_HIDDEN_TYPES = new Set(['reusableInstance'])

export function ComponentPalette({ onDragStart, onAddComponent, autoCloseAfterAdd = false, onAutoCloseAfterAddChange, onRequestClose, scrollStorageKey }: Props) {
  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState<string>('All')
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const allDefs = getAllComponentDefs().filter((c) => !PALETTE_HIDDEN_TYPES.has(c.id))
  const categoryFiltered = category === 'All' ? allDefs : allDefs.filter((c) => c.category === category)
  const q = String(search ?? '').trim().toLowerCase()
  const filtered = q ? categoryFiltered.filter((c) => String(c.label ?? '').toLowerCase().includes(q) || String(c.id ?? '').toLowerCase().includes(q) || String(c.category ?? '').toLowerCase().includes(q)) : null

  const addComponent = (id: string) => {
    onAddComponent?.(id)
    if (onAddComponent && autoCloseAfterAdd) onRequestClose?.()
  }

  React.useEffect(() => {
    if (!scrollStorageKey || typeof window === 'undefined' || !scrollRef.current) return
    try {
      const raw = window.localStorage.getItem(`${scrollStorageKey}:scrollTop`)
      if (raw) scrollRef.current.scrollTop = Math.max(0, Number(raw) || 0)
    } catch {}
  }, [scrollStorageKey])

  React.useEffect(() => {
    if (!scrollStorageKey || typeof window === 'undefined' || !scrollRef.current) return
    const el = scrollRef.current
    const onScroll = () => {
      try { window.localStorage.setItem(`${scrollStorageKey}:scrollTop`, String(el.scrollTop)) } catch {}
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollStorageKey])

  return (
    <div ref={scrollRef} className="p-3 border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] h-full overflow-auto shrink-0 flex flex-col">
      <div className="mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search components…"
          className="w-full text-xs px-2.5 py-1.5 rounded border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="mb-3 grid grid-cols-3 gap-1">
        {PALETTE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`px-2 py-1 text-[10px] rounded-full border text-center whitespace-nowrap ${category === cat ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'border-gray-200 dark:border-[#30363d] text-gray-600 dark:text-gray-300'}`}
          >
            {cat}
          </button>
        ))}
      </div>
      {onAddComponent && onAutoCloseAfterAddChange && (
        <label className="mb-3 inline-flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={autoCloseAfterAdd}
            onChange={(e) => onAutoCloseAfterAddChange?.(e.target.checked)}
          />
          Auto-close after add
        </label>
      )}
      {filtered ? (
        filtered.length === 0 ? (
          <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">No components match &ldquo;{search}&rdquo;</div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((c) => {
              const Icon = COMPONENT_ICONS[c.id]
              return (
                <li
                  key={c.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: c.id }))
                    e.dataTransfer.setData('text/plain', c.label)
                    e.dataTransfer.effectAllowed = 'copy'
                    setBuilderDragPayload({ kind: 'component', type: c.id })
                    onDragStart?.(c.id)
                  }}
                  onDragEnd={() => clearBuilderDragPayload()}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white text-sm cursor-grab active:cursor-grabbing hover:border-gray-300 dark:hover:border-gray-600 rounded"
                >
                  {Icon && <Icon className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" />}
                  <span className="truncate">{c.label}</span>
                  <span className="ml-auto text-[10px] text-gray-400 shrink-0">{c.category}</span>
                  {onAddComponent && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); addComponent(c.id) }}
                      className="ml-1 shrink-0 px-1.5 py-0.5 rounded border border-gray-200 dark:border-[#30363d] text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]"
                      title={`Add ${c.label} to canvas`}
                    >
                      +
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )
      ) : (
        PALETTE_CATEGORIES.filter((cat) => cat !== 'All').map((cat) => {
          const items = categoryFiltered.filter((c) => c.category === cat)
          if (items.length === 0) return null
          const CatIcon = CATEGORY_ICONS[cat]
          return (
            <div key={cat} className="mb-4">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                {CatIcon && <CatIcon className="w-3.5 h-3.5" />}
                {cat}
              </div>
              <ul className="space-y-1">
                {items.map((c) => {
                  const Icon = COMPONENT_ICONS[c.id]
                  return (
                    <li
                      key={c.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/json', JSON.stringify({ type: c.id }))
                        e.dataTransfer.setData('text/plain', c.label)
                        e.dataTransfer.effectAllowed = 'copy'
                        setBuilderDragPayload({ kind: 'component', type: c.id })
                        onDragStart?.(c.id)
                      }}
                      onDragEnd={() => clearBuilderDragPayload()}
                      className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white text-sm cursor-grab active:cursor-grabbing hover:border-gray-300 dark:hover:border-gray-600 rounded"
                    >
                      {Icon && <Icon className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" />}
                      <span className="truncate">{c.label}</span>
                      {onAddComponent && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); addComponent(c.id) }}
                          className="ml-auto shrink-0 px-1.5 py-0.5 rounded border border-gray-200 dark:border-[#30363d] text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d]"
                          title={`Add ${c.label} to canvas`}
                        >
                          +
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })
      )}
    </div>
  )
}
