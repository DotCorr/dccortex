/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useState, useCallback, useId } from 'react'
import { X, Plus, Trash2, GripVertical, Copy, Check } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type GradientType = 'linear' | 'radial' | 'conic'

interface ColorStop {
  id: string
  color: string
  position: number // 0–100
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2)
}

function stopSort(a: ColorStop, b: ColorStop) {
  return a.position - b.position
}

function buildCSS(type: GradientType, angle: number, stops: ColorStop[]): string {
  const sorted = [...stops].sort(stopSort)
  const stopStr = sorted.map((s) => `${s.color} ${s.position}%`).join(', ')
  if (type === 'linear') return `linear-gradient(${angle}deg, ${stopStr})`
  if (type === 'radial') return `radial-gradient(circle, ${stopStr})`
  return `conic-gradient(from ${angle}deg, ${stopStr})`
}

// ─── Angle Wheel ─────────────────────────────────────────────────────────────

function AngleWheel({ angle, onChange }: { angle: number; onChange: (a: number) => void }) {
  const cx = 32
  const cy = 32
  const r = 24
  const rad = ((angle - 90) * Math.PI) / 180
  const hx = cx + r * Math.cos(rad)
  const hy = cy + r * Math.sin(rad)

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - rect.left - cx
    const dy = e.clientY - rect.top - cy
    let deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI) + 90
    if (deg < 0) deg += 360
    onChange(deg % 360)
  }

  const handleMouseDown = (e: React.MouseEvent<SVGCircleElement>) => {
    e.preventDefault()
    const svg = e.currentTarget.closest('svg') as SVGSVGElement
    const move = (ev: MouseEvent) => {
      const rect = svg.getBoundingClientRect()
      const dx = ev.clientX - rect.left - cx
      const dy = ev.clientY - rect.top - cy
      let deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI) + 90
      if (deg < 0) deg += 360
      onChange(deg % 360)
    }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <svg width={64} height={64} className="cursor-pointer shrink-0" onClick={handleClick}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#d1d5db" strokeWidth={2} className="dark:stroke-[#30363d]" />
      <circle cx={cx} cy={cy} r={2} fill="#6b7280" />
      <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="#000" strokeWidth={2} className="dark:stroke-white" strokeLinecap="round" />
      <circle
        cx={hx}
        cy={hy}
        r={5}
        fill="#000"
        className="dark:fill-white cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      />
    </svg>
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  initialValue?: string
  onClose: () => void
  onApply: (payload: { css: string }) => void
}

const DEFAULT_STOPS: ColorStop[] = [
  { id: uid(), color: '#667eea', position: 0 },
  { id: uid(), color: '#764ba2', position: 100 },
]

