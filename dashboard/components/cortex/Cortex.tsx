/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Cortex — the AI assistant floating panel for DCCortex.
 * Sharp-cornered black/white platform theme. Orb trigger. Model picker. No emojis.
 */
'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import {
  ArrowUp,
  ChevronLeft,
  Clock,
  ExternalLink,
  Mic,
  MicOff,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  X,
  ChevronDown,
  Cpu,
} from 'lucide-react'

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRecognitionAny = any

/* ───────────── Types ───────────── */
type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: { actionResults?: ActionResult[]; debugTrace?: DebugTrace; auditArtifact?: AuditArtifact } | null
  createdAt: string
}

type ActionResult = {
  type: string
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

type StreamingAction = {
  type: string
  status: 'running' | 'done'
  ok?: boolean
  result?: ActionResult
}

type ThreadSummary = {
  id: string
  title: string
  projectId: string | null
  updatedAt: string
  _count: { messages: number }
}

type ProjectOption = {
  id: string
  name: string
  slug: string
}

type ParsedAI = {
  message: string
  actions?: { type: string; params: Record<string, unknown> }[]
  followUp?: string | null
}

type ParsedAIAction = NonNullable<ParsedAI['actions']>[number]

type ModelOption = {
  id: string
  name: string
  description: string
}

type DebugTrace = {
  model: string
  userPrompt: string
  parseMode: 'json' | 'fallback'
  parseError?: string
  rawOutputPreview: string
  extractedJsonPreview?: string
  parsedActionCount: number
  parsedActionTypes: string[]
  failedActionCount: number
  failedActions: { type: string; error?: string }[]
  auditRunId?: string
  auditFile?: string
}

type AuditArtifact = {
  runId: string
  createdAt: string
  threadId: string
  organizationId: string
  userId: string
  projectId: string | null
  model: string
  prompt: string
  parse: {
    mode: 'json' | 'fallback'
    parseError?: string
    repairAttempted?: boolean
    repairSucceeded?: boolean
    repairError?: string
    selfHealAttempted?: boolean
    selfHealSucceeded?: boolean
    selfHealError?: string
  }
  generation: {
    rawModelOutput: string
    extractedJson?: string
    parsedActionTypes: string[]
    parsedActionCount: number
    assistantMessage: string
    followUp?: string | null
  }
  execution: {
    actionResults: ActionResult[]
    failedActions: { type: string; error?: string }[]
    failedActionCount: number
  }
}

const CHAT_REQUEST_TIMEOUT_MS = 90_000

type CortexProps = {
  embedded?: boolean
  projectId?: string | null
  projectName?: string | null
  organizationId?: string | null
  className?: string
}

/* ───────────── Helpers ───────────── */
function extractOrgId(pathname: string): string | null {
  const m = pathname.match(/\/organizations\/([^/]+)/)
  return m ? m[1] : null
}

function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

function formatActionLabel(actionType: string): string {
  return actionType.replace(/_/g, ' ')
}

function renderActionDetail(action: StreamingAction): string | null {
  if (!action.result) return null
  if (action.result.error) return action.result.error
  if (action.type === 'validate_api') {
    const data = action.result.data ?? {}
    const status = data.status ? `HTTP ${String(data.status)}` : null
    const elapsed = typeof data.elapsed === 'string' ? data.elapsed : null
    const sampleCount = typeof data.sampleCount === 'number' ? `${data.sampleCount} sample${data.sampleCount === 1 ? '' : 's'}` : null
    const parts = [status, elapsed, sampleCount].filter(Boolean)
    return parts.length > 0 ? parts.join(' • ') : null
  }
  return null
}

function parseAssistantJson(raw: string): ParsedAI | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed.message === 'string') {
      return parsed as ParsedAI
    }
  } catch {
    return null
  }
  return null
}

function parseActionsFromMessage(raw: string): ParsedAIAction[] {
  const parsed = parseAssistantJson(raw)
  return Array.isArray(parsed?.actions) ? parsed.actions : []
}

