/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { detectDesktopShell } from '@/components/tauri-detector'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { ProductSwitcher } from '@/components/product-switcher'
import {
  Layers, Zap, Globe, Shield, Code2, ArrowRight, ChevronRight,
  Building2, Landmark, Factory, Stethoscope, Truck, GraduationCap,
  MousePointerClick, Sparkles, Database, Workflow, Check, Menu, X,
  LayoutGrid, Table2, BarChart3, FormInput, PanelLeftClose, Eye,
  GitBranch, Lock, Server, Plug, RefreshCw, Clock, FileCheck2,
  Container, Cpu, HardDrive, Activity, Box, Network, Terminal,
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
    'Describe your app → AI builds it',
    'Drag and drop to customize anything',
    'One click to go live',
    'You own everything — data, code, servers',
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

/* ───────────── Hero illustration — runtime architecture ───────────── */
function HeroIllustration() {
  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <div className="absolute -inset-8 bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-500/10 blur-3xl" />
      <div className="relative bg-card border border-border shadow-2xl shadow-black/5 dark:shadow-black/30 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <span className="text-[11px] text-muted-foreground font-medium ml-1">DCCortex — Runtime Dashboard</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-emerald-500" /> All Systems Healthy</span>
            <span className="px-2 py-0.5 bg-foreground text-background text-[10px] font-medium">Deploy</span>
          </div>
        </div>

        <div className="flex h-[360px]">
          {/* Left — Projects */}
          <div className="w-48 border-r border-border bg-muted/50 p-3 space-y-2 flex-shrink-0 hidden sm:block">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Projects</div>
            {[
              { name: 'Inventory App', status: 'running', color: 'bg-emerald-500' },
              { name: 'Customer Portal', status: 'running', color: 'bg-emerald-500' },
              { name: 'Analytics Dash', status: 'scaling', color: 'bg-amber-500' },
              { name: 'HR System', status: 'deploying', color: 'bg-blue-500' },
            ].map(({ name, status, color }) => (
              <div
                key={name}
                className="flex items-center gap-2 px-2 py-2 text-[11px] text-muted-foreground hover:bg-card hover:shadow-sm transition-all border border-transparent hover:border-border"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${color} flex-shrink-0`} />
                <span className="flex-1 truncate">{name}</span>
                <span className="text-[9px] text-muted-foreground/60">{status}</span>
              </div>
            ))}
            <div className="pt-3 border-t border-border mt-3">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Containers</div>
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className={`h-5 border ${i < 7 ? 'bg-emerald-500/10 border-emerald-500/30' : i < 8 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-blue-500/10 border-blue-500/30'} flex items-center justify-center`}>
                    <Box className="w-2.5 h-2.5 text-muted-foreground/40" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center — Architecture View */}
          <div className="flex-1 p-4 space-y-3 bg-background overflow-hidden relative">
            <div className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-1">Project: Inventory App</div>
            {/* Container stack */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Frontend', icon: Globe, status: 'Running', mem: '128MB', cpu: '0.2' },
                { label: 'Backend API', icon: Server, status: 'Running', mem: '256MB', cpu: '0.5' },
                { label: 'Database', icon: Database, status: 'Healthy', mem: '512MB', cpu: '0.3' },
              ].map(({ label, icon: Icon, status, mem, cpu }) => (
                <div key={label} className="border border-border bg-card p-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-foreground">{label}</span>
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400">{status}</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground space-y-0.5">
                    <div className="flex justify-between"><span>Memory</span><span>{mem}</span></div>
                    <div className="flex justify-between"><span>CPU</span><span>{cpu} core</span></div>
                  </div>
                </div>
              ))}
            </div>
            {/* Metrics */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Requests/s', value: '2.4k', trend: '+12%' },
                { label: 'Latency', value: '23ms', trend: 'p99' },
                { label: 'Uptime', value: '99.97%', trend: '30d' },
                { label: 'Containers', value: '3/3', trend: 'healthy' },
              ].map(({ label, value, trend }) => (
                <div key={label} className="border border-border bg-card p-2">
                  <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
                  <div className="text-sm font-bold text-foreground">{value}</div>
                  <div className="text-[8px] text-emerald-600 dark:text-emerald-400">{trend}</div>
                </div>
              ))}
            </div>
            {/* Traffic chart */}
            <div className="h-16 border border-border bg-muted flex items-end gap-[3px] px-2 pb-1.5">
              {[35, 40, 55, 42, 78, 62, 88, 75, 92, 65, 72, 90, 48, 85, 95].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-primary to-primary/60"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span>Traffic — Last 24 hours</span>
              <span className="text-emerald-600 dark:text-emerald-400">Auto-scaling: Active</span>
            </div>
          </div>

          {/* Right — Config Panel */}
          <div className="w-48 border-l border-border bg-muted/30 p-3 space-y-3 flex-shrink-0 hidden lg:block">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Scaling Config</div>
            <div className="space-y-2">
              <div>
                <div className="text-[9px] text-muted-foreground mb-0.5">Min Replicas</div>
                <div className="px-2 py-1 bg-card border border-border text-[10px] text-foreground font-medium">1</div>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground mb-0.5">Max Replicas</div>
                <div className="px-2 py-1 bg-card border border-border text-[10px] text-foreground font-medium">8</div>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground mb-0.5">CPU Threshold</div>
                <div className="px-2 py-1 bg-card border border-border text-[10px] text-foreground font-medium">70%</div>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground mb-0.5">Network</div>
                <div className="px-2 py-1 bg-card border border-border text-[10px] text-muted-foreground">Isolated VNet</div>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground mb-0.5">Volumes</div>
                <div className="space-y-1">
                  {['app-data', 'db-persist', 'logs'].map(v => (
                    <div key={v} className="px-2 py-0.5 bg-card border border-border text-[10px] text-muted-foreground flex items-center gap-1">
                      <HardDrive className="w-2 h-2 text-muted-foreground/50" />
                      {v}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
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
          <span className="text-[11px] text-muted-foreground font-medium">Container Architecture</span>
        </div>
        <div className="p-5 space-y-3">
          {/* Request */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 px-3 py-2 border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/5">
              <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase">Ingress</div>
              <div className="text-xs text-blue-900 dark:text-blue-200">HTTPS request &rarr; <span className="font-medium">Load Balancer</span></div>
            </div>
          </div>
          <div className="flex justify-center"><div className="w-px h-5 bg-border" /></div>
          {/* Frontend */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <LayoutGrid className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 px-3 py-2 border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5">
              <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Frontend Container</div>
              <div className="text-xs text-emerald-900 dark:text-emerald-200">Serves <span className="font-medium">your app UI</span> — isolated runtime</div>
            </div>
          </div>
          <div className="flex justify-center"><div className="w-px h-5 bg-border" /></div>
          {/* Backend */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Server className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 px-3 py-2 border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5">
              <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase">Backend Container</div>
              <div className="text-xs text-amber-900 dark:text-amber-200">API layer + <span className="font-medium">business logic</span> — airgapped</div>
            </div>
          </div>
          <div className="flex justify-center"><div className="w-px h-5 bg-border" /></div>
          {/* Database */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center flex-shrink-0">
              <Database className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 px-3 py-2 border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/5">
              <div className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 uppercase">Database Container</div>
              <div className="text-xs text-purple-900 dark:text-purple-200">Persistent <span className="font-medium">PostgreSQL</span> — encrypted volumes</div>
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
      <div
        aria-label="Alpha release badge"
        className="fixed top-3 right-3 z-[70] pointer-events-none"
      >
        <div className="bg-foreground text-background text-[10px] sm:text-xs font-extrabold tracking-wider px-3 py-1.5 border border-border shadow-lg uppercase overflow-hidden">
          Alpha
        </div>
      </div>

      {/* ── NAVBAR ── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-background/90 backdrop-blur-md border-b border-border shadow-sm' : 'bg-transparent'
        }`}
        {...(isTauri ? { 'data-tauri-drag-region': true } as any : {})}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <Logo size="w-7 h-7" />
              <span className="text-lg font-bold tracking-tight text-foreground">DCCortex</span>
            </Link>
            <ProductSwitcher current="dccortex" />
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#infrastructure" className="hover:text-foreground transition-colors">Hosting</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {!session && (
              <Link href="/login" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Log in
              </Link>
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
            <a href="#infrastructure" className="block text-sm text-muted-foreground py-1" onClick={() => setMobileMenuOpen(false)}>Hosting</a>
            <div className="py-1"><ProductSwitcher current="dccortex" /></div>
            <div className="flex gap-3 pt-2">
              {!session && <Link href="/login" className="text-sm font-medium text-foreground">Log in</Link>}
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
                Describe what you want. AI builds the screens, database, and API.
                Customize visually. Deploy in one click — to containers you own.
                No vendor lock-in. No surprise bills. No dependencies.
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
                { label: 'Your Own Servers', href: '#infrastructure', icon: Server },
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
                If they raise prices or shut down, you&apos;re stuck. DCCortex is different — you run it on your own servers, always.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-4 md:gap-5">
            {[
              {
                icon: Globe,
                label: 'Vendor Lock-in',
                problem: 'Your app runs on Firebase, Vercel, or Supabase — you don\'t control any of it',
                solution: 'Every project gets its own containers on your infrastructure',
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
                solution: 'K8s auto-scaling on your own compute — predictable costs',
              },
              {
                icon: Code2,
                label: 'Code Without Infrastructure',
                problem: 'AI generates a frontend but you still need to wire up hosting, APIs, databases',
                solution: 'DCCortex provisions the full stack automatically',
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
                Design with AI, build visually, and deploy to your own infrastructure.
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
                title: 'Deploy to Your Runtime',
                desc: 'One click provisions airgapped containers — frontend, backend, and database. Auto-scaling Kubernetes handles the rest. You own everything.',
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
                Everything you need to build and run applications
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                From AI-powered design to container orchestration — one platform for the full lifecycle.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Sparkles,
                title: 'AI Application Generator',
                desc: 'Describe your app in natural language. Cortex AI generates screens, data models, and API integrations — constrained to production-safe patterns.',
              },
              {
                icon: MousePointerClick,
                title: 'WYSIWYG Visual Builder',
                desc: 'Drag-and-drop editor with 40+ components. Tables, charts, forms, modals — all production-grade with live data bindings.',
              },
              {
                icon: Container,
                title: 'Airgapped Container Runtime',
                desc: 'Every project gets isolated Docker containers for frontend, backend, and database. No shared runtimes. No noisy neighbors.',
              },
              {
                icon: Scale,
                title: 'Kubernetes Auto-Scaling',
                desc: 'Built-in K8s orchestration scales your containers based on traffic. Set min/max replicas and CPU thresholds — we handle the rest.',
              },
              {
                icon: Database,
                title: 'Managed Data Layer',
                desc: 'PostgreSQL provisioned per project with encrypted volumes, automated backups, and built-in table editor. Connect external sources too.',
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

      {/* ── CONTAINER ARCHITECTURE ── */}
      <section id="infrastructure" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <div>
                <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Infrastructure</p>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  Every project is a complete stack
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  When you create a project, DCCortex provisions dedicated containers — not a shared multi-tenant database.
                  Frontend, backend API, and PostgreSQL, each in isolated Docker containers with their own network, volumes, and scaling rules.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Airgapped containers — no shared runtime, no noisy neighbors',
                    'Per-project PostgreSQL with encrypted persistent volumes',
                    'Private container networking — only your services can communicate',
                    'Kubernetes orchestration with auto-scaling policies',
                    'One-click deploy — full stack provisioned in seconds',
                    'Self-hosted — runs on your servers, your cloud, your rules',
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
                Full-stack applications running on your own infrastructure.
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
                desc: 'Portals, booking systems, client dashboards — each customer gets isolated containers for data separation.',
              },
              {
                title: 'AI-Generated Prototypes',
                desc: 'Describe an app to Cortex AI, get production-ready screens. Then deploy instantly to real containers.',
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
                      <Container className="w-3.5 h-3.5" />
                      Deployed to isolated containers
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
                You run the compute — we provide the platform.
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
                items: ['Unlimited projects', 'Auto-scaling with K8s', 'Priority support + SLA'],
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
                    Then deploy to your own containers with one click.
                  </p>
                  <ul className="space-y-3 mb-8">
                    {[
                      'Generate full-stack apps from natural language prompts',
                      'AI output is constrained to production-safe patterns',
                      'Refine visually in the WYSIWYG builder',
                      'Deploy straight to airgapped containers — not a prototype tool',
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
                        <span>Provisioned containers (frontend + API + PostgreSQL)</span>
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
                  One runtime.<br />Every layer. Fully yours.
                </h3>
                <p className="text-muted-foreground text-base leading-relaxed mb-6">
                  Frontend, backend, database, networking, scaling, and auth &mdash; provisioned as isolated containers on infrastructure you control. No fragmented services. No external cost surprises. No vendor that can pull the rug.
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
                icon: Container,
                title: 'Container Isolation',
                desc: 'Every project runs in its own airgapped Docker containers. No shared runtimes.',
              },
              {
                icon: Server,
                title: 'Self-Host Anywhere',
                desc: 'Docker or Kubernetes. Your servers, your cloud, your on-prem hardware.',
              },
              {
                icon: Code2,
                title: 'Open Source',
                desc: 'Inspect every line. Fork, extend, contribute. No vendor lock-in.',
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
              Own your runtime.<br />
              Ship without dependencies.
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              Design with AI, build visually, and deploy to containers you control.
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
                The self-hosted application runtime. Design with AI, build visually, deploy to containers you own.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#infrastructure" className="hover:text-white transition-colors">Infrastructure</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
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
