/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { detectDesktopShell } from '@/components/tauri-detector'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { ProductSwitcher } from '@/components/product-switcher'
import { LiveRadioIndicator } from '@/components/live-radio-indicator'
import {
  Layers, Zap, Globe, Shield, Code2, ArrowRight, ChevronRight,
  Building2, Landmark, Factory, Stethoscope, Truck, GraduationCap,
  MousePointerClick, Sparkles, Database, Workflow, Check, Menu, X,
  LayoutGrid, Table2, BarChart3, FormInput, PanelLeftClose, Eye,
  GitBranch, Lock, Server, Plug, RefreshCw, Clock, FileCheck2,
  Container, Box, Network, Terminal,
  Gauge, Scale, CircuitBoard, Hexagon
} from 'lucide-react'

/* ───────────── fade-in-on-scroll ───────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } },
      { threshold: 0.15 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, visible }
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useReveal()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

/* ───────────── Rotating badge — simple benefits ───────────── */
function RuntimeBadge() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setIndex(i => (i + 1) % 4), 4000)
    return () => clearInterval(interval)
  }, [])

  const items = [
    'Describe your app → AI builds UI + backend',
    'Drag and drop to customize everything',
    'One click to deploy full stack',
    'You own everything — data, code, and hosting',
  ]

  return (
    <div className="w-full max-w-xl mx-auto mb-6 px-4 py-2.5 text-xs sm:text-sm font-medium text-primary bg-primary/10 border border-primary/20 text-center">
      <span className="relative block min-h-[20px] overflow-hidden">
        {items.map((text, i) => (
          <span
            key={i}
            className="absolute inset-0 transition-all duration-500"
            style={{
              opacity: index === i ? 1 : 0,
              transform: index === i ? 'translateY(0)' : 'translateY(18px)',
            }}
          >
            {text}
          </span>
        ))}
      </span>
    </div>
  )
}

