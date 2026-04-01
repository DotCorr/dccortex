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
import {
  Layers, Zap, Globe, Shield, Code2, ArrowRight, ChevronRight,
  Building2, Landmark, Factory, Stethoscope, Truck, GraduationCap,
  MousePointerClick, Sparkles, Database, Workflow, Check, Menu, X,
  LayoutGrid, Table2, BarChart3, FormInput, PanelLeftClose, Eye,
  GitBranch, Lock, Server, Plug, RefreshCw, Clock, FileCheck2
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

/* ───────────── WYSIWYG Explainer ───────────── */
function WysiwygExplainer() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setIndex(i => (i + 1) % 4), 4000)
    return () => clearInterval(interval)
  }, [])

  const items = [
    { title: 'Enterprise-Ready', desc: 'Self-hosted platform with operational controls' },
    { title: 'Compliance-First', desc: 'Audit logs, incident response, and recovery drills' },
    { title: 'Control Aligned', desc: 'NIST 800-53 mapped control coverage' },
    { title: 'Certification Path', desc: 'Built to support SOC2 and FedRAMP readiness workstreams' }
  ]

  return (
    <div className="w-full max-w-3xl mx-auto mb-6 px-4 py-3 text-xs sm:text-sm font-medium text-primary bg-primary/10 border border-primary/20">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <span className="inline-block whitespace-nowrap">WYSIWYG:</span>
        <span className="relative block flex-1 min-h-[40px] sm:min-h-[22px] overflow-hidden">
          {items.map((item, i) => (
            <span
              key={i}
              className="absolute inset-0 transition-all duration-500"
              style={{
                opacity: index === i ? 1 : 0,
                transform: index === i ? 'translateY(0)' : 'translateY(18px)',
              }}
            >
              <span className="text-primary font-semibold">{item.title}</span>
              <span className="text-primary/70 mx-1">—</span>
              <span className="text-primary/80">{item.desc}</span>
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}

/* ───────────── Hero illustration — no-code builder mockup ───────────── */
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
            <span className="text-[11px] text-muted-foreground font-medium ml-1">DCCortex — Screen Builder</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Preview</span>
            <span className="px-2 py-0.5 bg-foreground text-background text-[10px] font-medium">Publish</span>
          </div>
        </div>

        <div className="flex h-[360px]">
          {/* Left — Component Palette */}
          <div className="w-44 border-r border-border bg-muted/50 p-3 space-y-1.5 flex-shrink-0 hidden sm:block">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Components</div>
            {[
              { icon: LayoutGrid, name: 'Container' },
              { icon: Table2, name: 'Data Table' },
              { icon: BarChart3, name: 'Chart' },
              { icon: FormInput, name: 'Form' },
              { icon: MousePointerClick, name: 'Button' },
              { icon: Layers, name: 'Card Repeater' },
              { icon: PanelLeftClose, name: 'Sidebar' },
              { icon: Database, name: 'Data Provider' },
            ].map(({ icon: Icon, name }) => (
              <div
                key={name}
                className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-card hover:shadow-sm cursor-grab transition-all border border-transparent hover:border-border"
              >
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                {name}
              </div>
            ))}
          </div>

          {/* Center — Canvas */}
          <div className="flex-1 p-4 space-y-3 bg-background overflow-hidden relative">
            {/* AI assist bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 text-[11px] text-primary">
              <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="typing-animation">Ask AI: &ldquo;Add a revenue chart and filter by date range&rdquo;</span>
            </div>
            {/* Header bar */}
            <div className="flex items-center justify-between">
              <div className="h-8 px-3 bg-foreground flex items-center">
                <span className="text-[10px] text-background font-medium">Inventory Dashboard</span>
              </div>
              <div className="flex gap-2">
                <div className="h-8 px-3 bg-secondary border border-border flex items-center">
                  <span className="text-[10px] text-muted-foreground">Filter: All</span>
                </div>
                <div className="h-8 px-3 bg-primary flex items-center">
                  <span className="text-[10px] text-background font-medium">+ Add Item</span>
                </div>
              </div>
            </div>
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Total Items', value: '2,847', color: 'bg-card border-l-2 border-l-blue-500' },
                { label: 'Low Stock', value: '23', color: 'bg-card border-l-2 border-l-amber-500' },
                { label: 'Revenue', value: '$184k', color: 'bg-card border-l-2 border-l-emerald-500' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`p-2 border ${color}`}>
                  <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
                  <div className="text-sm font-bold text-foreground">{value}</div>
                </div>
              ))}
            </div>
            {/* Chart */}
            <div className="h-20 border border-border bg-muted flex items-end gap-[3px] px-2 pb-1.5">
              {[35, 60, 42, 78, 52, 88, 65, 82, 55, 72, 90, 48, 68, 85, 58].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-primary to-primary/60"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            {/* Table */}
            <div className="border border-border">
              <div className="grid grid-cols-5 gap-0 text-[9px] font-medium text-muted-foreground bg-muted border-b border-border">
                {['Product', 'SKU', 'Stock', 'Price', 'Status'].map(h => (
                  <div key={h} className="px-2 py-1 border-r border-border last:border-r-0">{h}</div>
                ))}
              </div>
              {[1, 2].map(r => (
                <div key={r} className="grid grid-cols-5 gap-0 text-[9px] text-muted-foreground border-b border-border/50 last:border-b-0">
                  <div className="px-2 py-1 border-r border-border/50"><div className="w-14 h-2 bg-muted-foreground/20" /></div>
                  <div className="px-2 py-1 border-r border-border/50"><div className="w-10 h-2 bg-secondary" /></div>
                  <div className="px-2 py-1 border-r border-border/50"><div className="w-6 h-2 bg-muted-foreground/20" /></div>
                  <div className="px-2 py-1 border-r border-border/50"><div className="w-8 h-2 bg-secondary" /></div>
                  <div className="px-2 py-1"><div className="w-10 h-2 bg-emerald-200" /></div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Property Panel */}
          <div className="w-48 border-l border-border bg-muted/30 p-3 space-y-3 flex-shrink-0 hidden lg:block">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Properties</div>
            <div className="space-y-2">
              <div>
                <div className="text-[9px] text-muted-foreground mb-0.5">Component</div>
                <div className="text-[11px] font-medium text-foreground">Data Table</div>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground mb-0.5">Data Source</div>
                <div className="px-2 py-1 bg-card border border-border text-[10px] text-muted-foreground">inventory_items</div>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground mb-0.5">Columns</div>
                <div className="space-y-1">
                  {['product_name', 'sku', 'stock_count'].map(c => (
                    <div key={c} className="px-2 py-0.5 bg-card border border-border text-[10px] text-muted-foreground flex items-center gap-1">
                      <div className="w-2 h-2 bg-primary/30" />
                      {c}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground mb-0.5">Row Actions</div>
                <div className="px-2 py-1 bg-card border border-border text-[10px] text-muted-foreground">Edit, Delete</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────────── Automation builder illustration ───────────── */
function AutomationIllustration() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="bg-card border border-border shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-muted border-b border-border">
          <Workflow className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground font-medium">Automation Builder</span>
        </div>
        <div className="p-5 space-y-3">
          {/* Trigger */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 px-3 py-2 border border-amber-200 dark:border-amber-500/30 bg-amber-50">
              <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase">Trigger</div>
              <div className="text-xs text-amber-900 dark:text-amber-200">Row created in <span className="font-medium">orders</span></div>
            </div>
          </div>
          <div className="flex justify-center"><div className="w-px h-5 bg-border" /></div>
          {/* Condition */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <GitBranch className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 px-3 py-2 border border-blue-200 dark:border-blue-500/30 bg-blue-50">
              <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase">Condition</div>
              <div className="text-xs text-blue-900 dark:text-blue-200">If <span className="font-medium">order.total</span> &gt; $500</div>
            </div>
          </div>
          <div className="flex justify-center"><div className="w-px h-5 bg-border" /></div>
          {/* Action */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 px-3 py-2 border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50">
              <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Action</div>
              <div className="text-xs text-emerald-900 dark:text-emerald-200">Send Slack notification + update <span className="font-medium">CRM</span></div>
            </div>
          </div>
          <div className="flex justify-center"><div className="w-px h-5 bg-border" /></div>
          {/* Webhook */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center flex-shrink-0">
              <Plug className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 px-3 py-2 border border-purple-200 dark:border-purple-500/30 bg-purple-50">
              <div className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 uppercase">Webhook</div>
              <div className="text-xs text-purple-900 dark:text-purple-200">POST to <span className="font-medium">api.erp.com/orders</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────────── Main page ───────────── */
export default function Home() {
  const { data: session } = useSession()
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

  const ctaHref = session ? '/dashboard' : '/login'
  const ctaLabel = session ? 'Go to Dashboard' : 'Start Enterprise Trial'

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
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="w-7 h-7" />
            <span className="text-lg font-bold tracking-tight text-foreground">DCCortex</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#trust" className="hover:text-foreground transition-colors">Trust</a>
            <a href="#enterprise" className="hover:text-foreground transition-colors">Enterprise</a>
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
            <a href="#features" className="block text-sm text-muted-foreground py-1" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="block text-sm text-muted-foreground py-1" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#pricing" className="block text-sm text-muted-foreground py-1" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href="#trust" className="block text-sm text-muted-foreground py-1" onClick={() => setMobileMenuOpen(false)}>Trust</a>
            <a href="#enterprise" className="block text-sm text-muted-foreground py-1" onClick={() => setMobileMenuOpen(false)}>Enterprise</a>
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
              <WysiwygExplainer />
            </Reveal>
            <Reveal delay={100}>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.08] mb-6">
                Enterprise software<br />
                with trust built in
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-10">
                DCCortex combines visual app delivery with enterprise-grade controls: OIDC SSO, RBAC, immutable audit logs,
                backup and recovery drills, and incident response workflows. Built for self-hosted teams that need speed and governance.
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
                  View trust model
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

      {/* ── TABLE OF CONTENTS / QUICK NAV ── */}
      <section className="py-12 md:py-16 bg-card/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-8">
              <p className="text-xs font-medium text-primary uppercase tracking-widest">Quick Start</p>
            </div>
          </Reveal>
          <Reveal delay={50}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'WYSIWYG Editor', href: '#features', icon: MousePointerClick },
                { label: 'Security and Trust', href: '#trust', icon: Shield },
                { label: 'Self-Hosted Pricing', href: '#pricing', icon: Database },
                { label: 'Enterprise Controls', href: '#enterprise', icon: Lock },
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

      {/* ── TRUST SUMMARY ── */}
      <section className="py-16 md:py-20 border-b border-border">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
              {[
                { stat: 'SOC2-Ready', label: 'Self-attested controls aligned to SOC2 trust criteria' },
                { stat: 'FedRAMP-Ready Path', label: 'Documentation structure prepared for ATO workstreams' },
                { stat: 'NIST Aligned', label: 'Mapped to NIST SP 800-53 style control domains' },
                { stat: 'Enterprise Controls', label: 'OIDC, RBAC, audit logs, backup and incident runbooks' },
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
              Built for teams shipping in regulated and high-control environments
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              {[
                { icon: Building2, label: 'Enterprise' },
                { icon: Landmark, label: 'Government' },
                { icon: Factory, label: 'Manufacturing' },
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

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">The WYSIWYG Advantage</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                See exactly what your users will see
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-8">
                Real-time, true WYSIWYG editing means what you design is what gets deployed.
                No guessing. No surprises. Zero gap between design and production.
              </p>
              <div className="inline-block p-4 bg-muted border border-border max-w-2xl text-left">
                <p className="text-sm text-muted-foreground mb-2">
                  <span className="font-semibold text-foreground">WYSIWYG</span> = "What You See Is What You Get"
                </p>
                <p className="text-xs text-muted-foreground">
                  Unlike traditional web builders that show you mockups or code, DCCortex renders your app in real-time as you build.
                  Buttons respond instantly. Forms validate live. Charts show actual data. You&apos;re not designing in a sandbox — 
                  you&apos;re literally building your production interface drag-by-drag.
                </p>
              </div>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: MousePointerClick,
                title: 'Drag-and-Drop Editor',
                desc: 'Add buttons, forms, tables, charts directly on the canvas. See live data updates as you design. It&apos;s actually WYSIWYG, not a simulation.',
              },
              {
                icon: Sparkles,
                title: 'AI Instant UI Generation',
                desc: 'Describe your screen in plain English. AI generates layouts with data bindings already connected. Refine visually. No code ever needed.',
              },
              {
                icon: Database,
                title: 'Connect Any Data Source',
                desc: 'PostgreSQL, MySQL, REST APIs, Google Sheets, MongoDB, Airtable — pull, filter, sort, and display live data instantly without SQL.',
              },
              {
                icon: Layers,
                title: '40+ Ready-to-Use Components',
                desc: 'Tables with sorting and pagination. Charts with real-time updates. Forms with validation. Date pickers. Modals. Everything production-grade.',
              },
              {
                icon: Workflow,
                title: 'Visual Automation Builder',
                desc: 'Map workflows visually. Set triggers (row created, webhook fired). Add conditions. Chain actions. Slack, email, API calls — all no-code.',
              },
              {
                icon: Zap,
                title: 'Deploy in One Click',
                desc: 'Publish live immediately. No pipelines. No containers. No deployment scripts. Your app is live and accessible to users right now.',
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

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 md:py-32 bg-muted/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Pricing</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Self-hosted option includes enterprise security controls
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Launch with a single platform plan, then scale by deployment size and support tier. Security and compliance foundations are included,
                with formal certification workstreams completed as your program matures.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Starter Self-Host',
                desc: 'Core builder, API access, and deployment tooling for internal platform teams.',
                items: ['Self-hosted deployment', 'Core role model', 'Operational runbooks'],
              },
              {
                title: 'Enterprise',
                desc: 'Recommended plan for governance-heavy teams running production workloads.',
                items: ['OIDC SSO + RBAC', 'Immutable audit logs', 'Backup and restore drill automation'],
              },
              {
                title: 'Enterprise Plus',
                desc: 'Support-led path for organizations preparing third-party certification programs.',
                items: ['Incident response evidence workflow', 'Compliance matrix and policy set', 'Certification readiness advisory'],
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
        </div>
      </section>

      {/* ── TRUST PAGE SECTION ── */}
      <section id="trust" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Security and Trust</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Claims you can make today, with a clear path to certification
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                DCCortex is not claiming formal certification yet. It is positioned as SOC2-ready and FedRAMP-ready path with controls,
                documentation, and evidence automation designed to support staged certification after launch.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: FileCheck2,
                title: 'SOC2-Adjacent / SOC2-Ready Positioning',
                desc: 'Self-attested controls aligned to SOC2 trust service criteria, appropriate for early-stage enterprise SaaS trust messaging.',
              },
              {
                icon: Landmark,
                title: 'FedRAMP-Ready Path',
                desc: 'Documentation and operational artifacts are structured to support future ATO-focused implementation programs.',
              },
              {
                icon: Shield,
                title: 'Enterprise-Grade Security Controls',
                desc: 'OIDC SSO, RBAC, immutable audit logging, backup and restore workflows, incident response runbooks, and evidence pack automation.',
              },
              {
                icon: Lock,
                title: 'NIST-Aligned Coverage',
                desc: 'Controls are mapped to NIST SP 800-53 style domains in the enterprise compliance matrix for repeatable governance.',
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

      {/* ── WHAT YOU CAN BUILD ── */}
      <section className="py-24 md:py-32 bg-muted/50">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Real Applications</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Build what business actually needs
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                From day-one productivity to enterprise scale. Teams ship production apps in hours instead of quarters.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Internal Tools & Dashboards',
                desc: 'Staff management, expense reports, KPI dashboards, approval workflows — everything your business runs on.',
              },
              {
                title: 'Customer Portals',
                desc: 'Branded, secure self-service portals for clients, suppliers, partners. Full RBAC, audit logs, and data isolation.',
              },
              {
                title: 'Admin Panels',
                desc: 'User management, content moderation, system settings — ship admin features faster than building them in code once.',
              },
              {
                title: 'Forms & Data Collection',
                desc: 'Multi-step forms, conditional logic, validation, file uploads. Data flows secure into your own database.',
              },
              {
                title: 'Operational Apps',
                desc: 'Inventory tracking, warehouse management, field service dispatch — connected to your ERPs and systems in minutes.',
              },
              {
                title: 'Automations & Workflows',
                desc: 'Trigger actions on data change. Connect to Slack, Zapier, APIs. Replace your legacy integration layer.',
              },
            ].map(({ title, desc }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="group relative overflow-hidden bg-card border border-border hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 h-full">
                  <div className="h-2 bg-foreground" />
                  <div className="p-6">
                    <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-primary font-medium">
                      <ChevronRight className="w-3.5 h-3.5" />
                      Enterprise deployment supported
                    </div>
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
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">The Process</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Three steps to production
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Build, govern, and deploy with repeatable controls from day one.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Connect Your Data',
                desc: 'Point to PostgreSQL, MySQL, REST APIs, Google Sheets, or any data source. Create controlled data access with role enforcement.',
                icon: Database,
              },
              {
                step: '2',
                title: 'Design In WYSIWYG',
                desc: 'Drag components onto screens and bind data visually. Build production interfaces with deterministic behavior and auditability.',
                icon: LayoutGrid,
              },
              {
                step: '3',
                title: 'Publish & Scale',
                desc: 'Publish to self-hosted environments with versioned release evidence, backup validation, and operational sign-off paths.',
                icon: Zap,
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

      {/* ── DATA SOURCE CONNECTORS ── */}
      <section className="py-16 border-t border-b border-border">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-10">
              <h3 className="text-lg font-bold text-foreground mb-2">Connect any data source, or start from scratch</h3>
              <p className="text-sm text-muted-foreground">Plug in your existing database, API, or spreadsheet &mdash; or build on DCCortex&apos;s built-in tables.</p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {['PostgreSQL', 'MySQL', 'REST API', 'Google Sheets', 'MongoDB', 'MSSQL', 'Airtable', 'Built-in DB'].map(name => (
                <div key={name} className="flex items-center gap-2 px-4 py-2 bg-muted border border-border text-sm text-muted-foreground font-medium">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  {name}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── AUTOMATION SECTION ── */}
      <section className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <Reveal>
              <div>
                <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Automations</p>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                  Make work flow with automations
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Automate manual processes and streamline operations with a visual workflow builder.
                  Set triggers, define conditions, chain actions &mdash; no code, no complexity.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Row-level triggers — react when data changes',
                    'Webhook triggers — connect external events',
                    'Conditional logic — branch on any field value',
                    'Multi-step actions — Slack, email, API calls, DB updates',
                    'Scheduled automations — cron jobs without DevOps',
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
                  Start building
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </Reveal>
            <Reveal delay={200}>
              <AutomationIllustration />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── INDUSTRY SOLUTIONS ── */}
      <section id="solutions" className="py-24 md:py-32 bg-muted/50">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Solutions</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                From startups to governments
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Companies, governments, and industries build their entire UI infrastructure on DCCortex &mdash; no developers required.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Building2,
                title: 'Enterprise',
                desc: 'Admin panels, reporting dashboards, employee portals, and approval workflows — built in hours, not quarters.',
              },
              {
                icon: Landmark,
                title: 'Government',
                desc: 'Citizen-facing portals, permit systems, case management — with full RBAC, audit logging, and compliance controls.',
              },
              {
                icon: Factory,
                title: 'Manufacturing',
                desc: 'Quality control, equipment monitoring, inventory management — connected to your ERP and floor systems.',
              },
              {
                icon: Stethoscope,
                title: 'Healthcare',
                desc: 'Patient intake forms, scheduling, department dashboards — built to spec with role-based access and secure data.',
              },
              {
                icon: Truck,
                title: 'Logistics',
                desc: 'Fleet management, route planning, warehouse dashboards — real-time data from your APIs and databases.',
              },
              {
                icon: GraduationCap,
                title: 'Education',
                desc: 'Student portals, grading systems, admin tools — fully customizable and deployed without engineering resources.',
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className="p-6 bg-card border border-border hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 h-full">
                  <Icon className="w-6 h-6 text-primary mb-4" />
                  <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCALE WITH CONFIDENCE ── */}
      <section id="enterprise" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">Infrastructure</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Scale with confidence
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Open-source, self-hostable, and governance-ready from day one.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Lock,
                title: 'Enterprise Security',
                desc: 'RBAC, SSO, SAML, audit logs, and fine-grained permissions at screen and component level.',
              },
              {
                icon: Server,
                title: 'Self-Host Anywhere',
                desc: 'Docker, Kubernetes, or let DCCortex cloud manage everything. Your infrastructure, your rules.',
              },
              {
                icon: Code2,
                title: 'Open Source',
                desc: 'Inspect every line. Fork, extend, contribute. Full transparency and no vendor lock-in.',
              },
              {
                icon: Plug,
                title: 'API-First',
                desc: 'Public API, webhooks, and extensibility. Use DCCortex as a backend or embed apps anywhere.',
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

      {/* ── AI ASSIST CALLOUT ── */}
      <section className="py-24 md:py-32 bg-muted/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Reveal>
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 text-xs font-medium text-foreground bg-muted border border-border">
                    <Sparkles className="w-3 h-3" />
                    AI Assist
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                    Build with a prompt. Or don&apos;t.
                  </h2>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    DCCortex&apos;s AI assist lets you describe screens, layouts, and data bindings in plain English &mdash;
                    and it generates them inside the no-code editor. Use it when you want a head start.
                    Skip it when you&apos;d rather drag and drop. It&apos;s your choice.
                  </p>
                  <ul className="space-y-3">
                    {[
                      'Generate full screens from a text description',
                      'AI creates components already bound to your data',
                      'Refine everything visually — AI is the starting point, not the limit',
                      'Works inside the no-code editor — not a separate tool',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-card border border-border shadow-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted border-b border-border">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] text-muted-foreground font-medium">AI Assist</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="px-3 py-2 bg-muted border border-border text-xs text-muted-foreground">
                      <span className="typing-animation">&ldquo;Create a user management table with edit and delete actions&rdquo;</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-foreground px-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Generated: Data Table + Form Modal + 3 actions</span>
                    </div>
                    <div className="border border-border overflow-hidden">
                      <div className="grid grid-cols-4 text-[9px] font-medium text-muted-foreground bg-muted border-b border-border">
                        {['Name', 'Email', 'Role', 'Actions'].map(h => (
                          <div key={h} className="px-2 py-1.5 border-r border-border last:border-r-0">{h}</div>
                        ))}
                      </div>
                      {[1, 2, 3].map(r => (
                        <div key={r} className="grid grid-cols-4 text-[9px] text-muted-foreground border-b border-border/50 last:border-b-0">
                          <div className="px-2 py-1.5"><div className="w-12 h-2 bg-muted-foreground/20" /></div>
                          <div className="px-2 py-1.5"><div className="w-16 h-2 bg-secondary" /></div>
                          <div className="px-2 py-1.5"><div className="w-8 h-2 bg-muted" /></div>
                          <div className="px-2 py-1.5 flex gap-1">
                            <div className="w-6 h-2 bg-muted" />
                            <div className="w-6 h-2 bg-muted" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── THE PROBLEM WE SOLVE ── */}
      <section className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">The Reality Today</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                You can't keep up with your own business
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                The gap between what business needs and what developers can deliver keeps growing.
                DCCortex closes that gap.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-8 mb-12">
            {[
              {
                icon: Clock,
                label: 'The Wait',
                problem: '6-month backlog for internal tools',
                solution: 'Build them yourself in hours',
              },
              {
                icon: Code2,
                label: 'Developer Shortage',
                problem: 'Hiring frontend developers keeps getting harder',
                solution: 'Empower business teams with WYSIWYG',
              },
              {
                icon: Server,
                label: 'Infrastructure Overhead',
                problem: 'DevOps, CI/CD, containerization, deployment',
                solution: 'Publish instantly, we handle scale',
              },
              {
                icon: Lock,
                label: 'Data Silos',
                problem: 'Building with wrong data sources takes weeks',
                solution: 'Connect any data source in minutes',
              },
            ].map(({ icon: Icon, label, problem, solution }, i) => (
              <Reveal key={label} delay={i * 80}>
                <div className="p-6 border border-border bg-card">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{label}</h3>
                      <p className="text-xs text-foreground font-medium">{problem}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-foreground mt-0.5">+</div>
                    <p className="text-sm text-foreground font-medium">{solution}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 md:py-32 bg-foreground text-background">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Reveal>
            <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
              Launch with controls customers can trust.<br />
              Build now, certify in stages.
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              Start with a strong control baseline and transparent documentation today.
              Use funded growth phases to complete third-party certification programs without rebuilding your platform.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={ctaHref}
                className="group px-8 py-3.5 text-base font-semibold bg-background text-foreground hover:opacity-90 transition-all hover:-translate-y-px flex items-center gap-2"
              >
                {ctaLabel}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="https://github.com/dotcorr/dccortex"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 text-base font-semibold border border-background/20 text-background/70 hover:border-background/40 hover:text-background transition-colors flex items-center gap-2"
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
                The open-source no-code platform for building internal tools, portals, and automations.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#trust" className="hover:text-white transition-colors">Trust</a></li>
                <li><a href="#enterprise" className="hover:text-white transition-colors">Enterprise</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://github.com/dotcorr/dccortex" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a></li>
                <li><a href="https://github.com/DotCorr/dccortex/tree/feature/oidc-sso-slice/docs/enterprise" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Enterprise Documentation</a></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Community</Link></li>
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
