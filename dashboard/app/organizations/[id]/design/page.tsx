/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import {
  Sparkles, ArrowRight, Paintbrush, Hammer, Image, Wand2,
  Clock, Loader2, CheckCircle2, XCircle, ChevronRight, Square,
  MessageSquare, Trash2, ArrowUp,
} from 'lucide-react'
import { LoadingBar } from '@/components/ui/loading-bar'
import { useState, useRef, useEffect, useCallback } from 'react'

/* ───────────── Types ───────────── */
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

type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  actionResults?: ActionResult[]
  createdAt: string
}

type ThreadSummary = {
  id: string
  title: string
  projectId: string | null
  updatedAt: string
  _count: { messages: number }
}

function formatActionLabel(type: string): string {
  return type.replace(/_/g, ' ')
}

function parseStoredAssistantContent(content: string): { text: string; actionResults?: ActionResult[] } {
  try {
    const parsed = JSON.parse(content) as {
      message?: string
      followUp?: string | null
      actions?: unknown[]
      actionResults?: ActionResult[]
    }
    const message = typeof parsed.message === 'string' ? parsed.message : ''
    const followUp = typeof parsed.followUp === 'string' && parsed.followUp.trim().length > 0
      ? parsed.followUp.trim()
      : ''
    const text = followUp ? `${message}\n\n*${followUp}*` : message
    return { text: text || content, actionResults: Array.isArray(parsed.actionResults) ? parsed.actionResults : undefined }
  } catch {
    return { text: content }
  }
}

