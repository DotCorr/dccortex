/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import {
  ArrowRight, ChevronLeft, ChevronRight, ChevronDown, Check, Menu, X,
  Sparkles, Image, Share2, Wand2, Figma, Quote,
  LayoutDashboard, Zap, Globe, HardDrive, Shield, Users, CreditCard, Settings,
  Search, SlidersHorizontal, Paperclip, ArrowUp,
  Heart, MessageSquare, TrendingUp, Bell, ClipboardList, UtensilsCrossed
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

/* ───────────── Light-theme showcase panels (Banani-style) ───────────── */

const PANEL_SHADOW = 'shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)]'
const PANEL_BASE = `bg-white rounded-2xl ${PANEL_SHADOW} border border-gray-100 overflow-hidden`

/* ── SET 0: Calendar + Team + Sidebar + Analytics (SaaS / Productivity) ── */

function CalendarPanel() {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
  const dates = [[1,2,3,4,5,6,7],[8,9,10,11,12,13,14],[15,16,17,18,19,20,21],[22,23,24,25,26,27,28],[29,30,31,0,0,0,0]]
  return (
    <div className={PANEL_BASE} style={{ width: 300, minHeight: 420 }}>
      <div className="relative h-14 bg-gradient-to-r from-sky-50 to-indigo-50">
        <div className="absolute top-2 left-3 right-3 flex items-center justify-between">
          <div className="text-[11px] font-semibold text-gray-800">Sep 2025</div>
          <div className="flex gap-1.5">
            <div className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-gray-400"><ChevronLeft className="w-3 h-3" /></div>
            <div className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-gray-400"><ChevronRight className="w-3 h-3" /></div>
          </div>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {days.map(d => <div key={d} className="text-center text-[8px] font-semibold text-gray-400 py-1">{d}</div>)}
        </div>
        {dates.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5">
            {week.map((d, di) => (
              <div key={di} className={`text-center text-[10px] py-1.5 rounded-lg font-medium ${d===0?'':d===18?'bg-sky-500 text-white':d===15?'bg-emerald-100 text-emerald-700':'text-gray-700'}`}>{d||''}</div>
            ))}
          </div>
        ))}
      </div>
      <div className="px-3 pb-3 mt-1 space-y-1.5">
        <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Wednesday, Sep 18</div>
        {[{time:'09:30',title:'Product Design Sync',sub:'Meeting Room B · Work',color:'bg-sky-400'},{time:'12:00',title:'Lunch with Sarah',sub:'Sushi Place · Personal',color:'bg-emerald-400'},{time:'14:00',title:'Client Presentation',sub:'Zoom Call · Work',color:'bg-violet-400'},{time:'17:00',title:'Gym Session',sub:'City Gym · Health',color:'bg-amber-400'}].map(({time,title,sub,color})=>(
          <div key={title} className="flex items-start gap-2.5 py-1.5">
            <div className="text-[10px] text-gray-400 font-medium w-9 pt-0.5 flex-shrink-0">{time}</div>
            <div className={`w-[3px] h-8 ${color} rounded-full flex-shrink-0 mt-0.5`} />
            <div><div className="text-[10px] font-semibold text-gray-800">{title}</div><div className="text-[9px] text-gray-400">{sub}</div></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamPanel() {
  return (
    <div className={PANEL_BASE} style={{ width: 340, minHeight: 380 }}>
      <div className="flex h-full">
        <div className="w-[72px] bg-gray-50 border-r border-gray-100 py-4 px-2 space-y-0.5 hidden sm:block">
          {[{l:'Account',a:false},{l:'Preferences',a:false},{l:'Plan & Billing',a:false},{l:'Team',a:true},{l:'Security',a:false}].map(({l,a})=>(
            <div key={l} className={`px-2 py-1.5 rounded-md text-[8px] font-medium ${a?'bg-white text-gray-900 shadow-sm':'text-gray-400'}`}>{l}</div>
          ))}
        </div>
        <div className="flex-1 p-4">
          <div className="text-[13px] font-bold text-gray-900 mb-0.5">Team</div>
          <div className="text-[10px] text-gray-400 mb-4">Manage members</div>
          <div className="mb-4">
            <div className="text-[10px] font-semibold text-gray-600 mb-1.5">Invite members</div>
            <div className="flex gap-1.5">
              <div className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-[9px] text-gray-300">Add email address...</div>
              <div className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[9px] font-medium">Send Invites</div>
            </div>
          </div>
          <div className="text-[10px] font-semibold text-gray-600 mb-2">Members</div>
          <div className="space-y-2">
            {[{name:'Alex Smith',email:'alex@acme.com',role:'Owner',av:'bg-sky-500'},{name:'Priya Patel',email:'priya@acme.com',role:'Admin',av:'bg-violet-500'},{name:'Diego Ramirez',email:'diego@acme.com',role:'Editor',av:'bg-emerald-500'},{name:'Hana Kim',email:'hana@acme.com',role:'Viewer',av:'bg-pink-500'}].map(({name,email,role,av})=>(
              <div key={name} className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-full ${av} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>{name.split(' ').map(n=>n[0]).join('')}</div>
                <div className="flex-1 min-w-0"><div className="text-[10px] font-semibold text-gray-800">{name}</div><div className="text-[8px] text-gray-400 truncate">{email}</div></div>
                <div className="text-[9px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{role}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] font-semibold text-gray-600 mt-4 mb-1">Pending invites</div>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0">?</div>
            <div className="text-[9px] text-gray-400">jordan@acme.com</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SidebarPanel() {
  return (
    <div className={PANEL_BASE} style={{ width: 180, minHeight: 340 }}>
      <div className="p-3 space-y-0.5">
        <div className="text-[11px] font-bold text-gray-900 mb-3 px-1">Acme Corp</div>
        <div className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">Workspace</div>
        {[{l:'Overview',a:true,I:LayoutDashboard},{l:'Activity',a:false,I:Zap},{l:'Domains',a:false,I:Globe},{l:'Storage',a:false,I:HardDrive},{l:'Security',a:false,I:Shield}].map(({l,a,I:Icon})=>(
          <div key={l} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-medium ${a?'bg-gray-900 text-white':'text-gray-500'}`}><Icon className="w-3 h-3" />{l}</div>
        ))}
        <div className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider px-1 mt-3 mb-1">Settings</div>
        {[{l:'Team Members',I:Users},{l:'Billing',I:CreditCard},{l:'General',I:Settings}].map(({l,I:Icon})=>(
          <div key={l} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-medium text-gray-500"><Icon className="w-3 h-3" />{l}</div>
        ))}
        <div className="mt-4 px-1">
          <div className="flex items-center justify-between text-[8px] text-gray-400 mb-1"><span>Hobby Plan</span><span>Free</span></div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="w-3/4 h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full" /></div>
          <div className="text-[7px] text-gray-300 mt-1">75GB / 100GB used</div>
        </div>
      </div>
    </div>
  )
}

function AnalyticsPanel() {
  return (
    <div className={PANEL_BASE} style={{ width: 420, minHeight: 380 }}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div><div className="text-[13px] font-bold text-gray-900">Overview</div><div className="text-[9px] text-gray-400">Last 4 weeks</div></div>
        <div className="flex gap-1.5">
          <div className="px-2 py-1 rounded-md bg-gray-100 text-[8px] font-medium text-gray-500">Live</div>
          <div className="px-2 py-1 rounded-md bg-gray-900 text-[8px] font-medium text-white">4 Changes</div>
        </div>
      </div>
      <div className="px-4 pb-3 grid grid-cols-3 gap-3">
        {[{l:'Total Load (24h)',v:'2.4M',c:'+6%',u:true},{l:'Current Charges',v:'$45.20',c:'-$3',u:false},{l:'Success Rate',v:'99.98%',c:'0%',u:true}].map(({l,v,c,u})=>(
          <div key={l}><div className="text-[8px] text-gray-400 mb-0.5">{l}</div><div className="flex items-baseline gap-1.5"><span className="text-[15px] font-bold text-gray-900">{v}</span><span className={`text-[8px] font-semibold ${u?'text-emerald-500':'text-red-400'}`}>{c}</span></div></div>
        ))}
      </div>
      <div className="mx-4 mb-3 h-[72px] bg-gray-50 rounded-xl p-2 flex items-end gap-[3px]">
        {[20,35,28,45,38,55,42,60,48,65,52,70,58,75,62,68,55,72,60,78,65,80,70,85,72,82,68,90].map((h,i)=>(
          <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-sky-500 to-indigo-400" style={{height:`${h}%`}} />
        ))}
      </div>
      <div className="mx-4 mb-3 px-3 py-2 bg-gray-50 rounded-lg text-[9px] text-gray-300 flex items-center gap-2"><Search className="w-3 h-3" /> Filter projects...</div>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        {[{n:'marketing-site',d:'www.acme.com',s:'Ready',t:'2m ago',c:'bg-emerald-500',tech:'Next.js'},{n:'api-gateway',d:'api.acme.com',s:'Building',t:'11s ago',c:'bg-amber-500',tech:'Node.js'},{n:'analytics-engine',d:'data.acme.com',s:'Ready',t:'1d ago',c:'bg-emerald-500',tech:'Python'},{n:'documentation',d:'docs.acme.com',s:'Error',t:'4h ago',c:'bg-red-400',tech:'Vue.js'}].map(({n,d,s,t,c,tech})=>(
          <div key={n} className="p-2.5 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-4 h-4 rounded-full ${c==='bg-emerald-500'?'bg-gradient-to-br from-sky-400 to-indigo-500':c==='bg-amber-500'?'bg-gradient-to-br from-amber-400 to-orange-500':'bg-gradient-to-br from-rose-400 to-red-500'} flex items-center justify-center text-[7px] text-white font-bold`}>{n[0].toUpperCase()}</div>
              <div className="text-[10px] font-bold text-gray-800">{n}</div>
            </div>
            <div className="text-[8px] text-gray-400 mb-1">{d}</div>
            <div className="flex items-center gap-1 mb-1"><div className={`w-1.5 h-1.5 rounded-full ${c}`}/><span className="text-[8px] font-medium text-gray-500">{s} · {t}</span></div>
            <div className="mt-1 text-[8px] text-gray-400">● {tech}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── SET 1: Fitness Tracker ── */

function FitnessPanel() {
  return (
    <div className={PANEL_BASE} style={{ width: 300, minHeight: 420 }}>
      <div className="bg-gradient-to-r from-orange-50 to-rose-50 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-bold text-gray-800">FitTrack</div>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-[10px] text-white font-bold">A</div>
        </div>
        <div className="text-[22px] font-black text-gray-900">8,432</div>
        <div className="text-[9px] text-gray-500">steps today</div>
        <div className="mt-2 w-full h-2 bg-white/60 rounded-full overflow-hidden"><div className="w-[68%] h-full bg-gradient-to-r from-orange-400 to-rose-500 rounded-full" /></div>
        <div className="text-[8px] text-gray-400 mt-1">68% of daily goal</div>
      </div>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {[{v:'342',l:'Calories',c:'text-orange-500'},{v:'4.2km',l:'Distance',c:'text-rose-500'},{v:'52',l:'Minutes',c:'text-violet-500'}].map(({v,l,c})=>(
            <div key={l} className="text-center p-2 bg-gray-50 rounded-xl">
              <div className={`text-[13px] font-bold ${c}`}>{v}</div>
              <div className="text-[8px] text-gray-400">{l}</div>
            </div>
          ))}
        </div>
        <div className="text-[10px] font-semibold text-gray-700 mt-2">This Week</div>
        <div className="h-16 flex items-end gap-1 px-1">
          {[{d:'M',h:45},{d:'T',h:80},{d:'W',h:60},{d:'T',h:90},{d:'F',h:68},{d:'S',h:40},{d:'S',h:20}].map(({d,h},i)=>(
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t bg-gradient-to-t from-orange-400 to-rose-400" style={{height:`${h}%`}} />
              <div className="text-[7px] text-gray-400">{d}</div>
            </div>
          ))}
        </div>
        <div className="text-[10px] font-semibold text-gray-700 mt-2">Recent Workouts</div>
        {[{t:'Morning Run',d:'5.2km · 32 min',c:'bg-orange-400'},{t:'HIIT Session',d:'450 cal · 28 min',c:'bg-rose-400'},{t:'Yoga Flow',d:'Flexibility · 45 min',c:'bg-violet-400'}].map(({t,d,c})=>(
          <div key={t} className="flex items-center gap-2.5 py-1.5">
            <div className={`w-8 h-8 rounded-xl ${c} flex items-center justify-center`}><Zap className="w-3.5 h-3.5 text-white" /></div>
            <div><div className="text-[10px] font-semibold text-gray-800">{t}</div><div className="text-[8px] text-gray-400">{d}</div></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FitnessStatsPanel() {
  return (
    <div className={PANEL_BASE} style={{ width: 420, minHeight: 380 }}>
      <div className="px-4 pt-4 pb-2">
        <div className="text-[13px] font-bold text-gray-900 mb-0.5">Weekly Progress</div>
        <div className="text-[9px] text-gray-400">Your fitness journey at a glance</div>
      </div>
      <div className="px-4 pb-3 grid grid-cols-4 gap-2">
        {[{v:'58,294',l:'Steps',c:'from-orange-400 to-rose-500'},{v:'2,180',l:'Calories',c:'from-rose-400 to-pink-500'},{v:'24.8km',l:'Distance',c:'from-violet-400 to-purple-500'},{v:'6.2h',l:'Active',c:'from-sky-400 to-blue-500'}].map(({v,l,c})=>(
          <div key={l} className="p-2.5 rounded-xl bg-gray-50">
            <div className={`text-[12px] font-bold bg-gradient-to-r ${c} bg-clip-text text-transparent`}>{v}</div>
            <div className="text-[8px] text-gray-400 mt-0.5">{l}</div>
          </div>
        ))}
      </div>
      <div className="mx-4 mb-3 h-[80px] bg-gray-50 rounded-xl p-3 flex items-end gap-[4px]">
        {[35,55,45,70,60,85,50,90,65,80,55,75,60,88,70,82,58,92,68,78].map((h,i)=>(
          <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-orange-400 to-rose-400" style={{height:`${h}%`}} />
        ))}
      </div>
      <div className="px-4 pb-4">
        <div className="text-[10px] font-semibold text-gray-700 mb-2">Achievements</div>
        <div className="grid grid-cols-2 gap-2">
          {[{t:'7-Day Streak',s:'Completed!',c:'bg-amber-100 text-amber-700'},{t:'Marathon Prep',s:'68% complete',c:'bg-sky-100 text-sky-700'},{t:'Calorie Goal',s:'5 of 7 days',c:'bg-emerald-100 text-emerald-700'},{t:'Early Bird',s:'3 workouts before 8am',c:'bg-violet-100 text-violet-700'}].map(({t,s,c})=>(
            <div key={t} className="p-2.5 rounded-xl border border-gray-100">
              <div className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded ${c} mb-1.5`}>{t}</div>
              <div className="text-[9px] text-gray-500">{s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FitnessNavPanel() {
  return (
    <div className={PANEL_BASE} style={{ width: 180, minHeight: 340 }}>
      <div className="p-3 space-y-0.5">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center"><Zap className="w-3 h-3 text-white" /></div>
          <div className="text-[11px] font-bold text-gray-900">FitTrack</div>
        </div>
        {[{l:'Dashboard',a:true,I:LayoutDashboard},{l:'Workouts',a:false,I:Zap},{l:'Nutrition',a:false,I:Heart},{l:'Progress',a:false,I:TrendingUp},{l:'Community',a:false,I:Users}].map(({l,a,I:Icon})=>(
          <div key={l} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-medium ${a?'bg-gradient-to-r from-orange-500 to-rose-500 text-white':'text-gray-500'}`}><Icon className="w-3 h-3" />{l}</div>
        ))}
        <div className="mt-4 px-1">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 border border-orange-100">
            <div className="text-[9px] font-bold text-gray-800">Today&apos;s Goal</div>
            <div className="text-[14px] font-black text-orange-500 mt-0.5">68%</div>
            <div className="text-[8px] text-gray-400">Keep going!</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FitnessLeaderboard() {
  return (
    <div className={PANEL_BASE} style={{ width: 340, minHeight: 380 }}>
      <div className="p-4">
        <div className="text-[13px] font-bold text-gray-900 mb-0.5">Leaderboard</div>
        <div className="text-[10px] text-gray-400 mb-4">This week&apos;s top performers</div>
        <div className="space-y-2.5">
          {[{n:'Sarah Chen',s:'58,430 steps',r:1,av:'bg-rose-500'},{n:'Alex Rivera',s:'52,180 steps',r:2,av:'bg-orange-500'},{n:'You',s:'48,294 steps',r:3,av:'bg-violet-500',me:true},{n:'Maya Patel',s:'45,920 steps',r:4,av:'bg-sky-500'},{n:'Liam Osei',s:'41,800 steps',r:5,av:'bg-emerald-500'},{n:'Jayda Moore',s:'38,650 steps',r:6,av:'bg-pink-500'}].map(({n,s,r,av,me})=>(
            <div key={n} className={`flex items-center gap-2.5 p-2 rounded-xl ${me?'bg-orange-50 border border-orange-200':'bg-gray-50'}`}>
              <div className={`text-[11px] font-bold w-5 text-center ${r<=3?'text-orange-500':'text-gray-400'}`}>{r}</div>
              <div className={`w-7 h-7 rounded-full ${av} flex items-center justify-center text-[10px] font-bold text-white`}>{n[0]}</div>
              <div className="flex-1"><div className="text-[10px] font-semibold text-gray-800">{n}{me?<span className="text-[8px] text-orange-500 ml-1">You</span>:null}</div><div className="text-[8px] text-gray-400">{s}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── SET 2: E-commerce / Food Delivery ── */

function FoodMenuPanel() {
  return (
    <div className={PANEL_BASE} style={{ width: 300, minHeight: 420 }}>
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div><div className="text-[11px] font-bold text-gray-800">FoodDash</div><div className="text-[9px] text-gray-400">Order from top restaurants</div></div>
          <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center"><Search className="w-3.5 h-3.5 text-gray-400" /></div>
        </div>
        <div className="flex gap-2 mt-2">
          {['All','Pizza','Sushi','Burger','Thai'].map((c,i)=>(
            <div key={c} className={`px-2.5 py-1 rounded-full text-[9px] font-medium ${i===0?'bg-emerald-500 text-white':'bg-white text-gray-500 shadow-sm'}`}>{c}</div>
          ))}
        </div>
      </div>
      <div className="p-3 space-y-2.5">
        {[{n:'Sakura Sushi Bar',r:'4.9',t:'25-35 min',p:'$$',tag:'Popular',color:'bg-rose-100 text-rose-600'},{n:'Mario\'s Pizzeria',r:'4.7',t:'20-30 min',p:'$',tag:'Free delivery',color:'bg-emerald-100 text-emerald-600'},{n:'Thai Orchid',r:'4.8',t:'30-40 min',p:'$$',tag:'New',color:'bg-amber-100 text-amber-600'}].map(({n,r,t,p,tag,color})=>(
          <div key={n} className="flex gap-3">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0">
              <div className={`w-8 h-8 rounded-lg ${n.includes('Sushi')?'bg-rose-100':'bg-emerald-100'} flex items-center justify-center`}>
                <UtensilsCrossed className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold text-gray-800">{n}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-semibold text-amber-500">★ {r}</span>
                <span className="text-[8px] text-gray-400">{t}</span>
                <span className="text-[8px] text-gray-400">{p}</span>
              </div>
              <div className={`inline-block text-[7px] font-bold px-1.5 py-0.5 rounded mt-1 ${color}`}>{tag}</div>
            </div>
          </div>
        ))}
        <div className="text-[10px] font-semibold text-gray-700 mt-2">Your Cart</div>
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[9px] font-semibold text-gray-800">2 items</div>
            <div className="text-[11px] font-bold text-emerald-600">$28.50</div>
          </div>
          <div className="px-3 py-1.5 bg-emerald-500 rounded-lg text-white text-[10px] font-semibold text-center">Checkout</div>
        </div>
      </div>
    </div>
  )
}

function FoodOrderPanel() {
  return (
    <div className={PANEL_BASE} style={{ width: 420, minHeight: 380 }}>
      <div className="px-4 pt-4 pb-2">
        <div className="text-[13px] font-bold text-gray-900 mb-0.5">Restaurant Dashboard</div>
        <div className="text-[9px] text-gray-400">Manage orders and menu</div>
      </div>
      <div className="px-4 pb-3 grid grid-cols-3 gap-2">
        {[{v:'84',l:'Active Orders',c:'from-emerald-400 to-teal-500'},{v:'$3,420',l:'Today Revenue',c:'from-sky-400 to-blue-500'},{v:'4.8',l:'Avg Rating',c:'from-amber-400 to-orange-500'}].map(({v,l,c})=>(
          <div key={l} className="p-2.5 rounded-xl bg-gray-50">
            <div className={`text-[14px] font-bold bg-gradient-to-r ${c} bg-clip-text text-transparent`}>{v}</div>
            <div className="text-[8px] text-gray-400 mt-0.5">{l}</div>
          </div>
        ))}
      </div>
      <div className="px-4 pb-3">
        <div className="text-[10px] font-semibold text-gray-700 mb-2">Recent Orders</div>
        <div className="space-y-1.5">
          {[{id:'#2847',c:'Sarah M.',items:'2x Salmon Roll, Miso Soup',total:'$34.50',st:'Preparing',sc:'bg-amber-100 text-amber-700'},{id:'#2846',c:'Alex K.',items:'Large Pepperoni, Garlic Bread',total:'$22.00',st:'Ready',sc:'bg-emerald-100 text-emerald-700'},{id:'#2845',c:'Nena R.',items:'Pad Thai, Spring Rolls',total:'$18.90',st:'Delivered',sc:'bg-sky-100 text-sky-700'},{id:'#2844',c:'Jake W.',items:'3x Taco, Guacamole',total:'$26.80',st:'Preparing',sc:'bg-amber-100 text-amber-700'}].map(({id,c,items,total,st,sc})=>(
            <div key={id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
              <div className="text-[9px] font-bold text-gray-500 w-10">{id}</div>
              <div className="flex-1 min-w-0"><div className="text-[9px] font-semibold text-gray-800">{c}</div><div className="text-[8px] text-gray-400 truncate">{items}</div></div>
              <div className="text-[9px] font-bold text-gray-800">{total}</div>
              <div className={`text-[7px] font-bold px-1.5 py-0.5 rounded ${sc}`}>{st}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FoodNavPanel() {
  return (
    <div className={PANEL_BASE} style={{ width: 180, minHeight: 340 }}>
      <div className="p-3 space-y-0.5">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center"><Globe className="w-3 h-3 text-white" /></div>
          <div className="text-[11px] font-bold text-gray-900">FoodDash</div>
        </div>
        {[{l:'Dashboard',a:true,I:LayoutDashboard},{l:'Orders',a:false,I:ClipboardList},{l:'Menu',a:false,I:UtensilsCrossed},{l:'Customers',a:false,I:Users},{l:'Analytics',a:false,I:TrendingUp}].map(({l,a,I:Icon})=>(
          <div key={l} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-medium ${a?'bg-gradient-to-r from-emerald-500 to-teal-500 text-white':'text-gray-500'}`}><Icon className="w-3 h-3" />{l}</div>
        ))}
        <div className="mt-4 px-1">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
            <div className="text-[9px] font-bold text-gray-800">Active Orders</div>
            <div className="text-[14px] font-black text-emerald-500 mt-0.5">84</div>
            <div className="text-[8px] text-gray-400">12 need attention</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FoodDeliveryMap() {
  return (
    <div className={PANEL_BASE} style={{ width: 340, minHeight: 380 }}>
      <div className="p-4">
        <div className="text-[13px] font-bold text-gray-900 mb-0.5">Live Deliveries</div>
        <div className="text-[10px] text-gray-400 mb-3">Tracking 8 active orders</div>
        <div className="h-[140px] rounded-xl bg-gradient-to-br from-emerald-50 via-sky-50 to-teal-50 border border-gray-100 relative overflow-hidden mb-3">
          <div className="absolute inset-0 opacity-20" style={{backgroundImage:'linear-gradient(90deg, transparent 49%, #e5e7eb 49%, #e5e7eb 51%, transparent 51%), linear-gradient(0deg, transparent 49%, #e5e7eb 49%, #e5e7eb 51%, transparent 51%)',backgroundSize:'30px 30px'}} />
          {[{t:30,l:25},{t:50,l:65},{t:70,l:40},{t:25,l:80}].map(({t,l},i)=>(
            <div key={i} className="absolute w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-md" style={{top:`${t}%`,left:`${l}%`}} />
          ))}
        </div>
        <div className="text-[10px] font-semibold text-gray-700 mb-2">Active Drivers</div>
        <div className="space-y-2">
          {[{n:'Marcus J.',o:'#2847 · Sakura Sushi',eta:'8 min',av:'bg-emerald-500'},{n:'Leila T.',o:'#2846 · Mario\'s Pizza',eta:'3 min',av:'bg-sky-500'},{n:'Sam R.',o:'#2845 · Thai Orchid',eta:'12 min',av:'bg-violet-500'}].map(({n,o,eta,av})=>(
            <div key={n} className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-full ${av} flex items-center justify-center text-[10px] font-bold text-white`}>{n[0]}</div>
              <div className="flex-1"><div className="text-[10px] font-semibold text-gray-800">{n}</div><div className="text-[8px] text-gray-400">{o}</div></div>
              <div className="text-[9px] font-semibold text-emerald-500">{eta}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── SET 3: Social Media / Content Platform ── */

function SocialFeedPanel() {
  return (
    <div className={PANEL_BASE} style={{ width: 300, minHeight: 420 }}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center"><Heart className="w-3.5 h-3.5 text-white" /></div>
          <div className="text-[12px] font-bold text-gray-900">Pulse</div>
        </div>
        <div className="flex gap-1.5">
          <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center"><Bell className="w-3.5 h-3.5 text-gray-400" /></div>
          <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center"><MessageSquare className="w-3.5 h-3.5 text-gray-400" /></div>
        </div>
      </div>
      {/* Stories row */}
      <div className="px-4 py-2.5 flex gap-3 border-b border-gray-100">
        {[{n:'Your story',c:'from-violet-400 to-pink-500',add:true},{n:'Sarah C.',c:'from-sky-400 to-blue-500'},{n:'Alex R.',c:'from-emerald-400 to-teal-500'},{n:'Maya P.',c:'from-amber-400 to-orange-500'}].map(({n,c,add})=>(
          <div key={n} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${c} p-[2px]`}>
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                {add
                  ? <div className="w-full h-full rounded-full bg-gray-50 flex items-center justify-center text-gray-400 text-[14px] font-light">+</div>
                  : <div className={`w-full h-full rounded-full bg-gradient-to-br ${c} flex items-center justify-center text-[10px] font-bold text-white`}>{n[0]}</div>
                }
              </div>
            </div>
            <div className="text-[7px] text-gray-400 font-medium max-w-[40px] truncate text-center">{n}</div>
          </div>
        ))}
      </div>
      {/* Post 1 */}
      <div className="px-4 pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white">NK</div>
          <div className="flex-1"><div className="text-[10px] font-semibold text-gray-800">Nena Kim</div><div className="text-[8px] text-gray-400">Designer at Figma · 2h</div></div>
          <div className="text-gray-300"><ChevronDown className="w-3 h-3" /></div>
        </div>
        <div className="text-[10px] text-gray-700 leading-relaxed">Just shipped the new design system at work. 6 months of work, 200+ components. So proud of the team!</div>
        <div className="h-32 rounded-xl relative overflow-hidden bg-gray-100">
          <img src="https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&dpr=2" alt="" className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/40 rounded text-[7px] text-white font-medium backdrop-blur-sm">1 / 3</div>
        </div>
        <div className="flex items-center justify-between pt-1 pb-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-[9px] text-gray-500 font-medium"><Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> 2,847</div>
            <div className="flex items-center gap-1 text-[9px] text-gray-500 font-medium"><MessageSquare className="w-3.5 h-3.5" /> 184</div>
            <div className="flex items-center gap-1 text-[9px] text-gray-500 font-medium"><Share2 className="w-3.5 h-3.5" /> 52</div>
          </div>
          <div className="flex -space-x-1.5">
            {['bg-sky-500','bg-emerald-500','bg-amber-500'].map((c,i)=>(
              <div key={i} className={`w-4 h-4 rounded-full ${c} border border-white text-[6px] text-white font-bold flex items-center justify-center`}>{['S','A','M'][i]}</div>
            ))}
          </div>
        </div>
      </div>
      {/* Post 2 preview */}
      <div className="px-4 pt-2 pb-3 border-t border-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center text-[9px] font-bold text-white">JM</div>
          <div className="flex-1"><div className="text-[10px] font-semibold text-gray-800">Jake Martinez</div><div className="text-[8px] text-gray-400">Engineer · 4h</div></div>
        </div>
        <div className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">Open-sourced our internal tool. 1.2k stars in the first day...</div>
      </div>
    </div>
  )
}

function SocialProfilePanel() {
  return (
    <div className={PANEL_BASE} style={{ width: 420, minHeight: 380 }}>
      {/* Cover */}
      <div className="h-24 bg-gradient-to-r from-violet-500 via-pink-500 to-rose-400 relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-50" />
      </div>
      <div className="px-5 pb-4 -mt-10">
        <div className="flex items-end justify-between mb-3">
          <div className="w-[72px] h-[72px] rounded-2xl bg-white shadow-lg p-1">
            <div className="w-full h-full rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-[22px] font-bold text-white">N</div>
          </div>
          <div className="flex gap-2 mb-1">
            <div className="px-3 py-1.5 rounded-lg border border-gray-200 text-[9px] font-semibold text-gray-600">Message</div>
            <div className="px-4 py-1.5 rounded-lg bg-violet-500 text-white text-[9px] font-semibold">Follow</div>
          </div>
        </div>
        <div className="mb-3">
          <div className="text-[14px] font-bold text-gray-900">Nena Rodriguez</div>
          <div className="text-[10px] text-gray-400">@nena.creates</div>
          <div className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">Product Designer at Figma. Building design tools. Previously at Stripe.</div>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="text-[9px] text-gray-400"><span className="font-semibold text-gray-700">12.4K</span> followers</div>
            <div className="text-[9px] text-gray-400"><span className="font-semibold text-gray-700">842</span> following</div>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-100 mb-3">
          {['Posts','Replies','Media','Likes'].map((t,i)=>(
            <div key={t} className={`pb-2 text-[10px] font-semibold ${i===0?'text-violet-500 border-b-2 border-violet-500':'text-gray-400'}`}>{t}</div>
          ))}
        </div>
        {/* Posts grid */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            {src:'https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=2',likes:'2.8K'},
            {src:'https://images.pexels.com/photos/1779487/pexels-photo-1779487.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=2'},
            {src:'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=2'},
            {src:'https://images.pexels.com/photos/3182812/pexels-photo-3182812.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=2'},
            {src:'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=2'},
            {src:'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=2'},
          ].map(({src,likes},i)=>(
            <div key={i} className="aspect-square rounded-lg relative overflow-hidden bg-gray-100">
              <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
              {likes&&<div className="absolute bottom-1 right-1 flex items-center gap-0.5 text-[7px] text-white font-medium bg-black/30 rounded px-1 py-0.5 backdrop-blur-sm"><Heart className="w-2 h-2" /> {likes}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SocialNavPanel() {
  return (
    <div className={PANEL_BASE} style={{ width: 180, minHeight: 340 }}>
      <div className="p-3 space-y-0.5">
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center"><Heart className="w-3 h-3 text-white" /></div>
          <div className="text-[11px] font-bold text-gray-900">Pulse</div>
        </div>
        {[{l:'Home',a:true,I:LayoutDashboard},{l:'Explore',a:false,I:Search},{l:'Notifications',a:false,I:Bell,badge:3},{l:'Messages',a:false,I:MessageSquare,badge:12},{l:'Bookmarks',a:false,I:HardDrive},{l:'Profile',a:false,I:Users}].map(({l,a,I:Icon,badge})=>(
          <div key={l} className={`flex items-center gap-2 px-2 py-2 rounded-xl text-[10px] font-medium ${a?'bg-gradient-to-r from-violet-500 to-pink-500 text-white':'text-gray-600'}`}>
            <Icon className="w-3.5 h-3.5" />
            <span className="flex-1">{l}</span>
            {badge&&!a?<div className="w-4 h-4 rounded-full bg-violet-500 text-white text-[7px] font-bold flex items-center justify-center">{badge}</div>:null}
          </div>
        ))}
        <div className="mt-4 px-1">
          <div className="w-full py-2 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white text-[10px] font-semibold text-center shadow-lg shadow-violet-500/20">New Post</div>
        </div>
        <div className="mt-3 px-1">
          <div className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Trending</div>
          {[{t:'#DesignSystems',p:'12.4K posts'},{t:'#OpenSource',p:'8.2K posts'},{t:'#ProductHunt',p:'5.1K posts'}].map(({t,p})=>(
            <div key={t} className="py-1"><div className="text-[9px] font-semibold text-violet-500">{t}</div><div className="text-[7px] text-gray-400">{p}</div></div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SocialNotificationsPanel() {
  return (
    <div className={PANEL_BASE} style={{ width: 340, minHeight: 380 }}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div><div className="text-[13px] font-bold text-gray-900">Notifications</div><div className="text-[9px] text-gray-400">You have 6 new notifications</div></div>
        <div className="text-[9px] font-medium text-violet-500">Mark all read</div>
      </div>
      <div className="px-4 pb-4 space-y-1">
        {[{n:'Sarah Chen',a:'followed you',t:'2m ago',av:'bg-rose-500',type:'follow',unread:true},
          {n:'Alex Rivera',a:'liked your post',t:'8m ago',av:'bg-sky-500',type:'like',unread:true},
          {n:'Design Team',a:'mentioned you in a comment',t:'15m ago',av:'bg-violet-500',type:'mention',unread:true},
          {n:'Maya Patel',a:'shared your post',t:'1h ago',av:'bg-emerald-500',type:'share',unread:false},
          {n:'Liam Osei',a:'started following you',t:'2h ago',av:'bg-amber-500',type:'follow',unread:false},
          {n:'Jake Martinez',a:'replied to your comment',t:'3h ago',av:'bg-indigo-500',type:'reply',unread:false},
          {n:'Kate Liu',a:'liked your photo',t:'5h ago',av:'bg-pink-500',type:'like',unread:false},
        ].map(({n,a,t,av,unread})=>(
          <div key={n+a} className={`flex items-start gap-2.5 p-2.5 rounded-xl ${unread?'bg-violet-50/70':'hover:bg-gray-50'} transition-colors`}>
            <div className={`w-8 h-8 rounded-full ${av} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>{n[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-gray-700"><span className="font-semibold text-gray-900">{n}</span> {a}</div>
              <div className="text-[8px] text-gray-400 mt-0.5">{t}</div>
            </div>
            {unread&&<div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0 mt-2" />}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Panel sets for rotation ── */
type PanelSet = { left: React.ReactNode; centerLeft: React.ReactNode; centerRight: React.ReactNode; right: React.ReactNode }

const PANEL_SETS: { panels: () => PanelSet; prompt: string }[] = [
  { panels: () => ({ left: <CalendarPanel />, centerLeft: <TeamPanel />, centerRight: <SidebarPanel />, right: <AnalyticsPanel /> }), prompt: 'Dashboard for a SaaS product with calendar and analytics' },
  { panels: () => ({ left: <FitnessPanel />, centerLeft: <FitnessLeaderboard />, centerRight: <FitnessNavPanel />, right: <FitnessStatsPanel /> }), prompt: 'A fitness tracking app with workout stats and progress charts' },
  { panels: () => ({ left: <FoodMenuPanel />, centerLeft: <FoodDeliveryMap />, centerRight: <FoodNavPanel />, right: <FoodOrderPanel /> }), prompt: 'Food delivery app with restaurant listings and live tracking' },
  { panels: () => ({ left: <SocialFeedPanel />, centerLeft: <SocialNotificationsPanel />, centerRight: <SocialNavPanel />, right: <SocialProfilePanel /> }), prompt: 'Social media platform with feed, profiles and notifications' },
]

/* Floating prompt bar for hero (typing synced to panel rotation) */
function HeroPromptBar({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_-8px_rgba(0,0,0,0.15)] border border-gray-100 px-4 py-3 flex items-center gap-3" style={{ width: 480, maxWidth: '90vw' }}>
      <Sparkles className="w-4 h-4 text-gray-300 flex-shrink-0" />
      <div className="flex-1 text-[12px] text-gray-500 min-h-[20px] truncate">
        {text}<span className="animate-pulse text-gray-400">|</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400"><SlidersHorizontal className="w-3.5 h-3.5" /></div>
        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400"><Paperclip className="w-3.5 h-3.5" /></div>
        <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center text-white shadow-lg shadow-sky-500/30"><ArrowUp className="w-4 h-4" /></div>
      </div>
    </div>
  )
}

/* All panel sets pre-rendered, crossfade via opacity for buttery animation */
function PanelLayer({ panels, style }: { panels: PanelSet; style?: React.CSSProperties }) {
  return (
    <div className="absolute inset-0" style={style}>
      <div className="absolute hidden md:block" style={{ left: '-2%', top: 40, transform: 'rotate(-2deg)', zIndex: 1 }}>
        {panels.left}
      </div>
      <div className="absolute hidden lg:block" style={{ left: '18%', top: 10, transform: 'rotate(-0.5deg)', zIndex: 3 }}>
        {panels.centerLeft}
      </div>
      <div className="absolute hidden lg:block" style={{ right: '30%', top: 30, transform: 'rotate(0.5deg)', zIndex: 2 }}>
        {panels.centerRight}
      </div>
      <div className="absolute hidden md:block" style={{ right: '-3%', top: 20, transform: 'rotate(1deg)', zIndex: 4 }}>
        {panels.right}
      </div>
    </div>
  )
}

function HeroShowcase() {
  const [activeIdx, setActiveIdx] = useState(0)
  const [typedText, setTypedText] = useState('')

  // Pre-render all panel sets once
  const allSets = useRef(PANEL_SETS.map(s => s.panels())).current

  useEffect(() => {
    const prompt = PANEL_SETS[activeIdx].prompt
    let charIdx = 0
    setTypedText('')

    const typeTimer = setInterval(() => {
      if (charIdx < prompt.length) {
        setTypedText(prompt.slice(0, charIdx + 1))
        charIdx++
      } else {
        clearInterval(typeTimer)
      }
    }, 35)

    // Switch after typing + 3s dwell
    const switchTimer = setTimeout(() => {
      setActiveIdx(idx => (idx + 1) % PANEL_SETS.length)
    }, prompt.length * 35 + 3500)

    return () => {
      clearInterval(typeTimer)
      clearTimeout(switchTimer)
    }
  }, [activeIdx])

  return (
    <div className="relative w-full" style={{ height: 520 }}>
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50/80 to-transparent rounded-3xl" />

      {/* All panel sets stacked — only active one is visible via CSS opacity (no mount/unmount) */}
      {allSets.map((panels, i) => (
        <PanelLayer
          key={i}
          panels={panels}
          style={{
            opacity: i === activeIdx ? 1 : 0,
            transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: i === activeIdx ? 'auto' : 'none',
          }}
        />
      ))}

      {/* Floating prompt bar */}
      <div className="absolute hidden md:block" style={{ left: '50%', top: -10, transform: 'translateX(-50%)', zIndex: 10 }}>
        <HeroPromptBar text={typedText} />
      </div>

      {/* Mobile: crossfade left panel only */}
      <div className="md:hidden flex flex-col items-center gap-4 relative z-10 pt-4">
        <HeroPromptBar text={typedText} />
        <div className="relative" style={{ minHeight: 420, width: 300 }}>
          {allSets.map((panels, i) => (
            <div
              key={i}
              style={{
                position: i === 0 ? 'relative' : 'absolute',
                top: 0, left: 0,
                opacity: i === activeIdx ? 1 : 0,
                transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                pointerEvents: i === activeIdx ? 'auto' : 'none',
              }}
            >
              {panels.left}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


/* ───────────── FAQ Accordion ───────────── */
function FAQ({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border border-border bg-card">
          <button
            className="w-full text-left px-5 py-4 flex items-center justify-between gap-4"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="text-sm font-semibold text-foreground">{item.q}</span>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${
                open === i ? 'rotate-180' : ''
              }`}
            />
          </button>
          {open === i && (
            <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ───────────── Main page ───────────── */
export default function FlowLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── NAVBAR ── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-background/90 backdrop-blur-md border-b border-border shadow-sm' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/flow" className="flex items-center gap-2.5">
            <Logo size="w-7 h-7" />
            <span className="text-lg font-bold tracking-tight text-foreground">DCFlow</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Log in
            </Link>
            <Link href="/register" className="group px-5 py-2 text-sm font-medium bg-foreground text-background hover:opacity-90 transition-all hover:-translate-y-px flex items-center gap-2">
              Get started
              <span className="text-[10px] opacity-60 font-normal">free</span>
            </Link>
          </div>

          <button className="md:hidden p-2 text-foreground" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-background border-b border-border px-6 pb-4 space-y-3">
            <a href="#features" className="block text-sm text-muted-foreground py-1" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#pricing" className="block text-sm text-muted-foreground py-1" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <div className="flex gap-3 pt-2">
              <Link href="/login" className="text-sm font-medium text-foreground">Log in</Link>
              <Link href="/register" className="px-4 py-2 text-sm font-medium bg-foreground text-background">Get started free</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── BADGE ── */}
      <div className="pt-28 md:pt-36 flex justify-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            New
          </div>
        </Reveal>
      </div>

      {/* ── HERO ── */}
      <section className="relative pt-6 pb-8 md:pt-8 md:pb-16">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <Reveal delay={100}>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.08] mb-5">
                Design stunning UIs<br />with AI
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto mb-8">
                Create beautiful, production-quality designs with our AI design tool. Fast and simple, like a 10x designer.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                <Link
                  href="/register"
                  className="group px-8 py-3.5 text-base font-semibold bg-foreground text-background hover:opacity-90 transition-all hover:-translate-y-px flex items-center gap-2"
                >
                  Get started
                  <span className="text-sm opacity-60 font-normal">free</span>
                </Link>
              </div>
            </Reveal>
          </div>

          {/* Hero showcase — overlapping light-theme panels */}
          <Reveal delay={450}>
            <HeroShowcase />
          </Reveal>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <section className="py-10 md:py-14 border-y border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <p className="text-center text-xs font-medium text-muted-foreground uppercase tracking-widest mb-6">
              In toolkits of builders from
            </p>
          </Reveal>
          <Reveal delay={50}>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 opacity-40">
              {['Y Combinator', 'Vercel', 'Stripe', 'Notion', 'Linear', 'Figma'].map(name => (
                <span key={name} className="text-sm font-bold text-foreground tracking-wide">{name}</span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── EASIEST WAY ── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="max-w-3xl mx-auto text-center mb-4">
              <h2 className="text-3xl md:text-5xl font-black text-foreground leading-tight mb-5">
                The easiest way to design UI
              </h2>
              <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
                Describe your product in plain language and DCFlow generates editable, multi-screen prototypes in seconds.
                Refine, share, export to Figma or code.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURES — alternating sections with illustrations ── */}
      <section id="features" className="pb-16 md:pb-24">
        <div className="max-w-7xl mx-auto px-6 space-y-24 md:space-y-32">

          {/* Feature 1 — Generate from text */}
          <Reveal>
            <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">AI Generation</p>
                <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                  Generate interactive designs from text
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed mb-6">
                  Describe your product in plain language and DCFlow generates editable, multi-screen prototypes in seconds.
                  Refine, share, export to Figma or code.
                </p>
                <Link href="/register" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors">
                  Generate from text <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="flex justify-center">
                <div className="transform scale-90 origin-top">
                  <CalendarPanel />
                </div>
              </div>
            </div>
          </Reveal>

          {/* Feature 2 — Create from reference */}
          <Reveal>
            <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div className="order-2 md:order-1 flex justify-center">
                <div className="transform scale-90 origin-top">
                  <AnalyticsPanel />
                </div>
              </div>
              <div className="order-1 md:order-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Reference Import</p>
                <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                  Create designs from any reference
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed mb-6">
                  Drop images, screenshots, or links. DCFlow extracts the visual style and layout so you can
                  generate fresh ideas or recreate the UI.
                </p>
                <Link href="/register" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors">
                  Get started <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Feature 3 — Your style, instantly */}
          <Reveal>
            <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Theming</p>
                <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                  Your style, instantly
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed mb-6">
                  Ask AI to make your design more playful, minimal, or anything in between. Fine tune colors,
                  typography, and other tokens manually to match your style.
                </p>
                <Link href="/register" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors">
                  Get started <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="flex justify-center">
                {/* Theme showcase — light-theme cards */}
                <div className="flex gap-3 items-start">
                  {[
                    { bg: 'bg-white', border: 'border-gray-100', accent: 'from-sky-400 to-indigo-500', name: 'Clean', items: ['#3B82F6', '#22C55E', '#F59E0B'] },
                    { bg: 'bg-white', border: 'border-gray-100', accent: 'from-violet-500 to-pink-500', name: 'Playful', items: ['#8B5CF6', '#EC4899', '#F472B6'] },
                    { bg: 'bg-white', border: 'border-gray-100', accent: 'from-emerald-500 to-teal-500', name: 'Fresh', items: ['#10B981', '#14B8A6', '#06B6D4'] },
                  ].map(({ bg, border, accent, name, items }, i) => (
                    <div key={name} className={`${i === 1 ? 'scale-105 shadow-xl' : 'scale-95 opacity-75 shadow-lg'} transition-all rounded-xl overflow-hidden ${bg} ${border} border`} style={{ width: 120 }}>
                      <div className={`h-2 bg-gradient-to-r ${accent}`} />
                      <div className="p-2.5 space-y-2">
                        <div className="text-[9px] font-bold text-gray-800">{name}</div>
                        <div className="flex gap-1">
                          {items.map(c => (
                            <div key={c} className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <div className={`h-5 rounded-md bg-gradient-to-r ${accent} opacity-70`} />
                        <div className="h-3 rounded bg-gray-100 w-3/4" />
                        <div className="grid grid-cols-2 gap-1">
                          <div className={`h-10 rounded-md bg-gradient-to-br ${accent} opacity-20`} />
                          <div className={`h-10 rounded-md bg-gradient-to-br ${accent} opacity-15`} />
                        </div>
                        <div className="h-2 bg-gray-50 rounded w-full" />
                        <div className="h-2 bg-gray-50 rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Feature 4 — Share and export */}
          <Reveal>
            <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div className="order-2 md:order-1 flex justify-center">
                {/* Export mockup */}
                <div className="w-full max-w-sm bg-card border border-border shadow-lg overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <div className="text-sm font-semibold text-foreground mb-1">Export project</div>
                    <div className="text-xs text-muted-foreground">Choose your format</div>
                  </div>
                  <div className="p-4 space-y-2">
                    {[
                      { icon: Image, label: 'PNG / Screenshots', desc: 'All screens as images', tag: 'Free' },
                      { icon: Figma, label: 'Figma', desc: 'Editable Figma file', tag: 'Pro' },
                      { icon: Share2, label: 'HTML / CSS', desc: 'Production-ready code', tag: 'Pro' },
                      { icon: Wand2, label: 'DCCortex', desc: 'Continue building in DCCortex', tag: 'New' },
                    ].map(({ icon: Icon, label, desc, tag }) => (
                      <div key={label} className="flex items-center gap-3 px-3 py-3 border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="w-8 h-8 bg-muted flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-foreground">{label}</div>
                          <div className="text-[10px] text-muted-foreground">{desc}</div>
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${
                          tag === 'New' ? 'bg-primary/10 text-primary' : tag === 'Pro' ? 'bg-foreground/10 text-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          {tag}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="order-1 md:order-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Export</p>
                <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                  Share and export in one click
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed mb-6">
                  Send a link to get feedback from teammates. When ready to ship, export to Figma, HTML/CSS,
                  images — or push directly to DCCortex to continue building a full-blown application.
                </p>
                <Link href="/register" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors">
                  Start designing <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </Reveal>

        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 md:py-28 bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                Loved by builders
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Product managers, founders, designers, and developers use DCFlow to bring ideas to life.
              </p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: 'Faisal A.', role: 'Product Manager', quote: 'As a PM, I need quick wireframes to communicate ideas. DCFlow was the simplest tool and delivered instant value.' },
              { name: 'Alex K.', role: 'Designer', quote: 'I can click on an element and see what the user sees after interaction. Truly intuitive approach.' },
              { name: 'Nena R.', role: 'Founder', quote: 'Incredible how easy it is, how it speeds up design and offers remarkable adaptability.' },
              { name: 'Jayda M.', role: 'Developer', quote: 'Probably the best UI generation I\'ve tried. The export to code feature is a game changer.' },
              { name: 'Pavel S.', role: 'Indie Hacker', quote: 'Start using it today. These guys are building a mind-blowing product.' },
              { name: 'Jake W.', role: 'Student', quote: 'I love the minimal design. Not overwhelming compared to other tools.' },
              { name: 'Lynn C.', role: 'Agency Owner', quote: 'Great prototypes and interactive AI responses. We use it for every client pitch now.' },
              { name: 'Kate L.', role: 'UX Lead', quote: 'The quality of the AI design copilot is outstanding. Saves our team hours every week.' },
            ].map(({ name, role, quote }, i) => (
              <Reveal key={name} delay={i * 50}>
                <div className="p-5 border border-border bg-background h-full">
                  <Quote className="w-4 h-4 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{quote}</p>
                  <div>
                    <div className="text-xs font-semibold text-foreground">{name}</div>
                    <div className="text-[10px] text-muted-foreground">{role}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECOND PROMPT CTA ── */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-8">
              <Link href="/register" className="group inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-foreground text-background hover:opacity-90 transition-all hover:-translate-y-px">
                Get started <span className="text-xs opacity-60 font-normal">free</span>
              </Link>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="max-w-2xl mx-auto text-center mb-12">
              <p className="text-muted-foreground text-sm">What should we design today?</p>
            </div>
          </Reveal>
          {/* Scrolling mockup showcase */}
          <Reveal delay={200}>
            <div className="flex gap-4 justify-center flex-wrap">
              {[
                { bg: 'from-violet-600 to-indigo-700', label: 'E-commerce' },
                { bg: 'from-emerald-500 to-cyan-600', label: 'Dashboard' },
                { bg: 'from-pink-500 to-rose-600', label: 'Social' },
                { bg: 'from-amber-500 to-orange-600', label: 'Fintech' },
                { bg: 'from-blue-500 to-violet-600', label: 'Health' },
              ].map(({ bg, label }) => (
                <div key={label} className="group cursor-pointer">
                  <div className={`w-32 h-44 md:w-40 md:h-56 rounded-xl bg-gradient-to-br ${bg} shadow-lg shadow-black/10 group-hover:shadow-xl group-hover:-translate-y-1 transition-all duration-300 flex items-end p-3`}>
                    <div className="text-white">
                      <div className="text-[9px] text-white/50 uppercase tracking-wider mb-0.5">Template</div>
                      <div className="text-xs font-bold">{label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 md:py-32 bg-muted/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Free to start, scale when you&apos;re ready
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Generate unlimited mockups on the free tier. Upgrade for team collaboration,
                custom branding, and API access.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                title: 'Free',
                price: '$0',
                desc: 'For individuals exploring ideas.',
                items: ['Unlimited AI screens', 'Phone, tablet, desktop', 'PNG export', 'Community themes'],
              },
              {
                title: 'Pro',
                price: '$19/mo',
                desc: 'For designers shipping client work.',
                items: ['Everything in Free', 'HTML/CSS + Figma export', 'Custom themes', 'Share live links', 'Priority generation'],
                highlighted: true,
              },
              {
                title: 'Team',
                price: '$49/mo',
                desc: 'For agencies and product teams.',
                items: ['Everything in Pro', 'Team workspace (5 seats)', 'DCCortex export', 'API access + embeds', 'White-label'],
              },
            ].map(({ title, price, desc, items, highlighted }, i) => (
              <Reveal key={title} delay={i * 80}>
                <div className={`p-6 bg-card border h-full ${highlighted ? 'border-primary shadow-lg shadow-primary/10' : 'border-border'}`}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <h3 className="text-base font-semibold text-foreground">{title}</h3>
                    {highlighted && <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Popular</span>}
                  </div>
                  <div className="text-2xl font-black text-foreground mb-2">{price}</div>
                  <p className="text-sm text-muted-foreground mb-5">{desc}</p>
                  <ul className="space-y-2 mb-6">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-foreground flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={`block text-center py-2.5 text-sm font-medium transition-all ${
                      highlighted
                        ? 'bg-foreground text-background hover:opacity-90'
                        : 'border border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    {title === 'Free' ? 'Start Free' : 'Get Started'}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground mb-6 leading-tight">
                Design beautiful products, now!
              </h2>
              <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
                Get started with DCFlow, the AI design tool for easy and fast design ideation. Free. No credit card.
              </p>
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold bg-foreground text-background hover:opacity-90 transition-all hover:-translate-y-px"
              >
                Start designing
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 md:py-24 bg-card/50 border-t border-border">
        <div className="max-w-2xl mx-auto px-6">
          <Reveal>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-10">
              Frequently Asked Questions
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <FAQ items={[
              {
                q: 'What is DCFlow?',
                a: 'DCFlow is an AI UI design tool that generates ready-to-edit UI designs and prototypes from prompts, references, and briefs. It helps product teams create beautiful, on-brand interfaces in minutes instead of days.',
              },
              {
                q: 'Who is it for?',
                a: 'DCFlow is for product teams who need to ship UI fast: non-designers, PMs, startup founders, engineers, and teams with limited design resources. And for designers who want an AI copilot to handle the busywork.',
              },
              {
                q: 'How does it work?',
                a: 'Our AI turns your idea into a multi-screen, clickable UI prototype from a prompt or design reference. Tweak anything visually, then share a link or export to Figma, HTML/CSS, DCCortex, or images.',
              },
              {
                q: 'Can I export to Figma or code?',
                a: 'Yes. Free users can export PNG screenshots. Pro users get Figma files and HTML/CSS code. Team users can also push directly to DCCortex to continue building full applications.',
              },
              {
                q: 'Is my data private?',
                a: 'Everything you generate is private and not used for training. Your data, inputs, and generations are not tied to you as a user.',
              },
              {
                q: 'Who is behind DCFlow?',
                a: 'DCFlow is built by Dotcorr, the same team behind DCCortex. We\'re a small team passionate about making design accessible to everyone.',
              },
            ]} />
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#000] text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Logo size="w-6 h-6" />
                <span className="text-base font-bold text-white">DCFlow</span>
              </div>
              <p className="text-sm leading-relaxed">
                AI-powered UI design and prototyping tool. Part of the DCCortex ecosystem by Dotcorr.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link href="/register" className="hover:text-white transition-colors">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Ecosystem</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/" className="hover:text-white transition-colors">DCCortex</Link></li>
                <li><a href="https://dotcorr.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Dotcorr</a></li>
                <li><a href="https://github.com/dotcorr/dccortex" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://dotcorr.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">About</a></li>
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