/* ───────────── Hero illustration — realistic DCFlow editor mockup ───────────── */
function HeroIllustration() {
  const [activeScreen, setActiveScreen] = useState(0)
  const screens = [
    { name: 'Dashboard', active: true },
    { name: 'Bookings', active: false },
    { name: 'Clients', active: false },
    { name: 'Analytics', active: false },
  ]

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      <div className="absolute -inset-10 bg-gradient-to-br from-cyan-500/10 via-transparent to-emerald-500/8 blur-3xl" />
      {/* App chrome */}
      <div className="relative bg-[#0d0d0d] border border-white/10 shadow-2xl shadow-black/50 overflow-hidden rounded-lg">
        {/* Top bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#111] border-b border-white/[0.07]">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[10px] text-white/30">Projects /</span>
              <span className="text-[10px] text-white/70 font-medium">SalonTime App</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] text-white/60">Gemini 2.5 Flash</span>
            </div>
            <div className="px-3 py-1 bg-cyan-500 text-[10px] font-semibold text-black rounded cursor-pointer">
              Generate Flow
            </div>
          </div>
        </div>

        <div className="flex h-[420px]">
          {/* Left panel — screen list */}
          <div className="w-[160px] flex-shrink-0 border-r border-white/[0.07] bg-[#111] flex flex-col hidden lg:flex">
            <div className="px-3 pt-3 pb-2 flex items-center justify-between">
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Screens</span>
              <span className="text-[10px] text-white/40">{screens.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-2 space-y-1.5">
              {screens.map((s, i) => (
                <button
                  key={s.name}
                  onClick={() => setActiveScreen(i)}
                  className={`w-full text-left rounded overflow-hidden border transition-all ${
                    activeScreen === i
                      ? 'border-cyan-500/50 ring-1 ring-cyan-500/20'
                      : 'border-white/[0.06] hover:border-white/20'
                  }`}
                >
                  {/* Mini screen thumbnail */}
                  <div className="h-[68px] bg-[#0a0a12] relative overflow-hidden">
                    {i === 0 && (
                      <>
                        <div className="absolute top-0 left-0 right-0 h-4 bg-[#111827] flex items-center gap-1 px-1.5">
                          <div className="w-8 h-1.5 bg-white/20 rounded" />
                          <div className="flex gap-0.5 ml-auto">
                            {[...Array(3)].map((_, j) => <div key={j} className="w-1 h-1 bg-white/10 rounded-sm" />)}
                          </div>
                        </div>
                        <div className="absolute top-5 left-1.5 right-1.5 grid grid-cols-3 gap-0.5">
                          {[...Array(3)].map((_, j) => (
                            <div key={j} className="h-7 bg-[#1a2035] rounded-sm" />
                          ))}
                        </div>
                        <div className="absolute bottom-1 left-1.5 right-1.5 h-2 bg-[#0f1929] rounded-sm" />
                      </>
                    )}
                    {i === 1 && (
                      <>
                        <div className="absolute top-0 left-0 right-0 h-4 bg-[#111] flex items-center px-1.5 gap-1">
                          <div className="w-6 h-1.5 bg-cyan-500/30 rounded" />
                        </div>
                        <div className="absolute top-5 left-1.5 right-1.5 space-y-1">
                          {[...Array(4)].map((_, j) => (
                            <div key={j} className="flex gap-1">
                              <div className="h-2 flex-1 bg-white/5 rounded-sm" />
                              <div className="h-2 w-8 bg-white/5 rounded-sm" />
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {i === 2 && (
                      <>
                        <div className="absolute inset-1.5 grid grid-cols-2 gap-1">
                          {[...Array(4)].map((_, j) => (
                            <div key={j} className="bg-[#1a1a2e] rounded-sm flex items-center gap-0.5 px-1">
                              <div className="w-2.5 h-2.5 rounded-full bg-white/10 flex-shrink-0" />
                              <div className="h-1.5 flex-1 bg-white/8 rounded" />
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {i === 3 && (
                      <>
                        <div className="absolute top-1.5 left-1.5 right-1.5 h-10 bg-[#0f1929] rounded-sm overflow-hidden">
                          <div className="absolute bottom-0 left-1 flex items-end gap-0.5 h-full pt-2">
                            {[40, 65, 45, 80, 60, 90, 55].map((h, j) => (
                              <div key={j} className="w-2 bg-cyan-500/50 rounded-t-sm" style={{ height: `${h}%` }} />
                            ))}
                          </div>
                        </div>
                        <div className="absolute bottom-1 left-1.5 right-1.5 h-2 bg-white/5 rounded-sm" />
                      </>
                    )}
                  </div>
                  <div className="px-2 py-1.5 bg-[#0f0f0f]">
                    <div className="text-[9px] text-white/60 font-medium">{s.name}</div>
                  </div>
                </button>
              ))}
              {/* Generating skeleton */}
              <div className="w-full rounded border border-dashed border-white/10 overflow-hidden opacity-60">
                <div className="h-[68px] bg-[#0d0d0d] flex flex-col items-center justify-center gap-1.5">
                  <div className="w-4 h-4 rounded-full border border-cyan-500/50 border-t-cyan-500 animate-spin" />
                  <div className="text-[8px] text-white/30">Generating…</div>
                </div>
                <div className="px-2 py-1.5 bg-[#0f0f0f]">
                  <div className="h-1.5 w-12 bg-white/10 rounded" />
                </div>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div
            className="flex-1 bg-[#0a0a0a] relative overflow-hidden"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          >
            {/* Active screen frame on canvas */}
            <div className="absolute inset-6 lg:inset-8">
              <div className="relative w-full h-full border border-cyan-500/30 shadow-[0_0_0_1px_rgba(6,182,212,0.1)] rounded-sm overflow-hidden">
                {/* Screen label */}
                <div className="absolute -top-5 left-0 flex items-center gap-1.5">
                  <span className="text-[9px] text-white/30 font-medium">{screens[activeScreen].name}</span>
                  <span className="text-[8px] px-1 py-0.5 bg-cyan-500/10 text-cyan-400 rounded">active</span>
                </div>

                {/* Realistic generated screen — SalonTime Dashboard */}
                {activeScreen === 0 && (
                  <div className="w-full h-full bg-[#08090f] overflow-hidden">
                    {/* Top nav */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e1018] border-b border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-sm" />
                        <span className="text-[10px] text-white font-semibold">SalonTime</span>
                        <div className="flex gap-3 ml-3">
                          {['Overview', 'Bookings', 'Staff', 'Reports'].map((tab, i) => (
                            <span key={tab} className={`text-[9px] ${i === 0 ? 'text-cyan-400 border-b border-cyan-400 pb-0.5' : 'text-white/30'}`}>{tab}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
                        <span className="text-[9px] text-white/50">Anna K.</span>
                      </div>
                    </div>
                    {/* KPI row */}
                    <div className="grid grid-cols-4 gap-2 px-4 pt-3 pb-2">
                      {[
                        { label: 'Bookings Today', val: '24', delta: '+3', color: 'text-cyan-400' },
                        { label: 'Revenue MTD', val: '€4,820', delta: '+12%', color: 'text-emerald-400' },
                        { label: 'Active Clients', val: '183', delta: '+7', color: 'text-blue-400' },
                        { label: 'Open Slots', val: '8', delta: '-2', color: 'text-amber-400' },
                      ].map(({ label, val, delta, color }) => (
                        <div key={label} className="bg-[#0e1018] border border-white/[0.07] rounded p-2">
                          <div className="text-[8px] text-white/30 mb-1">{label}</div>
                          <div className={`text-sm font-bold ${color}`}>{val}</div>
                          <div className="text-[8px] text-white/30 mt-0.5">{delta} this week</div>
                        </div>
                      ))}
                    </div>
                    {/* Chart + table row */}
                    <div className="grid grid-cols-[1fr_140px] gap-2 px-4">
                      <div className="bg-[#0e1018] border border-white/[0.07] rounded p-2.5">
                        <div className="text-[9px] text-white/40 mb-2 font-medium">Bookings — Last 7 Days</div>
                        <div className="flex items-end gap-1 h-16">
                          {[5, 9, 7, 12, 8, 14, 10].map((h, i) => (
                            <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${(h / 14) * 100}%`, background: i === 5 ? 'rgb(6 182 212)' : 'rgba(6,182,212,0.25)' }} />
                          ))}
                        </div>
                        <div className="flex justify-between mt-1">
                          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                            <span key={i} className="text-[7px] text-white/20 flex-1 text-center">{d}</span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-[#0e1018] border border-white/[0.07] rounded p-2.5">
                        <div className="text-[9px] text-white/40 mb-2 font-medium">Next Appointments</div>
                        <div className="space-y-1.5">
                          {[
                            { name: 'Emma R.', time: '10:00', type: 'Cut' },
                            { name: 'Sofia M.', time: '11:30', type: 'Color' },
                            { name: 'Laura B.', time: '13:00', type: 'Style' },
                          ].map(({ name, time, type }) => (
                            <div key={name} className="flex items-center gap-1.5">
                              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500/50 to-pink-500/50 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-[8px] text-white/70 truncate">{name}</div>
                                <div className="text-[7px] text-white/30">{time} · {type}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeScreen === 1 && (
                  <div className="w-full h-full bg-[#08090f] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e1018] border-b border-white/[0.06]">
                      <span className="text-[10px] text-white font-semibold">Bookings</span>
                      <div className="flex gap-1.5">
                        <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-[9px] text-cyan-400 rounded">+ New</span>
                        <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-[9px] text-white/40 rounded">Filter</span>
                      </div>
                    </div>
                    <div className="px-4 pt-2">
                      <div className="grid grid-cols-5 gap-2 px-2 pb-1 border-b border-white/[0.06]">
                        {['Client', 'Service', 'Staff', 'Time', 'Status'].map(h => (
                          <span key={h} className="text-[8px] text-white/25 uppercase tracking-wider font-medium">{h}</span>
                        ))}
                      </div>
                      {[
                        ['Emma Rodriguez', 'Haircut', 'Maria', '10:00', 'confirmed'],
                        ['Sofia Müller', 'Color', 'Lisa', '11:30', 'pending'],
                        ['Laura Bianchi', 'Style', 'Maria', '13:00', 'confirmed'],
                        ['Anna Novak', 'Trim', 'Sara', '14:30', 'cancelled'],
                        ['Petra Koch', 'Highlights', 'Lisa', '15:00', 'confirmed'],
                      ].map(([client, service, staff, time, status]) => (
                        <div key={client} className="grid grid-cols-5 gap-2 px-2 py-1.5 border-b border-white/[0.03] hover:bg-white/[0.02]">
                          <span className="text-[9px] text-white/70">{client}</span>
                          <span className="text-[9px] text-white/50">{service}</span>
                          <span className="text-[9px] text-white/50">{staff}</span>
                          <span className="text-[9px] text-white/50">{time}</span>
                          <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded-full w-fit ${
                            status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-400' :
                            status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
                            'bg-red-500/15 text-red-400'
                          }`}>{status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(activeScreen === 2 || activeScreen === 3) && (
                  <div className="w-full h-full bg-[#08090f] flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-8 h-8 rounded-full border border-cyan-500/40 border-t-cyan-500 animate-spin mx-auto mb-2" />
                      <div className="text-[10px] text-white/30">AI is writing this screen…</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Zoom controls */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-[#111]/80 border border-white/[0.08] rounded px-2 py-1">
              <button className="text-[10px] text-white/40 hover:text-white/70 px-1">−</button>
              <span className="text-[9px] text-white/30">78%</span>
              <button className="text-[10px] text-white/40 hover:text-white/70 px-1">+</button>
            </div>
          </div>

          {/* Right panel — AI chat */}
          <div className="w-[200px] flex-shrink-0 border-l border-white/[0.07] bg-[#111] flex flex-col hidden lg:flex">
            <div className="px-3 pt-3 pb-2 border-b border-white/[0.06] flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] text-white/60 font-medium">AI Chat</span>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {/* User message */}
              <div className="flex justify-end">
                <div className="max-w-[140px] bg-cyan-500/15 border border-cyan-500/20 rounded-lg rounded-tr-sm px-2.5 py-2 text-[9px] text-white/80 leading-relaxed">
                  Design a salon booking dashboard with revenue and upcoming appointments
                </div>
              </div>
              {/* AI response */}
              <div className="flex gap-1.5">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex-shrink-0 mt-0.5" />
                <div className="max-w-[150px] bg-white/[0.04] border border-white/[0.08] rounded-lg rounded-tl-sm px-2.5 py-2 text-[9px] text-white/60 leading-relaxed">
                  Generated 4 screens for SalonTime — Dashboard, Bookings, Clients, and Analytics.
                </div>
              </div>
              {/* User message */}
              <div className="flex justify-end">
                <div className="max-w-[140px] bg-cyan-500/15 border border-cyan-500/20 rounded-lg rounded-tr-sm px-2.5 py-2 text-[9px] text-white/80 leading-relaxed">
                  Add a dark sidebar and make the KPI cards more prominent
                </div>
              </div>
              {/* AI typing */}
              <div className="flex gap-1.5">
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex-shrink-0 mt-0.5" />
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg rounded-tl-sm px-2.5 py-2">
                  <div className="flex gap-1">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1 h-1 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Input */}
            <div className="px-2 pb-2">
              <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5">
                <input
                  className="flex-1 bg-transparent text-[9px] text-white/50 placeholder-white/20 outline-none"
                  placeholder="Describe changes…"
                  readOnly
                />
                <ArrowRight className="w-3 h-3 text-cyan-500 flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Caption */}
      <div className="text-center mt-4 text-[11px] text-muted-foreground">
        SalonTime project — generated from a single prompt in DCFlow
      </div>
    </div>
  )
}

/* ───────────── Container architecture illustration ───────────── */
function ArchitectureIllustration() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="bg-card border border-border shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-muted border-b border-border">
          <Network className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground font-medium">Self-Hosted Stack</span>
        </div>
        <div className="p-5 space-y-3">
          {/* Request */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 px-3 py-2 border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/5">
              <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase">Your Domain</div>
              <div className="text-xs text-blue-900 dark:text-blue-200">HTTPS → <span className="font-medium">your server</span></div>
            </div>
          </div>
          <div className="flex justify-center"><div className="w-px h-5 bg-border" /></div>
          {/* Frontend */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <LayoutGrid className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 px-3 py-2 border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5">
              <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Dashboard</div>
              <div className="text-xs text-emerald-900 dark:text-emerald-200">Next.js — <span className="font-medium">builder + app preview</span></div>
            </div>
          </div>
          <div className="flex justify-center"><div className="w-px h-5 bg-border" /></div>
          {/* Backend */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Server className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 px-3 py-2 border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5">
              <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase">Platform API</div>
              <div className="text-xs text-amber-900 dark:text-amber-200">REST API — <span className="font-medium">projects, screens, data</span></div>
            </div>
          </div>
          <div className="flex justify-center"><div className="w-px h-5 bg-border" /></div>
          {/* Database */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center flex-shrink-0">
              <Database className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 px-3 py-2 border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/5">
              <div className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 uppercase">PostgreSQL</div>
              <div className="text-xs text-purple-900 dark:text-purple-200">Your data — <span className="font-medium">on your infrastructure</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────────── Main page ───────────── */
export default function Home() {
  const { data: session, status } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [isTauri, setIsTauri] = useState(false)

  useEffect(() => {
    let attempts = 0
    const timer = setInterval(() => {
      attempts += 1
      if (detectDesktopShell()) {
        setIsTauri(true)
        clearInterval(timer)
        return
      }
      if (attempts >= 20) {
        clearInterval(timer)
      }
    }, 100)

    if (detectDesktopShell()) {
      setIsTauri(true)
      clearInterval(timer)
    }

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const ctaHref = status === 'authenticated' ? '/dashboard' : '/login'
  const ctaLabel = status === 'authenticated' ? 'Go to Dashboard' : status === 'loading' ? 'Loading…' : 'Start Building'

  return (
    <div className="landing-monochrome min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── NAVBAR ── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-background/90 backdrop-blur-md border-b border-border shadow-sm' : 'bg-transparent'
        }`}
        {...(isTauri ? { 'data-tauri-drag-region': true } as any : {})}
      >
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <Logo size="w-7 h-7" />
              <span className="text-sm sm:text-base lg:text-lg font-bold tracking-tight text-foreground">DCCortex</span>
            </Link>
            <span
              aria-label="Alpha release badge"
              className="hidden sm:inline-flex items-center bg-foreground text-background text-[10px] font-extrabold tracking-wider px-2 py-1 border border-border uppercase leading-none"
            >
              Alpha
            </span>
            <ProductSwitcher current="dccortex" />
            <LiveRadioIndicator />
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#compliance" className="hover:text-foreground transition-colors">Compliance</a>
            <a href="#infrastructure" className="hover:text-foreground transition-colors">Hosting</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {!session && (
              <Link href="/login" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Log in
              </Link>
            )}
            {session && (
              <button
                onClick={() => { window.location.href = '/api/auth/logout' }}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            )}
            <Link href={ctaHref} className="px-5 py-2.5 text-sm font-medium bg-foreground text-background hover:opacity-90 transition-all hover:-translate-y-px">
              {ctaLabel}
            </Link>
          </div>

          <button className="md:hidden p-2 text-foreground" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-background border-b border-border px-6 pb-4 space-y-3">
            <a href="#how-it-works" className="block text-sm text-muted-foreground py-1" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#features" className="block text-sm text-muted-foreground py-1" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#pricing" className="block text-sm text-muted-foreground py-1" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href="#compliance" className="block text-sm text-muted-foreground py-1" onClick={() => setMobileMenuOpen(false)}>Compliance</a>
            <a href="#infrastructure" className="block text-sm text-muted-foreground py-1" onClick={() => setMobileMenuOpen(false)}>Hosting</a>
            <div className="py-1"><ProductSwitcher current="dccortex" /></div>
            <div className="flex gap-3 pt-2">
              {!session && <Link href="/login" className="text-sm font-medium text-foreground">Log in</Link>}
              {session && (
                <button onClick={() => { window.location.href = '/api/auth/logout' }} className="text-sm font-medium text-muted-foreground">
                  Sign out
                </button>
              )}
              <Link href={ctaHref} className="px-4 py-2 text-sm font-medium bg-foreground text-background">{ctaLabel}</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04] dark:opacity-[0.08]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <Reveal>
              <RuntimeBadge />
            </Reveal>
            <Reveal delay={100}>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.08] mb-6">
                Full-stack apps,<br />
                ridiculously simple.
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-10">
                Describe what you want. AI builds the UI, backend flows, data model, and APIs.
                Customize visually and ship full-stack apps in one workflow.
                Self-hosted by default, with no vendor lock-in.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href={ctaHref}
                  className="group px-8 py-3.5 text-base font-semibold bg-foreground text-background hover:opacity-90 transition-all hover:-translate-y-px flex items-center gap-2"
                >
                  {ctaLabel}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="#how-it-works"
                  className="px-8 py-3.5 text-base font-semibold border border-border text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                >
                  See how it works
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </Reveal>
          </div>

          <Reveal delay={400}>
            <HeroIllustration />
          </Reveal>
        </div>
      </section>

      {/* ── QUICK NAV ── */}
      <section className="py-12 md:py-16 bg-card/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal delay={50}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Full-Stack + Self-Hosted', href: '#infrastructure', icon: Server },
                { label: 'Visual Builder', href: '#features', icon: MousePointerClick },
                { label: 'AI Design (DCFlow)', href: 'https://flow.dccortex.com', icon: Sparkles },
                { label: 'Pricing', href: '#pricing', icon: Check },
              ].map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  className="flex items-center gap-3 p-3 border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors group"
                >
                  <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors ml-auto" />
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── KEY STATS ── */}
      <section className="py-16 md:py-20 border-b border-border">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
              {[
                { stat: 'AI-Powered', label: 'Describe what you need and the AI builds it for you' },
                { stat: 'No Code', label: 'Drag and drop to design screens, tables, charts, and forms' },
                { stat: 'One-Click Deploy', label: 'Go from idea to live app without touching a terminal' },
                { stat: 'You Own It', label: 'Your data, your servers — nothing locked into someone else\'s cloud' },
              ].map(({ stat, label }, i) => (
                <Reveal key={stat} delay={i * 60}>
                  <div className="text-center">
                    <div className="text-2xl md:text-3xl font-black text-foreground mb-2">{stat}</div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
          <Reveal>
            <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-widest mb-8">
              Used by teams that want to build fast and stay in control
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              {[
                { icon: Building2, label: 'Startups' },
                { icon: Landmark, label: 'Government' },
                { icon: Factory, label: 'Enterprise' },
                { icon: Stethoscope, label: 'Healthcare' },
                { icon: Truck, label: 'Logistics' },
                { icon: GraduationCap, label: 'Education' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── THE PROBLEM ── */}
      <section className="py-20 md:py-24 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="max-w-4xl mx-auto text-center mb-14">
              <p className="text-xs font-semibold text-foreground uppercase tracking-[0.2em] mb-4">The Problem</p>
              <h2 className="text-3xl md:text-5xl font-black text-foreground leading-tight mb-5">
                Other tools build your app.<br />Then hold it hostage.
              </h2>
              <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Most no-code and AI tools keep your app on their servers. You can&apos;t move it. You can&apos;t control it.
                If they raise prices or shut down, you&apos;re stuck. DCCortex is different — a practical self-hosted replacement for Budibase-style stacks.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-4 md:gap-5">
            {[
              {
                icon: Globe,
                label: 'Vendor Lock-in',
                problem: 'Your app runs on Firebase, Vercel, or Supabase — you don\'t control any of it',
                solution: 'Self-host the full stack with your own infra and upgrade path',
              },
              {
                icon: Lock,
                label: 'Data Sovereignty',
                problem: 'Customer data lives on third-party servers across unknown jurisdictions',
                solution: 'Self-hosted — your data never leaves your network',
              },
              {
                icon: Zap,
                label: 'Scaling Tax',
                problem: 'Cloud bills spike unpredictably when your app gains traction',
                solution: 'Self-hosted on your own compute — no per-request billing, predictable costs',
              },
              {
                icon: Code2,
                label: 'Code Without Infrastructure',
                problem: 'AI generates a frontend but you still need to wire up hosting, APIs, databases',
                solution: 'DCCortex handles UI, backend flows, APIs, and deployment in one platform',
              },
            ].map(({ icon: Icon, label, problem, solution }, i) => (
              <Reveal key={label} delay={i * 70}>
                <div className="border border-border bg-background p-6 md:p-7 h-full">
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
                      <p className="text-sm md:text-base font-semibold text-foreground leading-snug">{problem}</p>
                    </div>
                    <div className="w-10 h-10 border border-border flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-foreground" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border flex items-start gap-3">
                    <span className="inline-flex h-5 min-w-5 items-center justify-center border border-border text-[11px] font-bold leading-none px-1">+</span>
                    <p className="text-sm md:text-base font-medium text-foreground leading-snug">{solution}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">How It Works</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                From prompt to production in three steps
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Design with AI, build visually, and deploy full-stack apps you control.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Design with AI',
                desc: 'Describe what you want in plain English. Cortex AI generates multi-screen applications with data models, API integrations, and production-ready layouts.',
                icon: Sparkles,
              },
              {
                step: '2',
                title: 'Build Visually',
                desc: 'Refine in the WYSIWYG builder. Drag components, bind data, add automations. Everything is production-ready — not a prototype.',
                icon: LayoutGrid,
              },
              {
                step: '3',
                title: 'Deploy Full Stack',
                desc: 'One click provisions your frontend, backend, and database. Run it self-hosted with full ownership of runtime and data.',
                icon: Container,
              },
            ].map(({ step, title, desc, icon: Icon }, i) => (
              <Reveal key={step} delay={i * 120}>
                <div className="relative p-8 bg-card border border-border h-full hover:border-primary/30 transition-colors">
                  <div className="text-5xl font-black text-primary/20 absolute top-4 right-6">{step}</div>
                  <div className="w-10 h-10 bg-foreground flex items-center justify-center mb-5 hover:bg-primary transition-colors">
                    <Icon className="w-5 h-5 text-background" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 md:py-32 bg-muted/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Platform Features</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Everything you need to replace fragmented no-code stacks
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                From AI-powered design to backend workflows and deployment — one full-stack system for the complete lifecycle.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Sparkles,
                title: 'AI Application Generator',
                desc: 'Describe your app in natural language. Cortex AI generates screens, data models, backend flows, and API integrations — constrained to production-safe patterns.',
              },
              {
                icon: MousePointerClick,
                title: 'WYSIWYG Visual Builder',
                desc: 'Drag-and-drop editor with 40+ components. Tables, charts, forms, modals — all production-grade with live data bindings.',
              },
              {
                icon: Container,
                title: 'Self-Hosted Runtime',
                desc: 'Run frontend, backend, and database on your own servers. Community edition is open source; commercial licensing adds enterprise support.',
              },
              {
                icon: Scale,
                title: 'Docker Deployment',
                desc: 'Self-host with Docker. One consistent platform model from local dev to production. No cloud vendor required.',
              },
              {
                icon: Database,
                title: 'Managed Data Layer',
                desc: 'PostgreSQL per project with backups, table tooling, and API-first access. Connect external services without leaving the platform.',
              },
              {
                icon: Shield,
                title: 'Enterprise Controls',
                desc: 'OIDC SSO, RBAC, immutable audit logs, backup and restore drills. Security posture you can verify today.',
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="group p-6 border border-border bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 h-full">
                  <div className="w-10 h-10 bg-foreground flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                    <Icon className="w-5 h-5 text-background" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLATFORM OWNERSHIP ── */}
      <section id="infrastructure" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <div>
                <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Hosting and Ownership</p>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  Full-stack platform, not just hosting
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  DCCortex is a practical replacement for fragmented builders like Budibase setups plus extra glue code.
                  You get app design, backend flows, API generation, and deployment in one system that you can self-host.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    'UI + backend flows + data model in one builder',
                    'REST APIs and workflows generated from your model',
                    'Self-host on Docker — your servers, your data',
                    'Open-source community edition for MVP teams',
                    'Commercial licensing with enterprise controls and support',
                    'Own your data, code, runtime, and upgrade path',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-all hover:-translate-y-px"
                >
                  Deploy your first app
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </Reveal>
            <Reveal delay={200}>
              <ArchitectureIllustration />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── WHAT YOU CAN BUILD ── */}
      <section className="py-24 md:py-32 bg-muted/50">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Use Cases</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Build anything. Own everything.
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Full-stack applications built visually and owned end-to-end.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Internal Tools & Dashboards',
                desc: 'KPI dashboards, expense reports, approval workflows — deployed to your own network, not a third-party cloud.',
              },
              {
                title: 'Customer-Facing Apps',
                desc: 'Portals, booking systems, client dashboards — all data stays in your self-hosted PostgreSQL, under your control.',
              },
              {
                title: 'AI-Generated Prototypes',
                desc: 'Describe an app to Cortex AI, get production-ready screens. Self-host it on your own infrastructure.',
              },
              {
                title: 'API-First Backends',
                desc: 'Auto-generated REST APIs with full CRUD. Connect any frontend — React, mobile, or the built-in WYSIWYG.',
              },
              {
                title: 'Data Collection & Forms',
                desc: 'Multi-step forms, validation, file uploads — data flows into your own PostgreSQL. No third-party form services.',
              },
              {
                title: 'Operational Systems',
                desc: 'Inventory, dispatch, fleet management — connected to your ERPs via built-in API integrations and automations.',
              },
            ].map(({ title, desc }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="group relative overflow-hidden bg-card border border-border hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 h-full">
                  <div className="h-2 bg-foreground" />
                  <div className="p-6">
                    <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-primary font-medium">
                      <Server className="w-3.5 h-3.5" />
                      Self-hosted on your infrastructure
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 md:py-32 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Pricing</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Self-hosted. Predictable costs.
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Free community version for builders. Paid plans for teams that need scale, support, and enterprise controls.
                You run the compute — we provide the full-stack platform and licensing.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Community (Free)',
                desc: 'Free forever. Full platform, no time limits. Self-host on your own Docker setup.',
                items: ['Full builder + AI + runtime', 'Up to 3 projects', 'Community support via GitHub'],
              },
              {
                title: 'Team',
                desc: 'For growing teams that need more projects, scaling, and operational tooling.',
                items: ['Unlimited projects', 'Scale on your own infrastructure', 'Priority support + SLA'],
              },
              {
                title: 'Enterprise',
                desc: 'Governance-heavy teams running production workloads at scale.',
                items: ['OIDC SSO + RBAC', 'Audit logs + compliance controls', 'Dedicated support + advisory'],
              },
            ].map(({ title, desc, items }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="p-6 bg-card border border-border h-full">
                  <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{desc}</p>
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <div className="mt-8 border border-border bg-card p-5 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Your compute, our platform:</span> DCCortex runs on your servers.
              You pay for your own cloud/hardware — our pricing covers the platform license, support, and enterprise features.
              No per-request billing. No surprise bills.
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── COMPLIANCE & TRUST ── */}
      <section id="compliance" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Compliance and Trust</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Controls you can run now, with a clear certification path
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                DCCortex does not claim formal certification yet. It is positioned as SOC2-ready and FedRAMP-ready path
                with controls, documentation, and evidence automation designed to support staged certification after launch.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: FileCheck2,
                title: 'SOC2-Adjacent / SOC2-Ready Positioning',
                desc: 'Self-attested controls aligned to SOC2 trust service criteria for practical enterprise trust messaging.',
              },
              {
                icon: Landmark,
                title: 'FedRAMP-Ready Path',
                desc: 'Documentation and operational artifacts are structured to support future ATO-focused implementation programs.',
              },
              {
                icon: Shield,
                title: 'Enterprise Security Controls',
                desc: 'OIDC SSO, RBAC, immutable audit logging, backup and restore workflows, and incident response runbooks.',
              },
              {
                icon: Lock,
                title: 'NIST-Aligned Coverage',
                desc: 'Controls are mapped to NIST-style domains in the compliance matrix for repeatable governance and audits.',
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="p-6 bg-card border border-border h-full">
                  <Icon className="w-6 h-6 text-foreground mb-4" />
                  <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── DCFLOW CALLOUT ── */}
      <section className="py-24 md:py-32 bg-muted/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 text-xs font-medium text-foreground bg-muted border border-border">
                    <Sparkles className="w-3 h-3" />
                    DCFlow
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                    AI-first app design
                  </h2>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    DCFlow is the AI design layer of DCCortex. Describe what you want to build in plain English —
                    Cortex AI generates multi-screen applications with data models, automations, and production layouts.
                    Then deploy full stack to your own hosting with one click.
                  </p>
                  <ul className="space-y-3 mb-8">
                    {[
                      'Generate full-stack apps from natural language prompts',
                      'AI output is constrained to production-safe patterns',
                      'Refine visually in the WYSIWYG builder',
                      'Deploy self-hosted — real apps running on infrastructure you own',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="https://flow.dccortex.com"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-all hover:-translate-y-px"
                  >
                    Try DCFlow
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
                <div className="bg-card border border-border shadow-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted border-b border-border">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] text-muted-foreground font-medium">Cortex AI</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="px-3 py-2 bg-muted border border-border text-xs text-muted-foreground">
                      <span className="typing-animation">&ldquo;Build an inventory tracker with dashboard, product list, and order management&rdquo;</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 text-foreground px-1">
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Created project: Inventory Tracker</span>
                      </div>
                      <div className="flex items-center gap-2 text-foreground px-1">
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Created 3 screens + data model</span>
                      </div>
                      <div className="flex items-center gap-2 text-foreground px-1">
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Generated screens, data model, and API endpoints</span>
                      </div>
                    </div>
                    <div className="border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                      Deployed and live at inventory.yourcompany.com
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CHAOS CLOUD TWIST ── */}
      <section className="py-24 md:py-36 bg-background overflow-hidden relative">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <Reveal>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">The old way</p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground mb-4 leading-tight">
              You don&apos;t have to care<br className="hidden sm:block" /> about any of this.
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-16">
              Every external service, bill, outage, and migration that used to be your problem &mdash; isn&apos;t anymore.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div className="relative mb-16 select-none">
              <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />

              <div className="overflow-hidden">
                <div
                  className="flex gap-3 w-max"
                  style={{ animation: 'dcc-marquee 28s linear infinite' }}
                >
                  {[
                    'AWS EC2','Firebase','Vercel','Supabase','Auth0','Stripe Billing',
                    'Cloudflare','SendGrid','Twilio','MongoDB Atlas','Redis Cloud',
                    'Datadog','PagerDuty','Heroku','Netlify','Render','Railway',
                    'Planetscale','Neon DB','Upstash','Sentry','LaunchDarkly',
                    'Segment','Mixpanel','Algolia','Elastic Cloud','Kong',
                    'AWS EC2','Firebase','Vercel','Supabase','Auth0','Stripe Billing',
                    'Cloudflare','SendGrid','Twilio','MongoDB Atlas','Redis Cloud',
                    'Datadog','PagerDuty','Heroku','Netlify','Render','Railway',
                  ].map((label, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 text-xs font-medium border border-border text-muted-foreground bg-muted/50 whitespace-nowrap line-through decoration-red-400/60"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden mt-3">
                <div
                  className="flex gap-3 w-max"
                  style={{ animation: 'dcc-marquee-reverse 34s linear infinite' }}
                >
                  {[
                    'CloudFront CDN','S3 Buckets','IAM Roles','VPC Config','SSL Certs',
                    'DNS Routing','Load Balancers','Auto-scaling Groups','RDS Snapshots',
                    'ECS Task Defs','ECR Registry','Lambda Cold Starts','SQS Queues',
                    'WAF Rules','NAT Gateway','Bastion Hosts','K8s YAML','Helm Charts',
                    'CloudFront CDN','S3 Buckets','IAM Roles','VPC Config','SSL Certs',
                    'DNS Routing','Load Balancers','Auto-scaling Groups','RDS Snapshots',
                    'ECS Task Defs','ECR Registry','Lambda Cold Starts','SQS Queues',
                  ].map((label, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 text-xs font-medium border border-border text-muted-foreground/60 bg-muted/30 whitespace-nowrap line-through decoration-red-400/40"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="relative">
              <div className="absolute -inset-px bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 opacity-30 blur-md" />
              <div className="relative border border-border bg-card px-8 py-8 max-w-2xl mx-auto">
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">The DCCortex way</p>
                <h3 className="text-2xl md:text-3xl font-extrabold text-foreground mb-3 leading-tight">
                  One platform.<br />Every layer. Fully yours.
                </h3>
                <p className="text-muted-foreground text-base leading-relaxed mb-6">
                  Frontend, backend, database, and auth — all running on infrastructure you control. No fragmented services. No external cost surprises. No vendor that can pull the rug.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    'Your frontend','Your API','Your database','Your scaling',
                    'Your auth','Your network','Your cost','Your rules',
                  ].map((label) => (
                    <span key={label} className="px-3 py-1 text-xs font-medium border border-primary/30 text-primary bg-primary/5">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        <style>{`
          @keyframes dcc-marquee {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes dcc-marquee-reverse {
            0%   { transform: translateX(-50%); }
            100% { transform: translateX(0); }
          }
        `}</style>
      </section>

      {/* ── SCALE ── */}
      <section className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Scale</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                From side project to production fleet
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Open-source, self-hostable, and built to grow with you.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Server,
                title: 'Self-Host Anywhere',
                desc: 'Docker on your own servers, cloud, or on-prem hardware. No third-party runtime required.',
              },
              {
                icon: Database,
                title: 'Your Data, Your DB',
                desc: 'PostgreSQL runs on your infrastructure. No external database services or surprise data costs.',
              },
              {
                icon: Code2,
                title: 'Open Source',
                desc: 'Community edition is open source. Fork, extend, and self-host without vendor lock-in.',
              },
              {
                icon: Plug,
                title: 'API-First',
                desc: 'Auto-generated REST APIs, webhooks, and extensibility for every project.',
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-muted flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-foreground" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 md:py-32 bg-background text-foreground border-t border-border">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Reveal>
            <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
              Own your full stack.<br />
              Ship without dependencies.
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              Design with AI, build visually, and self-host on infrastructure you control.
              No third-party runtime. No surprise bills. No vendor lock-in.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={ctaHref}
                className="group px-8 py-3.5 text-base font-semibold bg-foreground text-background hover:opacity-90 transition-all hover:-translate-y-px flex items-center gap-2"
              >
                {ctaLabel}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="https://github.com/dotcorr/dccortex"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 text-base font-semibold border border-border text-foreground/80 hover:border-foreground hover:text-foreground transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.27.098-2.647 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.377.202 2.394.1 2.647.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                Star on GitHub
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-16 bg-black text-muted-foreground">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Logo size="w-6 h-6" className="!bg-card" />
                <span className="text-base font-bold text-white">DCCortex</span>
              </div>
              <p className="text-sm leading-relaxed">
                The self-hosted full-stack app platform. Design with AI, build visually, run backend flows, and deploy to infrastructure you own.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#infrastructure" className="hover:text-white transition-colors">Infrastructure</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#compliance" className="hover:text-white transition-colors">Compliance</a></li>
                <li><a href="https://flow.dccortex.com" className="hover:text-white transition-colors">DCFlow</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://github.com/dotcorr/dccortex" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a></li>
                <li><a href="https://github.com/DotCorr/dccortex/tree/feature/oidc-sso-slice/docs/enterprise" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="https://github.com/dotcorr/dccortex" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Community Edition</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://dotcorr.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Dotcorr</a></li>
                <li><a href="mailto:hello@dotcorr.com" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs">&copy; {new Date().getFullYear()} Dotcorr. All rights reserved.</p>
            <div className="flex items-center gap-6 text-xs">
              <a href="https://github.com/dotcorr/dccortex" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
              <a href="https://twitter.com/dotcorr" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Twitter</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
