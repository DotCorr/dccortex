/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import { Database, Table, Plus, Upload, Trash2, ChevronRight, Globe, Layout, Zap, ClipboardCheck, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, RefreshCw, Image, Webhook, Settings2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingBar } from '@/components/ui/loading-bar'
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const COLUMN_TYPES = ['text', 'number', 'date', 'boolean', 'email', 'url', 'json'] as const
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
const AUTH_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer token' },
  { value: 'basic', label: 'Basic auth (user:pass)' },
  { value: 'apiKey', label: 'API key header' },
] as const

type ApiSource = {
  id: string
  name: string
  url: string
  method: string
  headers: Record<string, string> | null
  body: string | null
  authType: string
  authValue: string | null
  authHeader: string | null
  schema: Array<{ name: string; type: string }> | null
  urlParams: Array<{ name: string; defaultValue?: string; description?: string }> | null
}

type ProjectAsset = { id: string; name: string; url: string; mimetype: string; size: number; createdAt: string }

type ProjectWebhook = {
  id: string
  name: string
  url: string
  events: string[]
  secret: string | null
  active: boolean
  createdAt: string
}

function RestApiTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newSourceOpen, setNewSourceOpen] = useState(false)
  const [newSourceName, setNewSourceName] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [testResult, setTestResult] = useState<{
    status?: number; statusText?: string; data?: unknown; rawText?: string; schema?: Array<{name:string;type:string}> | null; error?: string
  } | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [form, setForm] = useState<Partial<ApiSource>>({
    url: '', method: 'GET', headers: {}, authType: 'none', authValue: '', authHeader: 'X-Api-Key', body: ''
  })
  const [headersText, setHeadersText] = useState('{}')
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [urlParamDefs, setUrlParamDefs] = useState<Array<{name: string; defaultValue: string; description: string}>>([])  

  const { data: sourcesData, isLoading } = useQuery({
    queryKey: ['api-sources', projectId],
    queryFn: async () => {
      const res = await axios.get(`/api/projects/${projectId}/api-sources`)
      return res.data
    },
  })
  const sources: ApiSource[] = sourcesData?.sources ?? []

  const selectedSource = sources.find(s => s.id === selectedId) ?? null

  useEffect(() => {
    if (selectedSource) {
      setForm({
        url: selectedSource.url,
        method: selectedSource.method,
        headers: selectedSource.headers ?? {},
        authType: selectedSource.authType,
        authValue: selectedSource.authValue ?? '',
        authHeader: selectedSource.authHeader ?? 'X-Api-Key',
        body: selectedSource.body ?? '',
      })
      setHeadersText(JSON.stringify(selectedSource.headers ?? {}, null, 2))
      setUrlParamDefs((selectedSource.urlParams ?? []).map(p => ({ name: p.name, defaultValue: p.defaultValue ?? '', description: p.description ?? '' })))
      setTestResult(null)
    }
  }, [selectedId, selectedSource?.id])

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await axios.post(`/api/projects/${projectId}/api-sources`, { name, url: '', method: 'GET' })
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-sources', projectId] })
      setNewSourceOpen(false)
      setNewSourceName('')
      setSelectedId(data.source.id)
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsedHeaders: Record<string, string> = {}
      try { parsedHeaders = JSON.parse(headersText) } catch { parsedHeaders = {} }
      const res = await axios.patch(`/api/projects/${projectId}/api-sources/${selectedId}`, {
        ...form,
        headers: parsedHeaders,
        schema: testResult?.schema ?? selectedSource?.schema ?? null,
        urlParams: urlParamDefs.filter(p => p.name.trim()),
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-sources', projectId] })
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(null), 2000)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/projects/${projectId}/api-sources/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-sources', projectId] })
      setSelectedId(null)
      setTestResult(null)
    },
  })

  const handleTest = async () => {
    setTestLoading(true)
    setTestResult(null)
    try {
      let parsedHeaders: Record<string, string> = {}
      try { parsedHeaders = JSON.parse(headersText) } catch { parsedHeaders = {} }
      const res = await axios.post(`/api/projects/${projectId}/api-sources/test`, {
        url: form.url,
        method: form.method,
        headers: parsedHeaders,
        body: form.body,
        authType: form.authType,
        authValue: form.authValue,
        authHeader: form.authHeader,
      })
      setTestResult(res.data)
    } catch (e: unknown) {
      const msg = (e as any)?.response?.data?.error ?? (e as Error)?.message ?? 'Request failed'
      setTestResult({ error: msg })
    }
    setTestLoading(false)
  }

  if (isLoading) return <div className="p-4 text-sm text-gray-400">Loading…</div>

  return (
    <div className="flex flex-col lg:flex-row gap-0 h-full min-h-0">
      {/* Source list */}
      <div className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--border)] flex flex-col max-h-52 lg:max-h-none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">API Sources</span>
          <button type="button" onClick={() => setNewSourceOpen(true)} className="p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-auto py-2 space-y-0.5 px-2">
          {sources.length === 0 && (
            <div className="text-xs text-[var(--muted-foreground)] px-2 py-4 text-center">No API sources yet.<br/>Create one to fetch external data.</div>
          )}
          {sources.map(s => (
            <button key={s.id} type="button" onClick={() => setSelectedId(s.id)}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${selectedId === s.id ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'hover:bg-[var(--muted)] text-[var(--foreground)]'}`}>
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{s.name}</span>
              <span className={`ml-auto text-[10px] px-1 rounded font-mono ${selectedId === s.id ? 'bg-white/20' : 'bg-[var(--muted)]'}`}>{s.method}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 flex flex-col overflow-auto">
        {!selectedSource ? (
          <div className="flex-1 flex items-center justify-center text-[var(--muted-foreground)] text-sm">
            Select a source or create one
          </div>
        ) : (
          <div className="p-3 sm:p-6 space-y-5 max-w-3xl">
            <div className="sticky top-0 z-20 bg-[var(--background)]/95 backdrop-blur border-b border-[var(--border)] -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
              <h2 className="font-semibold text-[var(--foreground)]">{selectedSource.name}</h2>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-gray-400 italic self-center w-full sm:w-auto">{saveMsg ?? `Use {{data.${selectedSource.name}}} for full payload or {{data.${selectedSource.name}.current.temperature_2m}} for nested fields.`}</span>
                <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black rounded hover:opacity-80 disabled:opacity-50">
                  {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Save
                </button>
                <button type="button" onClick={() => deleteMutation.mutate(selectedSource.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-300 dark:border-red-700 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </div>

            {/* URL + Method */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Endpoint</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select value={form.method ?? 'GET'} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                  className="px-2 py-1.5 text-sm border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] rounded font-mono w-24">
                  {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input type="url" value={form.url ?? ''} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://api.example.com/data"
                  className="flex-1 px-3 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)] font-mono" />
              </div>
            </div>

            {/* Auth */}
            <div className="space-y-2">
              <button type="button" onClick={() => setShowAuth(v => !v)} className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                {showAuth ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                Auth {form.authType !== 'none' && <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px]">{form.authType}</span>}
              </button>
              {showAuth && (
                <div className="space-y-2 pl-2 border-l-2 border-[var(--border)]">
                  <select value={form.authType ?? 'none'} onChange={e => setForm(f => ({ ...f, authType: e.target.value }))}
                    className="w-full px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)]">
                    {AUTH_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                  {form.authType !== 'none' && (
                    <>
                      <input type="password" value={form.authValue ?? ''} onChange={e => setForm(f => ({ ...f, authValue: e.target.value }))}
                        placeholder={form.authType === 'basic' ? 'username:password' : form.authType === 'apiKey' ? 'API key value' : 'Bearer token'}
                        className="w-full px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)] font-mono" />
                      <p className="text-[10px] text-[var(--muted-foreground)]">Tip: use <code className="bg-[var(--muted)] px-1">{'{{env.MY_API_KEY}}'}</code> to read secrets from server environment variables.</p>
                      {form.authType === 'apiKey' && (
                        <input type="text" value={form.authHeader ?? 'X-Api-Key'} onChange={e => setForm(f => ({ ...f, authHeader: e.target.value }))}
                          placeholder="Header name, e.g. X-Api-Key"
                          className="w-full px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)] font-mono" />
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* URL Params */}
            {(() => {
              // detect {{name}} placeholders in the URL
              const detected = Array.from((form.url ?? '').matchAll(/\{\{(\w+)\}\}/g)).map(m => m[1])
              const detectedSet = new Set(detected)
              return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide flex items-center gap-1.5">
                    <Settings2 className="h-3.5 w-3.5" />
                    URL Parameters
                    {detected.length > 0 && (
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px]">{detected.length} detected</span>
                    )}
                  </label>
                  <button type="button" onClick={() => setUrlParamDefs(d => [...d, {name: '', defaultValue: '', description: ''}])}
                    className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1">
                    <Plus className="h-3 w-3" />Add
                  </button>
                </div>
                {detected.length > 0 && (
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    Use <code className="bg-[var(--muted)] px-1">{'{{paramName}}'}</code> in the URL above. Set default values below — these resolve at runtime unless overridden by state bindings.
                  </p>
                )}
                <p className="text-[10px] text-[var(--muted-foreground)]">You can also use env placeholders in URL/params/headers/body, e.g. <code className="bg-[var(--muted)] px-1">{'{{env.MY_REGION}}'}</code>.</p>
                {urlParamDefs.length > 0 && (
                  <div className="space-y-1.5">
                    {urlParamDefs.map((p, i) => (
                      <div key={i} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                        <input type="text" value={p.name} onChange={e => setUrlParamDefs(d => d.map((x, j) => j===i ? {...x, name: e.target.value} : x))}
                          placeholder="paramName"
                          className={`w-full sm:w-28 px-2 py-1 text-xs border font-mono bg-[var(--background)] text-[var(--foreground)] ${detectedSet.has(p.name) ? 'border-blue-400 dark:border-blue-600' : 'border-[var(--border)]'}`} />
                        <input type="text" value={p.defaultValue} onChange={e => setUrlParamDefs(d => d.map((x, j) => j===i ? {...x, defaultValue: e.target.value} : x))}
                          placeholder="default value"
                          className="flex-1 px-2 py-1 text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]" />
                        <input type="text" value={p.description} onChange={e => setUrlParamDefs(d => d.map((x, j) => j===i ? {...x, description: e.target.value} : x))}
                          placeholder="description (optional)"
                          className="flex-1 px-2 py-1 text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]" />
                        <button type="button" onClick={() => setUrlParamDefs(d => d.filter((_, j) => j !== i))} className="text-[var(--muted-foreground)] hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {urlParamDefs.length === 0 && detected.length === 0 && (
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    Add <code className="bg-[var(--muted)] px-1">{'{{lat}}'}</code> to your URL and define defaults here. Example: <code className="bg-[var(--muted)] px-1">https://api.open-meteo.com/v1/forecast?latitude={'{{lat}}'}&longitude={'{{lon}}'}</code>
                  </p>
                )}
              </div>
              )
            })()}

            {/* Headers */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Headers (JSON)</label>
              <textarea value={headersText} onChange={e => setHeadersText(e.target.value)} rows={3}
                placeholder='{"Content-Type": "application/json"}'
                className="w-full px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)] font-mono resize-y" />
            </div>

            {/* Body */}
            {(form.method !== 'GET' && form.method !== 'HEAD') && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Request body</label>
                <textarea value={form.body ?? ''} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4}
                  placeholder='{"key": "value"}'
                  className="w-full px-2 py-1.5 text-sm border border-[var(--border)] rounded bg-[var(--background)] text-[var(--foreground)] font-mono resize-y" />
              </div>
            )}

            {/* Test */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleTest} disabled={!form.url || testLoading}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium border border-[var(--border)] rounded bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-40">
                  {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Test request
                </button>
                {testResult && !testResult.error && (
                  <button type="button" onClick={() => saveMutation.mutate()} className="text-xs text-emerald-600 dark:text-emerald-400 underline">
                    Save inferred schema ({testResult.schema?.length ?? 0} fields)
                  </button>
                )}
              </div>
              {testResult && (
                <div className="rounded border border-[var(--border)] overflow-hidden text-xs">
                  <div className={`flex items-center gap-2 px-3 py-2 ${testResult.error ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                    {testResult.error
                      ? <AlertCircle className="h-4 w-4 text-red-500" />
                      : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    <span className="font-medium">
                      {testResult.error ?? `${testResult.status} ${testResult.statusText}`}
                    </span>
                    {testResult.schema && <span className="ml-auto text-[var(--muted-foreground)]">Schema inferred ({testResult.schema.length} fields)</span>}
                  </div>
                  {testResult.schema && testResult.schema.length > 0 && (
                    <div className="px-3 py-2 bg-[var(--card)] border-t border-[var(--border)]">
                      <div className="font-medium text-[var(--muted-foreground)] mb-1">Inferred schema</div>
                      <div className="flex flex-wrap gap-1">
                        {testResult.schema.map(f => (
                          <span key={f.name} className="px-2 py-0.5 rounded bg-[var(--muted)] text-[var(--foreground)]">
                            {f.name}: <span className="text-[var(--muted-foreground)]">{f.type}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {testResult.rawText && (
                    <div className="px-3 py-2 border-t border-[var(--border)]">
                      <pre className="max-h-48 overflow-auto text-[10px] text-[var(--muted-foreground)] whitespace-pre-wrap">{testResult.rawText.slice(0, 5000)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Saved schema */}
            {selectedSource.schema && (selectedSource.schema as Array<{name:string;type:string}>).length > 0 && !testResult && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Saved schema</label>
                <div className="flex flex-wrap gap-1">
                  {(selectedSource.schema as Array<{name:string;type:string}>).map(f => (
                    <span key={f.name} className="px-2 py-0.5 rounded bg-[var(--muted)] text-xs text-[var(--foreground)]">
                      {f.name}: <span className="text-[var(--muted-foreground)]">{f.type}</span>
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--muted-foreground)]">In builder: <code>{'{{data.' + selectedSource.name + '}}'}</code> (full), <code>{'{{data.' + selectedSource.name + '.current.temperature_2m}}'}</code> (nested), repeater arrays like <code>{'{{data.' + selectedSource.name + '.hourly.time}}'}</code>.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create source dialog */}
      <Dialog open={newSourceOpen} onOpenChange={setNewSourceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New API source</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="Source name (e.g. users, products)" value={newSourceName} onChange={e => setNewSourceName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && newSourceName.trim() && createMutation.mutate(newSourceName.trim())} autoFocus />
            <p className="text-xs text-[var(--muted-foreground)]">You can reference <code>{'{{data.' + (newSourceName.trim() || 'name') + '}}'}</code> and nested paths like <code>{'{{data.' + (newSourceName.trim() || 'name') + '.some.path}}'}</code>.</p>
            <Button onClick={() => newSourceName.trim() && createMutation.mutate(newSourceName.trim())} disabled={!newSourceName.trim()}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AssetsTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const inputRef = useState<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['page-assets', projectId],
    queryFn: async () => (await axios.get(`/api/projects/${projectId}/assets`)).data,
  })
  const assets: ProjectAsset[] = data?.assets ?? []

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => axios.delete(`/api/projects/${projectId}/assets/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['page-assets', projectId] }),
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    const form = new FormData()
    for (const f of Array.from(files)) form.append('file', f)
    try {
      await axios.post(`/api/projects/${projectId}/assets`, form)
      queryClient.invalidateQueries({ queryKey: ['page-assets', projectId] })
    } catch { /* ignore */ }
    setUploading(false)
    e.target.value = ''
  }

  const fmt = (bytes: number) => bytes > 1048576 ? `${(bytes/1048576).toFixed(1)} MB` : `${(bytes/1024).toFixed(0)} KB`

  if (isLoading) return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading…</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Project Assets</h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Images, audio, video and other files. Reference via <code className="bg-[var(--muted)] px-1">{'{{asset.fileName}}'}</code> or bind directly in the builder.</p>
        </div>
        <label className="cursor-pointer">
          <input type="file" multiple className="hidden" onChange={handleUpload} accept="image/*,audio/*,video/*,.pdf,.json,.csv,.txt,.svg" />
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload files
          </span>
        </label>
      </div>

      {assets.length === 0 ? (
        <label className="cursor-pointer block border-2 border-dashed border-[var(--border)] p-12 text-center hover:border-[var(--foreground)] transition-colors">
          <input type="file" multiple className="hidden" onChange={handleUpload} accept="image/*,audio/*,video/*,.pdf,.json,.csv,.txt,.svg" />
          <Upload className="h-8 w-8 mx-auto mb-3 text-[var(--muted-foreground)]" />
          <p className="text-sm font-medium text-[var(--foreground)]">Upload assets</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">Images, audio, video, PDFs, CSVs and more</p>
        </label>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {assets.map(a => (
            <div key={a.id} className="group border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              <div className="aspect-square bg-[var(--muted)] flex items-center justify-center relative overflow-hidden">
                {a.mimetype.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                ) : a.mimetype.startsWith('video/') ? (
                  <video src={a.url} className="w-full h-full object-cover" muted />
                ) : (
                  <div className="text-[var(--muted-foreground)] text-center p-2">
                    <div className="text-2xl mb-1">{a.mimetype.includes('pdf') ? '📄' : a.mimetype.includes('audio') ? '🎵' : '📎'}</div>
                    <div className="text-[10px] font-mono truncate max-w-full px-1">{a.mimetype.split('/')[1]}</div>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button type="button" onClick={() => { navigator.clipboard.writeText(a.url) }}
                    className="p-1.5 bg-white text-black hover:bg-gray-100" title="Copy URL">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => deleteMutation.mutate(a.id)}
                    className="p-1.5 bg-red-600 text-white hover:bg-red-700" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-[var(--foreground)] truncate" title={a.name}>{a.name}</p>
                <p className="text-[10px] text-[var(--muted-foreground)]">{fmt(a.size)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const WEBHOOK_EVENTS = [
  'form.submit', 'btn.click', 'automation.trigger', 'state.change', 'screen.load', 'screen.unload',
]

function WebhooksTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [form, setForm] = useState<{ name: string; url: string; events: string[]; secret: string; active: boolean }>({
    name: '', url: '', events: [], secret: '', active: true,
  })
  const [testResult, setTestResult] = useState<{ ok: boolean; status?: number; error?: string } | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks', projectId],
    queryFn: async () => (await axios.get(`/api/projects/${projectId}/webhooks`)).data,
  })
  const webhooks: ProjectWebhook[] = data?.webhooks ?? []
  const selected = webhooks.find(w => w.id === selectedId) ?? null

  useEffect(() => {
    if (selected) setForm({ name: selected.name, url: selected.url, events: selected.events ?? [], secret: selected.secret ?? '', active: selected.active })
  }, [selected?.id])

  const createMutation = useMutation({
    mutationFn: async (name: string) => (await axios.post(`/api/projects/${projectId}/webhooks`, { name, url: '', events: [], active: true })).data,
    onSuccess: (d) => { queryClient.invalidateQueries({ queryKey: ['webhooks', projectId] }); setNewOpen(false); setNewName(''); setSelectedId(d.webhook.id) },
  })

  const saveMutation = useMutation({
    mutationFn: async () => axios.patch(`/api/projects/${projectId}/webhooks/${selectedId}`, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks', projectId] }); setSaveMsg('Saved'); setTimeout(() => setSaveMsg(null), 2000) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => axios.delete(`/api/projects/${projectId}/webhooks/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks', projectId] }); setSelectedId(null); setTestResult(null) },
  })

  const handleTest = async () => {
    if (!selectedId) return
    setTestLoading(true); setTestResult(null)
    try {
      const res = await axios.post(`/api/projects/${projectId}/webhooks/${selectedId}/test`)
      setTestResult({ ok: true, status: res.data.status })
    } catch (e: any) {
      setTestResult({ ok: false, error: e?.response?.data?.error ?? (e as Error).message })
    }
    setTestLoading(false)
  }

  const toggleEvent = (ev: string) => setForm(f => ({
    ...f,
    events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
  }))

  if (isLoading) return <div className="p-4 text-sm text-[var(--muted-foreground)]">Loading…</div>

  return (
    <div className="flex flex-col lg:flex-row gap-0 h-full min-h-0">
      {/* List */}
      <div className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--border)] flex flex-col max-h-52 lg:max-h-none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Webhooks</span>
          <button type="button" onClick={() => setNewOpen(true)} className="p-1 hover:bg-[var(--muted)] text-[var(--muted-foreground)]"><Plus className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-auto py-2 space-y-0.5 px-2">
          {webhooks.length === 0 && (
            <div className="text-xs text-[var(--muted-foreground)] px-2 py-4 text-center">No webhooks yet.<br/>Create one to receive event notifications.</div>
          )}
          {webhooks.map(w => (
            <button key={w.id} type="button" onClick={() => setSelectedId(w.id)}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm transition-colors ${selectedId === w.id ? 'bg-black dark:bg-white text-white dark:text-black' : 'hover:bg-[var(--muted)] text-[var(--foreground)]'}`}>
              <Webhook className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{w.name}</span>
              <span className={`ml-auto h-1.5 w-1.5 rounded-full shrink-0 ${w.active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 overflow-auto">
        {!selected ? (
          <div className="flex-1 h-full flex items-center justify-center text-[var(--muted-foreground)] text-sm">
            Select a webhook or create one
          </div>
        ) : (
          <div className="p-3 sm:p-6 space-y-5 max-w-2xl">
            <div className="sticky top-0 z-20 bg-[var(--background)]/95 backdrop-blur border-b border-[var(--border)] -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
              <h2 className="font-semibold text-[var(--foreground)]">{selected.name}</h2>
              <div className="flex flex-wrap gap-2 items-center">
                {saveMsg && <span className="text-xs text-emerald-600">{saveMsg}</span>}
                <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80 disabled:opacity-50">
                  {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}Save
                </button>
                <button type="button" onClick={() => deleteMutation.mutate(selected.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="h-3 w-3" />Delete
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Endpoint URL</label>
              <input type="url" value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))}
                placeholder="https://your-server.com/webhook"
                className="w-full px-3 py-1.5 text-sm border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] font-mono" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Events (select what triggers this webhook)</label>
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_EVENTS.map(ev => (
                  <button key={ev} type="button" onClick={() => toggleEvent(ev)}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${form.events.includes(ev) ? 'bg-black dark:bg-white text-white dark:text-black' : 'border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]'}`}>
                    {ev}
                  </button>
                ))}
              </div>
              <input type="text" placeholder="Custom event name (press Enter to add)"
                onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) { toggleEvent((e.target as HTMLInputElement).value.trim()); (e.target as HTMLInputElement).value = '' }}}
                className="w-full px-3 py-1.5 text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Signing Secret (optional)</label>
              <input type="password" value={form.secret} onChange={e => setForm(f => ({...f, secret: e.target.value}))}
                placeholder="HMAC-SHA256 secret — sent as X-DCCortex-Signature header"
                className="w-full px-3 py-1.5 text-sm border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] font-mono" />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({...f, active: e.target.checked}))} className="w-4 h-4" />
                <span className="text-sm text-[var(--foreground)]">Active</span>
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleTest} disabled={!form.url || testLoading}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-40">
                  {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Send test ping
                </button>
              </div>
              {testResult && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 ${testResult.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                  {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  {testResult.ok ? `Success — HTTP ${testResult.status}` : testResult.error}
                </div>
              )}
            </div>

            <div className="bg-[var(--muted)] p-3 space-y-1">
              <p className="text-xs font-medium text-[var(--foreground)]">Payload format</p>
              <pre className="text-[10px] text-[var(--muted-foreground)] overflow-auto">{JSON.stringify({ event: 'form.submit', projectId: '...', timestamp: '...', data: { formId: 'contactForm', values: {} } }, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New webhook</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="Webhook name" value={newName} onChange={e => setNewName(e.target.value)} autoFocus
              onKeyDown={e => e.key === 'Enter' && newName.trim() && createMutation.mutate(newName.trim())} />
            <button type="button" onClick={() => newName.trim() && createMutation.mutate(newName.trim())} disabled={!newName.trim()}
              className="px-4 py-2 text-sm font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80 disabled:opacity-40">
              Create
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ProjectDataPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const orgId = params.id as string
  const projectId = params.projectId as string
  const [dataTab, setDataTab] = useState<'db' | 'api' | 'assets' | 'webhooks'>('db')
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [newTableName, setNewTableName] = useState('')
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnType, setNewColumnType] = useState<string>('text')
  const [createTableOpen, setCreateTableOpen] = useState(false)
  const [addColumnOpen, setAddColumnOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [addRowOpen, setAddRowOpen] = useState(false)
  const [newRowData, setNewRowData] = useState<Record<string, string>>({})
  const [realtimeEnabled, setRealtimeEnabled] = useState(false)

  const base = `/api/projects/${projectId}/datasources`

  // Refresh when Cortex AI completes actions
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['datasources', projectId] })
      queryClient.invalidateQueries({ queryKey: ['tables', projectId] })
    }
    window.addEventListener('cortex:refresh', handler)
    return () => window.removeEventListener('cortex:refresh', handler)
  }, [projectId, queryClient])

  const { data: dsList, isLoading } = useQuery({
    queryKey: ['datasources', projectId],
    queryFn: async () => {
      const listRes = await axios.get(base)
      if (listRes.data.datasources?.length === 0) {
        await axios.post(base)
        const again = await axios.get(base)
        return again.data
      }
      return listRes.data
    },
  })

  const datasource = dsList?.datasources?.[0]
  const dsId = datasource?.id

  const { data: tablesData } = useQuery({
    queryKey: ['tables', projectId, dsId],
    queryFn: async () => {
      const res = await axios.get(`${base}/${dsId}/tables`)
      return res.data
    },
    enabled: !!dsId,
  })

  const tables = tablesData?.tables || []
  const selectedTable = tables.find((t: any) => t.id === selectedTableId) ?? tables[0]
  useEffect(() => {
    if (tables.length > 0 && (!selectedTableId || !tables.some((t: any) => t.id === selectedTableId)))
      setSelectedTableId(tables[0].id)
  }, [tables, selectedTableId])

  const { data: rowsData } = useQuery({
    queryKey: ['rows', projectId, dsId, selectedTable?.id],
    queryFn: async () => {
      const res = await axios.get(
        `${base}/${dsId}/tables/${selectedTable.id}/rows?limit=100`
      )
      return res.data
    },
    enabled: !!dsId && !!selectedTable?.id,
  })

  const createTableMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await axios.post(`${base}/${dsId}/tables`, { name })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', projectId, dsId] })
      setCreateTableOpen(false)
      setNewTableName('')
    },
  })

  const addColumnMutation = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: string }) => {
      const cols = [...(selectedTable?.columns || []), { name, type }]
      await axios.patch(`${base}/${dsId}/tables`, {
        tableId: selectedTable.id,
        columns: cols.map((c: any) => ({ name: c.name, type: c.type || 'text' })),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', projectId, dsId] })
      setAddColumnOpen(false)
      setNewColumnName('')
    },
  })

  const importCsvMutation = useMutation({
    mutationFn: async () => {
      if (!csvFile) throw new Error('No file')
      const form = new FormData()
      form.append('file', csvFile)
      const res = await axios.post(
        `${base}/${dsId}/tables/${selectedTable.id}/import-csv`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rows', projectId, dsId, selectedTable?.id] })
      setCsvOpen(false)
      setCsvFile(null)
      if (data?.inserted != null) alert(`Imported ${data.inserted} rows.`)
    },
  })

  const addRowMutation = useMutation({
    mutationFn: async () => {
      if (!dsId || !selectedTable) throw new Error('No table selected')
      const body: Record<string, unknown> = {}
      for (const col of userColumns) {
        const raw = newRowData[col.name] ?? ''
        if (col.type === 'number') body[col.name] = raw === '' ? null : Number(raw)
        else if (col.type === 'boolean') body[col.name] = raw === 'true'
        else body[col.name] = raw
      }
      const res = await axios.post(`${base}/${dsId}/tables/${selectedTable.id}/rows`, body)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rows', projectId, dsId, selectedTable?.id] })
      setAddRowOpen(false)
      setNewRowData({})
    },
  })

  // Sync realtimeEnabled from loaded datasource
  useEffect(() => {
    if (datasource?.realtimePollMs != null) {
      setRealtimeEnabled(datasource.realtimePollMs > 0)
    }
  }, [datasource?.realtimePollMs])

  const realtimeMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!dsId) throw new Error('No datasource')
      const res = await axios.patch(`${base}/${dsId}`, { realtimePollMs: enabled ? 2000 : 0 })
      return res.data
    },
    onSuccess: (_data, enabled) => {
      setRealtimeEnabled(enabled)
      queryClient.invalidateQueries({ queryKey: ['datasources', projectId] })
    },
  })

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingBar fullPage />
      </DashboardLayout>
    )
  }

  const breadcrumbs = [
    { label: 'Organizations', href: '/dashboard' },
    { label: 'Org', href: `/organizations/${orgId}` },
    { label: 'Project', href: `/organizations/${orgId}/projects/${projectId}/backend` },
    { label: 'Data', href: '#' },
  ]

  const columns = selectedTable?.columns || []
  const userColumns = columns.filter(
    (c: any) => !['id', 'created_at', 'updated_at', 'created_by'].includes(c.name)
  )
  const rows = rowsData?.rows || []

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen bg-[var(--background)]">
        <div className="shrink-0 border-b border-[var(--border)] px-3 sm:px-6 py-3 sm:py-4">
          <Breadcrumb items={breadcrumbs} />
          {/* Project-level nav */}
          <div className="mt-3 flex gap-1 items-center overflow-x-auto pb-1">
            <Link href={`/organizations/${orgId}/projects/${projectId}/screens`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">
              <Layout className="h-3.5 w-3.5" />Screens
            </Link>
            <Link href={`/organizations/${orgId}/projects/${projectId}/data`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 border-black dark:border-white text-black dark:text-white">
              <Database className="h-3.5 w-3.5" />Data
            </Link>
            <Link href={`/organizations/${orgId}/projects/${projectId}/settings`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">
              <Settings className="h-3.5 w-3.5" />Settings
            </Link>
            <Link href={`/organizations/${orgId}?newProject=1`}
              className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]">
              <Plus className="h-3.5 w-3.5" />New Project
            </Link>
          </div>
          {/* Data sub-tabs */}
          <div className="mt-3 flex gap-1 border-b border-[var(--border)] overflow-x-auto">
            <button type="button" onClick={() => setDataTab('db')}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${dataTab === 'db' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>
              <Database className="h-3.5 w-3.5" />Database
            </button>
            <button type="button" onClick={() => setDataTab('api')}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${dataTab === 'api' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>
              <Globe className="h-3.5 w-3.5" />REST APIs
            </button>
            <button type="button" onClick={() => setDataTab('assets')}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${dataTab === 'assets' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>
              <Image className="h-3.5 w-3.5" />Assets
            </button>
            <button type="button" onClick={() => setDataTab('webhooks')}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${dataTab === 'webhooks' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>
              <Webhook className="h-3.5 w-3.5" />Webhooks
            </button>
          </div>
        </div>

        {dataTab === 'api' ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <RestApiTab projectId={projectId} />
          </div>
        ) : dataTab === 'assets' ? (
          <div className="flex-1 min-h-0 overflow-auto">
            <AssetsTab projectId={projectId} />
          </div>
        ) : dataTab === 'webhooks' ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <WebhooksTab projectId={projectId} />
          </div>
        ) : (
        <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          <div className="w-full lg:w-64 shrink-0 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Tables</span>
              <button type="button" onClick={() => setCreateTableOpen(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80">
                <Plus className="h-3 w-3" /> New table
              </button>
            </div>
            {tables.length === 0 ? (
              <div className="border border-dashed border-[var(--border)] p-6 text-center">
                <p className="text-xs text-[var(--muted-foreground)] mb-3">No tables yet.</p>
                <button type="button" onClick={() => setCreateTableOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80 mx-auto">
                  <Plus className="h-3 w-3" /> Create table
                </button>
              </div>
            ) : (
              tables.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTableId(t.id)}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors rounded ${
                    selectedTable?.id === t.id
                      ? 'bg-black dark:bg-white text-white dark:text-black'
                      : 'hover:bg-[var(--muted)] text-[var(--foreground)]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Table className="h-4 w-4" />
                    {t.name}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ))
            )}
          </div>

          <div className="flex-1 min-w-0">
            {!selectedTable ? (
              <div className="border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted-foreground)]">
                Select a table or create one.
              </div>
            ) : (
              <>
                <div className="sticky top-0 z-20 bg-[var(--background)]/95 backdrop-blur border border-[var(--border)] rounded px-2 py-2 flex flex-wrap items-center gap-2 mb-4">
                  <h2 className="text-lg font-medium text-[var(--foreground)]">{selectedTable.name}</h2>
                  <button type="button" onClick={() => setAddColumnOpen(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)]">
                    <Plus className="h-3.5 w-3.5" /> Column
                  </button>
                  <button type="button" onClick={() => setCsvOpen(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)]">
                    <Upload className="h-3.5 w-3.5" /> Import CSV
                  </button>
                  <button type="button" onClick={() => { setNewRowData({}); setAddRowOpen(true) }}
                    className="flex items-center gap-1 px-2 py-1 text-xs border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)]">
                    <Plus className="h-3.5 w-3.5" /> Add Row
                  </button>
                  <button type="button"
                    onClick={() => realtimeMutation.mutate(!realtimeEnabled)}
                    disabled={realtimeMutation.isPending}
                    title={realtimeEnabled ? 'Disable real-time (currently polling every 2s)' : 'Enable real-time polling (2s interval)'}
                    className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
                      realtimeEnabled
                        ? 'border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40'
                        : 'border-[var(--border)] hover:bg-[var(--muted)] text-[var(--muted-foreground)]'
                    }`}>
                    {realtimeEnabled ? (
                      <><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span> Live</>
                    ) : (
                      <><Zap className="h-3.5 w-3.5" /> Real-time</>
                    )}
                  </button>
                </div>
                <div className="border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                          <th className="text-left p-3 font-medium text-[var(--foreground)]">id</th>
                          {userColumns.map((c: any) => (
                            <th key={c.id} className="text-left p-3 font-medium text-[var(--foreground)]">
                              {c.name}
                            </th>
                          ))}
                          <th className="text-left p-3 font-medium text-[var(--foreground)]">created_at</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row: any) => (
                          <tr key={row.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50">
                            <td className="p-3 text-[var(--muted-foreground)] font-mono text-xs">{row.id?.slice(0, 8)}</td>
                            {userColumns.map((c: any) => (
                              <td key={c.name} className="p-3 text-[var(--foreground)]">
                                {String(row[c.name] ?? '')}
                              </td>
                            ))}
                            <td className="p-3 text-[var(--muted-foreground)] text-xs">
                              {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length === 0 && (
                    <div className="p-8 text-center text-[var(--muted-foreground)] space-y-2">
                      <p>No rows yet.</p>
                      {userColumns.length > 0 ? (
                        <button type="button" onClick={() => { setNewRowData({}); setAddRowOpen(true) }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)] rounded">
                          <Plus className="h-3.5 w-3.5" /> Add First Row
                        </button>
                      ) : (
                        <p className="text-xs">Add columns first, then insert rows manually or via the API.</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        </div>
        )}
      </div>

      <Dialog open={createTableOpen} onOpenChange={setCreateTableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New table</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="Table name"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
            />
            <button type="button"
              onClick={() => newTableName.trim() && createTableMutation.mutate(newTableName.trim())}
              disabled={!newTableName.trim()}
              className="px-4 py-2 text-sm font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80 disabled:opacity-40">
              Create
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addColumnOpen} onOpenChange={setAddColumnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add column</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="Column name"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
            />
            <select
              className="w-full border border-[var(--border)] px-3 py-2 bg-[var(--background)] text-[var(--foreground)]"
              value={newColumnType}
              onChange={(e) => setNewColumnType(e.target.value)}
            >
              {COLUMN_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button type="button"
              onClick={() => newColumnName.trim() && addColumnMutation.mutate({ name: newColumnName.trim(), type: newColumnType })}
              disabled={!newColumnName.trim()}
              className="px-4 py-2 text-sm font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80 disabled:opacity-40">
              Add
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              className="text-sm text-[var(--foreground)]"
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              First row = headers. Map CSV columns to table columns by matching names.
            </p>
            <button type="button"
              onClick={() => importCsvMutation.mutate()}
              disabled={!csvFile}
              className="px-4 py-2 text-sm font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80 disabled:opacity-40">
              Import
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Row Dialog */}
      <Dialog open={addRowOpen} onOpenChange={setAddRowOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Row — {selectedTable?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {userColumns.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">Add columns to this table first.</p>
            )}
            {userColumns.map((col: any) => (
              <div key={col.name} className="space-y-1">
                <label className="text-xs font-medium text-[var(--foreground)]">
                  {col.name} <span className="text-[var(--muted-foreground)] font-normal">({col.type})</span>
                </label>
                {col.type === 'boolean' ? (
                  <select
                    value={newRowData[col.name] ?? 'false'}
                    onChange={(e) => setNewRowData((prev) => ({ ...prev, [col.name]: e.target.value }))}
                    className="w-full px-3 py-1.5 text-sm border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] rounded"
                  >
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                ) : (
                  <Input
                    type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                    placeholder={col.name}
                    value={newRowData[col.name] ?? ''}
                    onChange={(e) => setNewRowData((prev) => ({ ...prev, [col.name]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button type="button"
                onClick={() => addRowMutation.mutate()}
                disabled={addRowMutation.isPending || userColumns.length === 0}
                className="px-4 py-2 text-sm font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80 disabled:opacity-40">
                {addRowMutation.isPending ? 'Saving…' : 'Add Row'}
              </button>
              <button type="button" onClick={() => setAddRowOpen(false)}
                className="px-4 py-2 text-sm border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--foreground)] rounded">
                Cancel
              </button>
            </div>
            {addRowMutation.isError && (
              <p className="text-xs text-red-500">Failed to add row. Check column types.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