function downloadAuditArtifact(artifact: AuditArtifact): void {
  const fileName = `cortex-audit-${artifact.runId}.json`
  const blob = new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/* ───────────── Component ───────────── */
export default function Cortex({
  embedded = false,
  projectId = null,
  projectName = null,
  organizationId = null,
  className = '',
}: CortexProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const orgId = organizationId ?? extractOrgId(pathname)

  // Core state
  const [open, setOpen] = useState(embedded)
  const [view, setView] = useState<'chat' | 'history' | 'preview'>('chat')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  // Streaming / thinking UI
  const [thinkingStep, setThinkingStep] = useState<string | null>(null)
  const [streamingActions, setStreamingActions] = useState<StreamingAction[]>([])

  // Context switching
  const [contextProjectId, setContextProjectId] = useState<string | null>(null)
  const [contextProjectName, setContextProjectName] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [projectFilter, setProjectFilter] = useState('')

  // Model picker
  const [models, setModels] = useState<ModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [previewNonce, setPreviewNonce] = useState<number>(() => Date.now())

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognitionAny>(null)
  const abortRef = useRef<AbortController | null>(null)

  /* ───────────── Fetch projects ───────────── */
  useEffect(() => {
    if (!orgId) return
    fetch(`/api/projects?organizationId=${orgId}`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {})
  }, [orgId])

  /* ───────────── Fetch available models ───────────── */
  useEffect(() => {
    if (!orgId) return
    fetch('/api/cortex/models')
      .then((r) => r.json())
      .then((d) => {
        if (d.models?.length) setModels(d.models)
      })
      .catch(() => {})
  }, [orgId])

  /* ───────────── Fetch thread history ───────────── */
  const fetchThreads = useCallback(async () => {
    if (!orgId) return
    try {
      const r = await fetch(`/api/cortex/threads?organizationId=${orgId}`)
      const d = await r.json()
      setThreads(d.threads ?? [])
    } catch {}
  }, [orgId])

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  /* ───────────── Open via external event ───────────── */
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('cortex:open', handler)
    return () => window.removeEventListener('cortex:open', handler)
  }, [])

  /* ───────────── Viewport size ───────────── */
  useEffect(() => {
    const apply = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])

  /* ───────────── Drag logic ───────────── */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging || !dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setPosition({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy })
    }
    const onUp = () => setDragging(false)
    if (dragging) {
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  /* ───────────── Scroll to bottom ───────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setPreviewNonce(Date.now())
  }, [contextProjectId])

  useEffect(() => {
    if (!embedded) return
    setOpen(true)
  }, [embedded])

  useEffect(() => {
    if (!projectId) return
    setContextProjectId(projectId)
    setContextProjectName(projectName ?? 'Project')
  }, [projectId, projectName])

  // Must be after all hooks
  if (!session?.user || !orgId) return null

  /* ───────────── Load thread messages ───────────── */
  const loadThread = async (tid: string) => {
    try {
      const r = await fetch(`/api/cortex/threads/${tid}/messages`)
      const d = await r.json()
      setMessages(d.messages ?? [])
      setThreadId(tid)
      if (d.thread?.projectId) {
        setContextProjectId(d.thread.projectId)
        const p = projects.find((pp) => pp.id === d.thread.projectId)
        setContextProjectName(p?.name ?? 'Project')
      }
      setView('chat')
    } catch {}
  }

  /* ───────────── New thread ───────────── */
  const newThread = () => {
    setMessages([])
    setThreadId(null)
    setView('chat')
  }

  /* ───────────── Delete thread ───────────── */
  const deleteThread = async (tid: string) => {
    await fetch('/api/cortex/threads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: tid }),
    })
    if (threadId === tid) newThread()
    fetchThreads()
  }

  /* ───────────── Send message ───────────── */
  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || loading || !orgId) return

    // Detect @project context switch
    const atMatch = text.match(/^@(\S+)/)
    if (atMatch) {
      const query = atMatch[1].toLowerCase()
      const match = projects.find(
        (p) => String(p.name ?? '').toLowerCase() === query || String(p.slug ?? '').toLowerCase() === query
      )
      if (match) {
        setContextProjectId(match.id)
        setContextProjectName(match.name)
        const rest = text.slice(atMatch[0].length).trim()
        if (!rest) {
          const sysMsg: Message = {
            id: Date.now().toString(),
            role: 'system',
            content: `Context switched to **${match.name}**`,
            createdAt: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, sysMsg])
          setInput('')
          return
        }
        setInput(rest)
      }
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setThinkingStep('Connecting…')
    setStreamingActions([])

    let timedOut = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    try {
      const controller = new AbortController()
      abortRef.current = controller
      timeoutId = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, CHAT_REQUEST_TIMEOUT_MS)

      const res = await fetch('/api/cortex/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          threadId,
          organizationId: orgId,
          projectId: contextProjectId,
          model: selectedModel,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const isRateLimit = res.status === 429
        const errMsg: Message = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: isRateLimit
            ? '⏳ Slow down — too many messages. Wait a moment before sending another.'
            : `Error ${res.status}: ${errData.error ?? 'Request failed'}`,
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errMsg])
        return
      }

      // SSE streaming reader
      if (!res.body) {
        throw new Error('Generation stream was unavailable')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let finalActionResults: Array<{ type: string; success: boolean; error?: string; data?: Record<string, unknown> }> = []
      let finalDebugTrace: DebugTrace | null = null
      let finalAuditArtifact: AuditArtifact | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()!          // last partial line stays in buf

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let evt: Record<string, unknown>
          try { evt = JSON.parse(line.slice(6)) } catch { continue }

          if (evt.type === 'thinking') {
            setThinkingStep(evt.step as string)
          } else if (evt.type === 'action') {
            const status = evt.status as 'running' | 'done'
            const actionType = evt.actionType as string
            setStreamingActions((prev) => {
              const existing = prev.findIndex((a) => a.type === actionType && a.status === 'running')
              if (status === 'running') {
                return existing === -1 ? [...prev, { type: actionType, status: 'running' }] : prev
              }
              // done — mark it
              const next = [...prev]
              const nextValue = { type: actionType, status: 'done' as const, ok: (evt.ok as boolean) ?? true, result: evt.result as ActionResult | undefined }
              if (existing !== -1) next[existing] = nextValue
              else next.push(nextValue)
              return next
            })
          } else if (evt.type === 'message') {
            const msgText = evt.text as string ?? ''
            const followUp = evt.followUp as string | undefined
            const newThreadId = evt.threadId as string | undefined
            if (newThreadId) setThreadId(newThreadId)
            const display = followUp ? `${msgText}\n\n*${followUp}*` : msgText
            const asstMsg: Message = {
              id: `asst-${Date.now()}`,
              role: 'assistant',
              content: display,
              metadata: null,
              createdAt: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, asstMsg])
          } else if (evt.type === 'done') {
            finalActionResults = (evt.actionResults as typeof finalActionResults) ?? []
            finalDebugTrace = (evt.debugTrace as DebugTrace | null) ?? null
            finalAuditArtifact = (evt.auditArtifact as AuditArtifact | null) ?? null
            if (evt.threadId) setThreadId(evt.threadId as string)
            fetchThreads()

            if (finalActionResults.length > 0 || finalDebugTrace || finalAuditArtifact) {
              setMessages((prev) => {
                const next = [...prev]
                for (let i = next.length - 1; i >= 0; i--) {
                  if (next[i].role !== 'assistant') continue
                  next[i] = {
                    ...next[i],
                    metadata: {
                      actionResults: finalActionResults,
                      debugTrace: finalDebugTrace ?? undefined,
                      auditArtifact: finalAuditArtifact ?? undefined,
                    },
                  }
                  break
                }
                return next
              })
            }

            if (finalActionResults.some((r) => r.success)) {
              setPreviewNonce(Date.now())
              window.dispatchEvent(new CustomEvent('cortex:refresh'))
              const newScreen = finalActionResults.find(
                (r) => r.type === 'create_screen' && r.success && r.data?.screenId
              )
              if (newScreen?.data?.screenId) {
                window.dispatchEvent(new CustomEvent('cortex:navigate-screen', { detail: { screenId: newScreen.data.screenId } }))
              }
            }
          } else if (evt.type === 'error') {
            const errMsg: Message = {
              id: `err-${Date.now()}`,
              role: 'assistant',
              content: `Error: ${(evt.error as string) ?? (evt.message as string) ?? 'Unknown error'}`,
              createdAt: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, errMsg])
          }
        }
      }
    } catch (err) {
      const errorMessage = timedOut
        ? 'Generation timed out before the AI returned a usable response. Please try again.'
        : err instanceof Error
          ? err.message
          : 'Request failed'
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      abortRef.current = null
      setLoading(false)
      setThinkingStep(null)
      setStreamingActions([])
    }
  }

  /* ───────────── Stop generation ───────────── */
  const stopGeneration = () => {
    abortRef.current?.abort()
    abortRef.current = null
  }

  /* ───────────── Edit / resend message ───────────── */
  const editMessage = (msgId: string) => {
    const idx = messages.findIndex((m) => m.id === msgId)
    if (idx === -1) return
    const msg = messages[idx]
    setInput(msg.content)
    // Remove this message and all messages after it (including the AI response)
    setMessages((prev) => prev.slice(0, idx))
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  /* ───────────── Voice-to-text ───────────── */
  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const W = window as any
    const SpeechRecognitionCtor = W.SpeechRecognition || W.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      alert('Speech recognition not supported in this browser')
      return
    }
    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInput((prev: string) => {
        const base = prev.replace(/\s*\[.*?\]\s*$/, '')
        if (event.results[event.results.length - 1].isFinal) {
          return (base + ' ' + transcript).trim()
        }
        return (base + ' [' + transcript + ']').trim()
      })
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start()
    recognitionRef.current = recognition
    setListening(true)
  }

  /* ───────────── @project detection in input ───────────── */
  const handleInput = (value: string) => {
    setInput(value)
    if (value.endsWith('@') || value.match(/@\S*$/)) {
      const query = value.match(/@(\S*)$/)?.[1]?.toLowerCase() ?? ''
      setProjectFilter(query)
      setShowProjectPicker(true)
    } else {
      setShowProjectPicker(false)
    }
  }

  const selectProjectFromPicker = (p: ProjectOption) => {
    setContextProjectId(p.id)
    setContextProjectName(p.name)
    setInput((prev) => prev.replace(/@\S*$/, '').trim())
    setShowProjectPicker(false)
    inputRef.current?.focus()
  }

  /* ───────────── Drag start ───────────── */
  const onDragStart = (e: React.MouseEvent) => {
    if (isMobileViewport) return
    setDragging(true)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: position.x, origY: position.y }
    e.preventDefault()
  }

  /* ───────────── Asset upload ───────────── */
  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !contextProjectId) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`/api/projects/${contextProjectId}/assets`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.asset?.url) {
        setInput((prev) => (prev ? prev + ' ' : '') + data.asset.url)
      }
    } catch {
      alert('Upload failed')
    }
    e.target.value = ''
  }

  /* ───────────── Key handler ───────────── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  /* ───────────── Derived ───────────── */
  const filteredProjects = projects.filter(
    (p) =>
      String(p.name ?? '').toLowerCase().includes(projectFilter) ||
      String(p.slug ?? '').toLowerCase().includes(projectFilter)
  )
  const lastAssistantMessageId = [...messages].reverse().find((m) => m.role === 'assistant')?.id ?? null
  const currentModel = models.find((m) => m.id === selectedModel)
  const previewUrl = contextProjectId ? `/p/${contextProjectId}?embed=1&t=${previewNonce}` : null
  const isMobileViewport = viewport.width > 0 && viewport.width < 768
  const triggerBottom = isMobileViewport ? 96 : 24
  const triggerRight = isMobileViewport ? 12 : 24
  const dialogInset = isMobileViewport ? 8 : 20
  const dialogWidth = viewport.width > 0 ? Math.min(420, Math.max(280, viewport.width - 16)) : 420
  const dialogHeight = viewport.height > 0 ? Math.min(620, Math.max(360, viewport.height - 16)) : 620

  /* ───────────── Render ───────────── */
  return (
    <>
      {/* ── FLOATING ORB ── */}
      {!embedded && !open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-[9999] w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center transition-transform duration-200 hover:scale-105 focus:outline-none"
          style={{
            right: triggerRight,
            bottom: triggerBottom,
            borderRadius: '50%',
            background: '#000',
            border: '1px solid rgba(255,255,255,0.15)',
            animation: 'cortex-breathe 3s ease-in-out infinite',
          }}
          title="Open Cortex"
        >
          <span
            className="text-white select-none font-bold tracking-widest"
            style={{ fontSize: 8, letterSpacing: '0.2em' }}
          >
            CORTEX
          </span>
        </button>
      )}

      {/* ── DIALOG ── */}
      {(open || embedded) && (
        <div
          className={cn(
            embedded ? 'flex flex-col h-full w-full overflow-hidden' : 'fixed z-[9999] flex flex-col overflow-hidden',
            className,
          )}
          style={embedded ? {
            background: '#000',
          } : {
            width: isMobileViewport ? 'auto' : dialogWidth,
            height: isMobileViewport ? 'auto' : dialogHeight,
            maxHeight: isMobileViewport ? 'none' : dialogHeight,
            left: isMobileViewport ? dialogInset : undefined,
            top: isMobileViewport ? dialogInset : undefined,
            right: isMobileViewport ? dialogInset : Math.max(dialogInset, -position.x),
            bottom: isMobileViewport ? dialogInset : Math.max(dialogInset, -position.y),
            background: '#000',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 32px 64px rgba(0,0,0,0.85)',
          }}
        >
          {/* ── HEADER ── */}
          <div
            className="flex items-center gap-2 px-4 py-3 cursor-move select-none shrink-0"
            onMouseDown={onDragStart}
            style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            {/* Mini orb */}
            <div
              className="w-6 h-6 flex items-center justify-center shrink-0"
              style={{
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 0 8px rgba(255,255,255,0.5)',
              }}
            >
              <Cpu size={11} className="text-black" />
            </div>

            <span className="text-white font-bold text-xs tracking-[0.2em] flex-1 select-none">
              CORTEX
            </span>

            {/* Model picker button */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowModelPicker((v) => !v) }}
              className="flex items-center gap-1 text-white/30 hover:text-white/70 transition px-1.5 py-1"
              title="Switch model"
            >
              <span className="text-[10px] font-mono max-w-[100px] truncate">
                {currentModel?.name ?? selectedModel}
              </span>
              <ChevronDown size={9} />
            </button>

            {/* History */}
            <button
              onClick={() => setView(view === 'history' ? 'chat' : 'history')}
              className="p-1.5 text-white/30 hover:text-white/70 transition"
              title={view === 'history' ? 'Back to chat' : 'History'}
            >
              {view === 'history' ? <ChevronLeft size={14} /> : <Clock size={14} />}
            </button>

            {/* Preview */}
            <button
              onClick={() => setView(view === 'preview' ? 'chat' : 'preview')}
              className={cn('p-1.5 transition', view === 'preview' ? 'text-white' : 'text-white/30 hover:text-white/70')}
              title={view === 'preview' ? 'Back to chat' : 'Project preview'}
            >
              {view === 'preview' ? <ChevronLeft size={14} /> : <ExternalLink size={14} />}
            </button>

            {/* New thread */}
            <button
              onClick={newThread}
              className="p-1.5 text-white/30 hover:text-white/70 transition"
              title="New conversation"
            >
              <Plus size={14} />
            </button>

            {/* Close */}
            {!embedded && (
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 text-white/30 hover:text-white/70 transition"
              title="Close"
            >
              <X size={14} />
            </button>
            )}
          </div>

          {/* ── MODEL PICKER DROPDOWN ── */}
          {showModelPicker && (
            <div
              className="shrink-0 overflow-y-auto max-h-52"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: '#090909' }}
            >
              <div className="px-3 pt-2.5 pb-1 text-[9px] font-mono tracking-[0.25em] text-white/25 uppercase">
                Select Model
              </div>
              {(models.length > 0
                ? models
                : [
                    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast, capable — recommended' },
                    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable' },
                    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Stable, highly capable' },
                    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Stable, fast' },
                    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Lightweight' },
                  ]
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedModel(m.id); setShowModelPicker(false) }}
                  className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-white/5 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/80 font-medium truncate">{m.name}</div>
                    {m.description && (
                      <div className="text-[10px] text-white/25 truncate mt-0.5">{m.description}</div>
                    )}
                  </div>
                  {selectedModel === m.id && (
                    <div className="w-1.5 h-1.5 bg-white shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── CONTEXT BAR ── */}
          {contextProjectId && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 text-xs shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
            >
              <span className="text-white/50 font-mono text-[11px]">@{contextProjectName}</span>
              <button
                onClick={() => { setContextProjectId(null); setContextProjectName(null) }}
                className="ml-auto text-white/25 hover:text-white/60 transition"
                title="Clear context"
              >
                <X size={11} />
              </button>
            </div>
          )}

          {/* ── HISTORY VIEW ── */}
          {view === 'history' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-px">
              <div className="px-2 pt-1 pb-2 text-[9px] font-mono tracking-[0.25em] text-white/20 uppercase">
                Conversations
              </div>
              {threads.length === 0 && (
                <div className="text-xs text-white/20 text-center py-10 font-mono">
                  No conversations yet
                </div>
              )}
              {threads.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    'flex items-center gap-2 px-2 py-2 text-[11px] cursor-pointer transition group font-mono',
                    t.id === threadId
                      ? 'bg-white/10 text-white'
                      : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                  )}
                  onClick={() => loadThread(t.id)}
                >
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-[10px] text-white/20 shrink-0">{t._count.messages}m</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteThread(t.id) }}
                    className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition shrink-0"
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── PREVIEW VIEW ── */}
          {view === 'preview' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="shrink-0 px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/35 font-mono">Live Preview</span>
                <div className="ml-auto flex items-center gap-1.5">
                  {contextProjectId && (
                    <a
                      href={`/p/${contextProjectId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 text-[10px] font-mono text-white/60 hover:text-white transition"
                      style={{ border: '1px solid rgba(255,255,255,0.14)' }}
                      title="Open preview in new tab"
                    >
                      Open
                    </a>
                  )}
                  <button
                    onClick={() => setPreviewNonce(Date.now())}
                    className="px-2 py-1 text-[10px] font-mono text-white/60 hover:text-white transition"
                    style={{ border: '1px solid rgba(255,255,255,0.14)' }}
                    title="Reload iframe preview"
                  >
                    <span className="inline-flex items-center gap-1"><RefreshCw size={11} /> Reload</span>
                  </button>
                </div>
              </div>
              {!previewUrl ? (
                <div className="flex-1 min-h-0 flex items-center justify-center p-5 text-center">
                  <div className="max-w-[280px] space-y-2">
                    <div className="text-white/70 text-sm">No project context selected.</div>
                    <div className="text-white/35 text-xs leading-relaxed">
                      Ask Cortex to create/update an app, or use @project in chat. Then open Preview here without switching to the editor.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 p-2">
                  <iframe
                    key={previewNonce}
                    src={previewUrl}
                    className="w-full h-full"
                    style={{ border: '1px solid rgba(255,255,255,0.12)', background: '#0b0b0b' }}
                    title="Cortex project preview"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── CHAT VIEW ── */}
          {view === 'chat' && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                    <div
                      className="w-12 h-12 flex items-center justify-center shrink-0"
                      style={{
                        borderRadius: '50%',
                        background: '#fff',
                        boxShadow: '0 0 20px rgba(255,255,255,0.25)',
                      }}
                    >
                      <Cpu size={20} className="text-black" />
                    </div>
                    <div>
                      <div className="text-white font-bold text-xs tracking-[0.2em]">CORTEX</div>
                      <div className="text-white/35 text-xs mt-1.5 max-w-[260px] leading-relaxed">
                        Your AI co-builder. Tell me what to build, use{' '}
                        <span className="text-white/60 font-mono">@project</span> to switch context.
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 w-full max-w-[320px]">
                      {[
                        'Create a CRM app',
                        'Build a dashboard',
                        'Add a login screen',
                        'Design a data table',
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => { void sendMessage(q) }}
                          className="text-[11px] px-3 py-2 text-white/35 hover:text-white/70 hover:bg-white/5 transition text-left font-mono"
                          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg) => (
                  <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {msg.role === 'system' ? (
                      <div className="text-[11px] text-white/25 italic text-center w-full py-1 font-mono">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="group relative max-w-[85%]">
                        <div
                          className={cn(
                            'px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap',
                            msg.role === 'user'
                              ? 'bg-white text-black font-medium'
                              : 'text-white/75'
                          )}
                          style={
                            msg.role === 'assistant'
                              ? {
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  background: 'rgba(255,255,255,0.04)',
                                }
                              : undefined
                          }
                        >
                          {formatMessage(msg.content)}
                        </div>
                        {msg.role === 'assistant' && (
                          <div className="mt-2">
                            <details className="text-[10px] font-mono text-white/45">
                              <summary className="cursor-pointer select-none hover:text-white/65 transition">
                                Debug trace
                              </summary>
                              {(() => {
                                const debug = msg.metadata?.debugTrace
                                const audit = msg.metadata?.auditArtifact
                                const parsed = parseAssistantJson(msg.content)
                                const actionTypes = debug?.parsedActionTypes ?? parsed?.actions?.map((a) => a.type) ?? []
                                if (!debug && actionTypes.length === 0 && !audit) {
                                  return (
                                    <div className="mt-1.5 text-white/30">No debug data captured for this response.</div>
                                  )
                                }
                                return (
                                  <div className="mt-1.5 space-y-1.5 break-words">
                                    {debug?.model && <div>model: {debug.model}</div>}
                                    {debug?.parseMode && <div>parse: {debug.parseMode}</div>}
                                    {debug?.parseError && <div className="text-red-300/80">parseError: {debug.parseError}</div>}
                                    <div>actions: {actionTypes.length > 0 ? actionTypes.join(', ') : 'none'}</div>
                                    {debug && <div>failedActions: {debug.failedActionCount}</div>}
                                    {debug && debug.failedActions.length > 0 && (
                                      <div className="text-red-300/80">
                                        failures: {debug.failedActions.map((f) => `${f.type}${f.error ? ` (${f.error})` : ''}`).join('; ')}
                                      </div>
                                    )}
                                    {debug?.userPrompt && (
                                      <div>
                                        <div className="text-white/35">prompt</div>
                                        <pre className="whitespace-pre-wrap text-[10px] text-white/50">{debug.userPrompt}</pre>
                                      </div>
                                    )}
                                    {debug?.rawOutputPreview && (
                                      <div>
                                        <div className="text-white/35">raw model output</div>
                                        <pre className="whitespace-pre-wrap text-[10px] text-white/50">{debug.rawOutputPreview}</pre>
                                      </div>
                                    )}
                                    {audit?.runId && (
                                      <div className="pt-1 space-y-1">
                                        <div className="text-white/35">audit artifact</div>
                                        <div className="text-[10px] text-white/50">runId: {audit.runId}</div>
                                        {debug?.auditFile && <div className="text-[10px] text-white/35">server file: {debug.auditFile}</div>}
                                        <button
                                          onClick={() => downloadAuditArtifact(audit)}
                                          className="text-[10px] px-2 py-1 text-black bg-white hover:bg-white/90 transition"
                                          title="Download full Cortex audit JSON"
                                        >
                                          Export audit JSON
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </details>
                          </div>
                        )}
                        {msg.role === 'assistant' && (() => {
                          const actionResults = msg.metadata?.actionResults ?? []
                          const parsedActions = parseActionsFromMessage(msg.content)
                          const createdScreens = actionResults.filter((result) => result.success && result.type === 'create_screen' && result.data?.screenId)
                          const updatedScreens = actionResults.filter((result) => result.success && result.type === 'update_screen' && result.data?.screenId)
                          const successfulActions = actionResults.filter((result) => result.success)
                          const hasScreenWork = createdScreens.length > 0 || updatedScreens.length > 0 || parsedActions.some((action) => action.type === 'create_screen' || action.type === 'update_screen')
                          const hasRefreshableWork = successfulActions.some((result) => (
                            result.type === 'create_project'
                            || result.type === 'create_screen'
                            || result.type === 'update_screen'
                            || result.type === 'update_globals'
                            || result.type === 'create_table'
                            || result.type === 'create_api_source'
                          ))
                          if (!hasScreenWork && !hasRefreshableWork && !contextProjectId) return null
                          return (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {createdScreens.map((result, index) => {
                                const screenId = typeof result.data?.screenId === 'string' ? result.data.screenId : null
                                if (!screenId) return null
                                const label = typeof result.data?.name === 'string' && result.data.name.trim()
                                  ? `Open ${result.data.name}`
                                  : `Open screen ${index + 1}`
                                return (
                                  <button
                                    key={`${msg.id}-screen-${screenId}`}
                                    type="button"
                                    onClick={() => window.dispatchEvent(new CustomEvent('cortex:navigate-screen', { detail: { screenId } }))}
                                    className="px-2.5 py-1 text-[10px] font-mono text-white/70 hover:text-white transition"
                                    style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
                                  >
                                    {label}
                                  </button>
                                )
                              })}
                              {hasRefreshableWork && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewNonce(Date.now())
                                    window.dispatchEvent(new CustomEvent('cortex:refresh'))
                                  }}
                                  className="px-2.5 py-1 text-[10px] font-mono text-white/70 hover:text-white transition"
                                  style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
                                >
                                  Refresh editor
                                </button>
                              )}
                              {contextProjectId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewNonce(Date.now())
                                    setView('preview')
                                  }}
                                  className="px-2.5 py-1 text-[10px] font-mono text-white/70 hover:text-white transition"
                                  style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
                                >
                                  Open preview
                                </button>
                              )}
                            </div>
                          )
                        })()}
                        {msg.role === 'assistant' && msg.id === lastAssistantMessageId && previewUrl && (
                          <div className="mt-2.5">
                            <div
                              className="p-2"
                              style={{
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: 'rgba(255,255,255,0.03)',
                              }}
                            >
                              <div className="mb-1.5 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/45">Desktop Preview</span>
                                <button
                                  onClick={() => setPreviewNonce(Date.now())}
                                  className="text-[10px] font-mono text-white/45 hover:text-white/75 transition"
                                  title="Reload preview"
                                >
                                  Reload
                                </button>
                              </div>
                              <div className="w-full overflow-hidden" style={{ aspectRatio: '16 / 9', border: '1px solid rgba(255,255,255,0.12)', background: '#0b0b0b' }}>
                                <iframe
                                  key={`inline-${previewNonce}`}
                                  src={previewUrl}
                                  title="Inline desktop preview"
                                  className="w-full h-full"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        {msg.role === 'user' && !loading && (
                          <button
                            onClick={() => editMessage(msg.id)}
                            className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-white/70"
                            title="Edit & resend"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div
                      className="px-4 py-3.5 space-y-2 max-w-[85%]"
                      style={{
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.04)',
                      }}
                    >
                      {/* Thinking step */}
                      {thinkingStep && (
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-indigo-400/70 animate-pulse rounded-full shrink-0" />
                          <span className="text-[11px] text-white/40 font-mono italic truncate">{thinkingStep}</span>
                        </div>
                      )}
                      {/* Action progress */}
                      {streamingActions.length > 0 && (
                        <div className="space-y-0.5">
                          {streamingActions.map((a, i) => {
                            const detail = renderActionDetail(a)
                            return (
                              <div key={i} className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  {a.status === 'running' ? (
                                    <div className="w-1 h-1 bg-amber-400/60 animate-ping rounded-full shrink-0" />
                                  ) : (
                                    <div className={`w-1 h-1 rounded-full shrink-0 ${a.ok ? 'bg-emerald-400/70' : 'bg-red-400/70'}`} />
                                  )}
                                  <span className="text-[10px] font-mono text-white/35">{formatActionLabel(a.type)}</span>
                                </div>
                                {detail && (
                                  <div className="pl-3 text-[10px] font-mono text-white/45 break-words">
                                    {detail}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {/* Fallback dots when nothing to show yet */}
                      {!thinkingStep && streamingActions.length === 0 && (
                        <div className="flex gap-1.5 items-center">
                          <div className="w-1.5 h-1.5 bg-white/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* ── PROJECT PICKER DROPDOWN ── */}
              {showProjectPicker && filteredProjects.length > 0 && (
                <div
                  className="mx-3 mb-1 overflow-y-auto max-h-28"
                  style={{
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: '#090909',
                  }}
                >
                  {filteredProjects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => selectProjectFromPicker(p)}
                      className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-white/5 text-white/50 hover:text-white transition flex items-center gap-2 font-mono"
                    >
                      <span className="text-white/25">@</span>
                      {p.name}
                    </button>
                  ))}
                </div>
              )}

              {/* ── INPUT BAR ── */}
              <div
                className="p-3 shrink-0"
                style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
              >
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => handleInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        contextProjectId
                          ? `Message about ${contextProjectName}...`
                          : 'Ask Cortex... (use @ for project context)'
                      }
                      rows={1}
                      className="w-full resize-none text-sm text-white px-3 py-2.5 focus:outline-none transition placeholder:text-white/20 bg-transparent font-mono text-[12px]"
                      style={{
                        maxHeight: 120,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.03)',
                      }}
                      onInput={(e) => {
                        const ta = e.currentTarget
                        ta.style.height = 'auto'
                        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
                      }}
                    />
                  </div>

                  {/* Voice */}
                  <button
                    onClick={toggleVoice}
                    className={cn(
                      'shrink-0 w-9 h-9 flex items-center justify-center transition',
                      listening ? 'bg-white text-black' : 'text-white/30 hover:text-white/70'
                    )}
                    style={{
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: listening ? '#fff' : 'rgba(255,255,255,0.03)',
                    }}
                    title={listening ? 'Stop recording' : 'Voice input'}
                  >
                    {listening ? <MicOff size={14} className="text-black" /> : <Mic size={14} />}
                  </button>

                  {/* Asset upload */}
                  {contextProjectId && (
                    <label
                      className="shrink-0 w-9 h-9 flex items-center justify-center text-white/30 hover:text-white/70 cursor-pointer transition"
                      style={{
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.03)',
                      }}
                      title="Upload asset"
                    >
                      <Paperclip size={14} />
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleAssetUpload}
                        accept="image/*,audio/*,video/*,.pdf,.json,.css,.js"
                      />
                    </label>
                  )}

                  {/* Send / Stop */}
                  {loading ? (
                    <button
                      onClick={stopGeneration}
                      className="shrink-0 w-9 h-9 flex items-center justify-center transition bg-red-500/80 text-white hover:bg-red-500"
                      title="Stop generating"
                    >
                      <Square size={13} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      onClick={() => { void sendMessage() }}
                      disabled={!input.trim()}
                      className={cn(
                        'shrink-0 w-9 h-9 flex items-center justify-center transition',
                        input.trim()
                          ? 'bg-white text-black hover:bg-white/90'
                          : 'text-white/15 cursor-not-allowed'
                      )}
                      style={
                        !input.trim()
                          ? {
                              border: '1px solid rgba(255,255,255,0.07)',
                              background: 'rgba(255,255,255,0.02)',
                            }
                          : undefined
                      }
                      title="Send"
                    >
                      <ArrowUp size={15} />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ANIMATIONS ── */}
      <style jsx global>{`
        @keyframes cortex-breathe {
          0%, 100% {
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08),
                        0 0 16px rgba(255, 255, 255, 0.12),
                        0 4px 20px rgba(0, 0, 0, 0.6);
          }
          50% {
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.16),
                        0 0 28px rgba(255, 255, 255, 0.2),
                        0 4px 24px rgba(0, 0, 0, 0.7);
          }
        }
      `}</style>
    </>
  )
}

/* ───────────── Simple markdown-ish renderer ───────────── */

/** Extract human-readable text from a message.
 *  Assistant messages stored in DB are JSON — `{"message":"...", "actions":[...]}`
 *  We need to show only the `message` field, not the raw JSON. */
function extractDisplayText(raw: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed.message === 'string') {
        const follow = parsed.followUp ? `\n\n*${parsed.followUp}*` : ''
        return parsed.message + follow
      }
      // Export format from DB — shouldn't happen but handle gracefully
      if (parsed.exportVersion || parsed.screens) {
        return 'Built screens for your app.'
      }
    } catch { /* not valid JSON, fall through */ }
  }
  // Strip any JSON blocks or code fences that leaked into the display text
  let cleaned = raw
    .replace(/```(?:json)?\s*[\s\S]*?```/g, '')
    .replace(/```(?:json)?\s*[\s\S]*/g, '')
    .replace(/\{[\s\S]*?"(?:exportVersion|screens|actions)"\s*:[\s\S]*$/g, '')
    .trim()
  return cleaned || raw
}

function formatMessage(text: string): React.ReactNode {
  const display = extractDisplayText(text)
  if (!display) return null
  const parts = display.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="text-[11px] px-1 py-0.5 font-mono"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={i} className="text-white/40">
          {part.slice(1, -1)}
        </em>
      )
    }
    return <span key={i}>{part}</span>
  })
}