export function GradientBuilderModal({ open, initialValue, onClose, onApply }: Props) {
  const [type, setType] = useState<GradientType>('linear')
  const [angle, setAngle] = useState(135)
  const [stops, setStops] = useState<ColorStop[]>(DEFAULT_STOPS)
  const [dragging, setDragging] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const css = buildCSS(type, angle, stops)

  const addStop = useCallback(() => {
    const sorted = [...stops].sort(stopSort)
    // Insert midpoint between last two stops
    const a = sorted[sorted.length - 2] ?? sorted[0]
    const b = sorted[sorted.length - 1]
    const mid = Math.round((a.position + b.position) / 2)
    // Pick a midpoint color (just blend hex naively)
    setStops((prev) => [...prev, { id: uid(), color: '#ffffff', position: mid }])
  }, [stops])

  const removeStop = useCallback((id: string) => {
    setStops((prev) => prev.length > 2 ? prev.filter((s) => s.id !== id) : prev)
  }, [])

  const updateStop = useCallback((id: string, patch: Partial<ColorStop>) => {
    setStops((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s))
  }, [])

  // Drag position on the gradient bar
  const handleBarMouseDown = useCallback((id: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(id)
    const bar = (e.currentTarget.parentElement as HTMLElement)
    const move = (ev: MouseEvent) => {
      const rect = bar.getBoundingClientRect()
      const pct = Math.min(100, Math.max(0, Math.round(((ev.clientX - rect.left) / rect.width) * 100)))
      setStops((prev) => prev.map((s) => s.id === id ? { ...s, position: pct } : s))
    }
    const up = () => { setDragging(null); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [])

  const copyCSS = useCallback(() => {
    navigator.clipboard.writeText(css).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [css])

  if (!open) return null

  const sortedStops = [...stops].sort(stopSort)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 w-[520px] max-w-[95vw] max-h-[90vh] bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#30363d] shrink-0">
          <h2 className="text-sm font-semibold text-black dark:text-white tracking-wide uppercase">Gradient Picker</h2>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-black dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Type tabs */}
          <div className="flex gap-1">
            {(['linear', 'radial', 'conic'] as GradientType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 text-xs font-medium border capitalize transition-colors ${
                  type === t
                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                    : 'border-gray-300 dark:border-[#30363d] text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Live preview */}
          <div
            className="w-full h-16 border border-gray-200 dark:border-[#30363d]"
            style={{ background: css }}
          />

          {/* Gradient bar with draggable stops */}
          <div>
            <div className="text-[10px] text-gray-400 mb-1.5 uppercase tracking-wide">Color stops</div>
            <div className="relative h-8 border border-gray-200 dark:border-[#30363d]" style={{ background: `linear-gradient(90deg, ${sortedStops.map((s) => `${s.color} ${s.position}%`).join(', ')})` }}>
              {stops.map((s) => (
                <div
                  key={s.id}
                  title={`${s.color} @ ${s.position}%`}
                  className={`absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize flex flex-col items-center justify-between py-0.5 ${dragging === s.id ? 'z-20' : 'z-10'}`}
                  style={{ left: `${s.position}%` }}
                  onMouseDown={(e) => handleBarMouseDown(s.id, e)}
                >
                  <div className="w-2.5 h-2.5 border-2 border-white shadow-md" style={{ background: s.color }} />
                  <div className="w-2.5 h-2.5 border-2 border-white shadow-md" style={{ background: s.color }} />
                </div>
              ))}
            </div>
          </div>

          {/* Stop list */}
          <div className="space-y-2">
            {sortedStops.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-4 shrink-0">{i + 1}</span>
                <input
                  type="color"
                  value={s.color.match(/^#[0-9A-Fa-f]{3,8}$/) ? s.color : '#ffffff'}
                  onChange={(e) => updateStop(s.id, { color: e.target.value })}
                  className="w-7 h-7 border border-gray-300 dark:border-[#30363d] cursor-pointer shrink-0 p-0"
                />
                <input
                  type="text"
                  value={s.color}
                  onChange={(e) => updateStop(s.id, { color: e.target.value })}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono"
                  placeholder="#hex or rgba()"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={s.position}
                    onChange={(e) => updateStop(s.id, { position: Math.min(100, Math.max(0, Number(e.target.value))) })}
                    className="w-12 px-1.5 py-1 text-xs border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono text-center"
                  />
                  <span className="text-[10px] text-gray-400">%</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeStop(s.id)}
                  disabled={stops.length <= 2}
                  className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addStop}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black dark:hover:text-white mt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add stop
            </button>
          </div>

          {/* Angle (linear + conic only) */}
          {(type === 'linear' || type === 'conic') && (
            <div>
              <div className="text-[10px] text-gray-400 mb-2 uppercase tracking-wide">
                {type === 'linear' ? 'Direction' : 'Start angle'}
              </div>
              <div className="flex items-center gap-3">
                <AngleWheel angle={angle} onChange={setAngle} />
                <div className="flex-1">
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={angle}
                    onChange={(e) => setAngle(Number(e.target.value))}
                    className="w-full accent-black dark:accent-white"
                  />
                  <div className="flex justify-between mt-1">
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAngle(a)}
                        className={`text-[9px] w-6 py-0.5 border transition-colors ${
                          angle === a
                            ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                            : 'border-gray-300 dark:border-[#30363d] text-gray-500 hover:border-black dark:hover:border-white'
                        }`}
                      >
                        {a}°
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={angle}
                  onChange={(e) => setAngle(Number(e.target.value) % 360)}
                  className="w-14 px-2 py-1 text-sm border border-gray-300 dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-black dark:text-white font-mono text-center shrink-0"
                />
              </div>
            </div>
          )}

          {/* CSS output */}
          <div>
            <div className="text-[10px] text-gray-400 mb-1.5 uppercase tracking-wide">CSS output</div>
            <div className="flex gap-1">
              <input
                type="text"
                readOnly
                value={css}
                className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-[#30363d] bg-gray-50 dark:bg-[#161b22] text-black dark:text-white font-mono"
              />
              <button
                type="button"
                onClick={copyCSS}
                className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-[#30363d] text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white shrink-0 flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-[#30363d] p-2.5 text-[11px] text-gray-500 dark:text-gray-400">
            Gradient motion has been centralized in the Animation tab. Apply colors here, then configure movement and expression bindings in Animate.
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-200 dark:border-[#30363d] shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm border border-gray-300 dark:border-[#30363d] text-gray-600 dark:text-gray-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onApply({ css })
              onClose()
            }}
            className="flex-1 py-1.5 text-sm bg-black dark:bg-white text-white dark:text-black font-medium hover:bg-gray-800 dark:hover:bg-gray-200"
          >
            Apply gradient
          </button>
        </div>
      </div>
    </div>
  )
}