export default function DesignPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.id as string
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinkingStep, setThinkingStep] = useState('')
  const [streamingActions, setStreamingActions] = useState<StreamingAction[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [designProjectId, setDesignProjectId] = useState<string | null>(null)
  const [threads, setThreads] = useState<ThreadSummary[]>([])
    const [designFirstScreenId, setDesignFirstScreenId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: orgData, isLoading } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      const res = await axios.get(`/api/organizations/${orgId}`)
      return res.data
    },
  })

  const org = orgData?.organization

  // Fetch threads for this org
  const fetchThreads = useCallback(async () => {
    try {
      const res = await axios.get(`/api/cortex/threads?organizationId=${orgId}`)
      setThreads(res.data.threads ?? [])
    } catch { /* ignore */ }
  }, [orgId])

  useEffect(() => { fetchThreads() }, [fetchThreads])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinkingStep])

  // Load thread messages
  const loadThread = useCallback(async (id: string) => {
    setThreadId(id)
    setMessages([])
    setStreamingActions([])
    setDesignProjectId(null)
    setDesignFirstScreenId(null)
    try {
      const res = await axios.get(`/api/cortex/threads/${id}/messages`)
      // Restore designProjectId from the thread's stored projectId
      const thread = threads.find(t => t.id === id)
      if (thread?.projectId) setDesignProjectId(thread.projectId)
      const msgs = (res.data.messages ?? []).map((m: {
        id: string
        role: string
        content: string
        metadata?: { actionResults?: ActionResult[] }
        createdAt: string
      }) => {
        if (m.role === 'assistant') {
          const parsed = parseStoredAssistantContent(m.content)
          return {
            id: m.id,
            role: m.role as ChatMessage['role'],
            content: parsed.text,
            actionResults: parsed.actionResults ?? (Array.isArray(m.metadata?.actionResults) ? m.metadata?.actionResults : undefined),
            createdAt: m.createdAt,
          }
        }
        return {
          id: m.id,
          role: m.role as ChatMessage['role'],
          content: m.content,
          createdAt: m.createdAt,
        }
      })
      setMessages(msgs)
    } catch { /* ignore */ }
  }, [threads])

  // New conversation
  const startNew = () => {
    setThreadId(null)
    setMessages([])
    setStreamingActions([])
    setPrompt('')
    setThinkingStep('')
    setDesignProjectId(null)
    setDesignFirstScreenId(null)
  }

  // Delete thread
  const deleteThread = async (id: string) => {
    try {
      await axios.delete(`/api/cortex/threads?threadId=${id}`)
      if (threadId === id) startNew()
      fetchThreads()
    } catch { /* ignore */ }
  }

  // Stop generation
  const stopGeneration = () => {
    abortRef.current?.abort()
    setLoading(false)
    setThinkingStep('')
  }

  // Send message
  const send = async (text?: string) => {
    const msg = (text ?? prompt).trim()
    if (!msg || loading) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: msg,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setPrompt('')
    setLoading(true)
    setThinkingStep('Connecting...')
    setStreamingActions([])

    try {
      const controller = new AbortController()
      abortRef.current = controller
      const res = await fetch('/api/cortex/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          threadId,
          organizationId: orgId,
          projectId: null,
          mode: 'design',
          model: 'gemini-2.5-flash',
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const errMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: res.status === 429
            ? 'Slow down — too many messages. Wait a moment and try again.'
            : `Error ${res.status}: ${errData.error ?? 'Request failed'}`,
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errMsg])
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let finalActionResults: ActionResult[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()!

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
              const next = [...prev]
              const val = { type: actionType, status: 'done' as const, ok: (evt.ok as boolean) ?? true, result: evt.result as ActionResult | undefined }
              if (existing !== -1) next[existing] = val
              else next.push(val)
              return next
            })
          } else if (evt.type === 'message') {
            const msgText = (evt.text as string) ?? ''
            const followUp = evt.followUp as string | undefined
            const newThreadId = evt.threadId as string | undefined
            if (newThreadId) setThreadId(newThreadId)
            const display = followUp ? `${msgText}\n\n*${followUp}*` : msgText
            const asstMsg: ChatMessage = {
              id: `asst-${Date.now()}`,
              role: 'assistant',
              content: display,
              createdAt: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, asstMsg])
          } else if (evt.type === 'done') {
            finalActionResults = (evt.actionResults as ActionResult[]) ?? []
            if (evt.threadId) setThreadId(evt.threadId as string)
            if (evt.projectId) setDesignProjectId(evt.projectId as string)
                        // Set the first generated screen ID for direct canvas navigation
                        const firstScreenResult = finalActionResults.find(
                          r => r.type === 'create_screen' && r.success && (r.data as any)?.screenId
                        )
                        if (firstScreenResult) setDesignFirstScreenId((firstScreenResult.data as any).screenId as string)
            fetchThreads()
            // Attach action results to last assistant message
            if (finalActionResults.length > 0) {
              setMessages((prev) => {
                const next = [...prev]
                for (let i = next.length - 1; i >= 0; i--) {
                  if (next[i].role === 'assistant') {
                    next[i] = { ...next[i], actionResults: finalActionResults }
                    break
                  }
                }
                return next
              })
            }
            // Dispatch refresh for builder if open
            window.dispatchEvent(new CustomEvent('cortex:refresh'))
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Connection lost. Please try again.',
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setLoading(false)
      setThinkingStep('')
      abortRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const hasConversation = messages.length > 0
  const activeThread = threadId ? threads.find((t) => t.id === threadId) : null

  const getProjectScreensHref = (): string | null => {
    const targetProjectId = designProjectId ?? activeThread?.projectId ?? null
    return targetProjectId ? `/organizations/${orgId}/projects/${targetProjectId}/screens` : null
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingBar fullPage />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-white dark:bg-[#0d1117] flex flex-col">
        {/* Breadcrumb + Mode Switch */}
        <div className="pt-20 px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between mb-8">
            <Breadcrumb
              items={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: org?.name || 'Organization', href: `/organizations/${orgId}` },
                { label: 'Design' },
              ]}
            />
            <div className="inline-flex items-center bg-gray-100 dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-0.5 gap-0.5">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black shadow-sm">
                <Paintbrush size={13} />
                Design
              </span>
              <a
                href={`${typeof window !== 'undefined' && window.location.hostname === 'localhost' ? '' : 'https://dccortex.com'}/organizations/${orgId}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <Hammer size={13} />
                Build
              </a>
            </div>
          </div>
        </div>

        {/* Main content area — grows to fill */}
        <div className="flex-1 flex flex-col">
          {!hasConversation ? (
            /* ── Empty state: hero prompt ── */
            <>
              <section className="px-6 lg:px-8 max-w-4xl mx-auto pt-8 pb-12 w-full">
                <div className="text-center mb-10">
                  <h1 className="text-4xl md:text-5xl font-medium tracking-tighter text-black dark:text-white mb-4 leading-[0.95]">
                    What do you want to design?
                  </h1>
                  <p className="text-lg text-gray-500 dark:text-gray-400 font-light max-w-lg mx-auto">
                    Describe your idea and Cortex will generate a multi-screen app.
                  </p>
                </div>

                {/* Prompt Input */}
                <div className="relative mb-6">
                  <div className="flex items-start gap-3 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-4 focus-within:border-black dark:focus-within:border-white transition-colors">
                    <Sparkles size={20} className="text-gray-400 mt-1 flex-shrink-0" />
                    <textarea
                      ref={textareaRef}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="A fitness tracker with dashboard, workout log, leaderboard, and profile screens..."
                      rows={3}
                      className="flex-1 bg-transparent text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-base resize-none focus:outline-none leading-relaxed"
                    />
                    <button
                      onClick={() => send()}
                      disabled={!prompt.trim() || loading}
                      className="self-end px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:bg-gray-900 dark:hover:bg-gray-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : 'Generate'}
                      {!loading && <ArrowRight size={16} />}
                    </button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 justify-center mb-16">
                  {[
                    { icon: Image, label: 'From screenshot' },
                    { icon: Wand2, label: 'From template' },
                  ].map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#30363d] hover:border-gray-400 dark:hover:border-gray-500 hover:text-black dark:hover:text-white transition-all"
                    >
                      <Icon size={15} />
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Recent Threads */}
              <section className="px-6 lg:px-8 max-w-7xl mx-auto pb-24 w-full">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-medium tracking-tighter text-black dark:text-white mb-1">
                      Recent designs
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 font-light text-sm">
                      Your design conversations in {org?.name}
                    </p>
                  </div>
                </div>

                {threads.length === 0 ? (
                  <div className="border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] p-16 text-center">
                    <div className="w-14 h-14 mx-auto mb-5 bg-gray-100 dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] flex items-center justify-center">
                      <Paintbrush size={24} className="text-gray-400" />
                    </div>
                    <h3 className="text-xl font-medium text-black dark:text-white mb-2 tracking-tight">No designs yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 font-light max-w-sm mx-auto mb-6">
                      Describe what you want to build above, or start from a screenshot or template.
                    </p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {threads.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => loadThread(t.id)}
                        className="group text-left border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] p-5 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <MessageSquare size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteThread(t.id) }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1 -m-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <h3 className="text-sm font-medium text-black dark:text-white mb-1 line-clamp-2">{t.title}</h3>
                        <p className="text-xs text-gray-400">
                          {t._count.messages} message{t._count.messages !== 1 ? 's' : ''} · {new Date(t.updatedAt).toLocaleDateString()}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            /* ── Active conversation ── */
            <>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-4">
                <div className="max-w-4xl mx-auto space-y-6 pt-4">
                  {/* New conversation button */}
                  <div className="flex justify-end gap-2">
                    {(designFirstScreenId && (designProjectId || activeThread?.projectId)) ? (
                      <Link
                        href={`/organizations/${orgId}/projects/${designProjectId ?? activeThread?.projectId}/screens/${designFirstScreenId}/edit`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-colors"
                      >
                        Open canvas
                        <ChevronRight size={12} />
                      </Link>
                    ) : (designProjectId || activeThread?.projectId) ? (
                      <Link
                        href={`/organizations/${orgId}/projects/${designProjectId ?? activeThread?.projectId}/screens`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-colors"
                      >
                        Open screens
                        <ChevronRight size={12} />
                      </Link>
                    ) : null}
                    <button
                      onClick={startNew}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#30363d] hover:text-black dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                    >
                      New design
                      <ChevronRight size={12} />
                    </button>
                  </div>

                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] ${
                        msg.role === 'user'
                          ? 'bg-black dark:bg-white text-white dark:text-black px-5 py-3'
                          : msg.role === 'system'
                            ? 'bg-gray-100 dark:bg-[#161b22] text-gray-500 dark:text-gray-400 px-4 py-2 text-sm italic'
                            : 'bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] px-5 py-4'
                      }`}>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </div>
                        {/* Action results */}
                        {msg.actionResults && msg.actionResults.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#30363d] space-y-1.5">
                            {msg.actionResults.map((ar, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                {ar.success ? (
                                  <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                                ) : (
                                  <XCircle size={13} className="text-red-500 flex-shrink-0" />
                                )}
                                <span className="text-gray-600 dark:text-gray-300 capitalize">{formatActionLabel(ar.type)}</span>
                                {getProjectScreensHref() ? (
                                  <Link
                                    href={getProjectScreensHref() as string}
                                    className="ml-auto text-xs font-medium text-black dark:text-white hover:underline inline-flex items-center gap-1"
                                  >
                                    Open screens <ChevronRight size={11} />
                                  </Link>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Streaming progress */}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] px-5 py-4 max-w-[85%]">
                        {/* Thinking indicator */}
                        {thinkingStep && (
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                            <Loader2 size={14} className="animate-spin flex-shrink-0" />
                            {thinkingStep}
                          </div>
                        )}
                        {/* Streaming actions */}
                        {streamingActions.length > 0 && (
                          <div className="space-y-1.5">
                            {streamingActions.map((action, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                {action.status === 'running' ? (
                                  <Loader2 size={13} className="animate-spin text-gray-400 flex-shrink-0" />
                                ) : action.ok ? (
                                  <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                                ) : (
                                  <XCircle size={13} className="text-red-500 flex-shrink-0" />
                                )}
                                <span className="text-gray-600 dark:text-gray-300 capitalize">{formatActionLabel(action.type)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input bar — pinned to bottom */}
              <div className="border-t border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#0d1117] px-6 lg:px-8 py-4">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-end gap-3 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-3 focus-within:border-black dark:focus-within:border-white transition-colors">
                    <textarea
                      ref={textareaRef}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Describe changes or ask a follow-up..."
                      rows={1}
                      className="flex-1 bg-transparent text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm resize-none focus:outline-none leading-relaxed min-h-[36px] max-h-[120px]"
                      style={{ height: 'auto', overflow: 'hidden' }}
                      onInput={(e) => {
                        const el = e.currentTarget
                        el.style.height = 'auto'
                        el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                      }}
                    />
                    {loading ? (
                      <button
                        onClick={stopGeneration}
                        className="px-3 py-2 bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-1.5"
                      >
                        <Square size={14} />
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => send()}
                        disabled={!prompt.trim()}
                        className="px-3 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:bg-gray-900 dark:hover:bg-gray-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
