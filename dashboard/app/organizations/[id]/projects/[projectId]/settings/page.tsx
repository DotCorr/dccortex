/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Database, Layout, Settings, Globe, Upload, CheckCircle2, Loader2, AlertCircle, Copy, CheckCheck } from 'lucide-react'
import { LoadingBar } from '@/components/ui/loading-bar'

export default function ProjectSettingsPage() {
  const params = useParams()
  const orgId = params.id as string
  const projectId = params.projectId as string
  const queryClient = useQueryClient()

  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project-settings', projectId],
    queryFn: async () => (await axios.get(`/api/projects/${projectId}`)).data,
  })
  const project = projectData?.project

  const [domain, setDomain] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [seo, setSeo] = useState({ title: '', description: '', ogImage: '', robots: 'index,follow' })
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (project) {
      setDomain(project.customDomain ?? '')
      setFaviconUrl(project.faviconUrl ?? '')
      const def = project.seoDefaults && typeof project.seoDefaults === 'object' ? project.seoDefaults as Record<string, string> : {}
      setSeo({
        title: def.title ?? '',
        description: def.description ?? '',
        ogImage: def.ogImage ?? '',
        robots: def.robots ?? 'index,follow',
      })
    }
  }, [project?.id])

  const saveMutation = useMutation({
    mutationFn: async () => axios.put(`/api/projects/${projectId}`, {
      customDomain: domain || null,
      faviconUrl: faviconUrl || null,
      seoDefaults: {
        ...(project?.seoDefaults && typeof project.seoDefaults === 'object' ? project.seoDefaults : {}),
        ...seo,
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-settings', projectId] })
      setSaveMsg('Saved')
      setTimeout(() => setSaveMsg(null), 2000)
    },
  })

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await axios.post(`/api/projects/${projectId}/assets`, form)
      const asset = res.data?.asset
      if (asset?.url) setFaviconUrl(asset.url)
    } catch { /* ignore */ }
    setUploading(false)
    e.target.value = ''
  }

  const copyPublicUrl = () => {
    const url = domain ? `https://${domain}` : `${window.location.origin}/p/${projectId}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) return <DashboardLayout><LoadingBar fullPage /></DashboardLayout>

  const breadcrumbs = [
    { label: 'Organizations', href: '/dashboard' },
    { label: 'Org', href: `/organizations/${orgId}` },
    { label: 'Project', href: `/organizations/${orgId}/projects/${projectId}/screens` },
    { label: 'Settings', href: '#' },
  ]

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen bg-[var(--background)]">
        <div className="shrink-0 border-b border-[var(--border)] px-3 sm:px-6 py-3 sm:py-4">
          <Breadcrumb items={breadcrumbs} />
          {/* Project nav */}
          <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
            <Link href={`/organizations/${orgId}/projects/${projectId}/screens`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">
              <Layout className="h-3.5 w-3.5" />Screens
            </Link>
            <Link href={`/organizations/${orgId}/projects/${projectId}/data`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white">
              <Database className="h-3.5 w-3.5" />Data
            </Link>
            <Link href={`/organizations/${orgId}/projects/${projectId}/settings`}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 border-black dark:border-white text-black dark:text-white">
              <Settings className="h-3.5 w-3.5" />Settings
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-6 lg:p-8">
          <div className="max-w-2xl space-y-6 sm:space-y-8">

            {/* App URL */}
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">App URL</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Your app is accessible at this public URL.</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 border border-[var(--border)] bg-[var(--muted)] font-mono text-xs text-[var(--foreground)]">
                <Globe className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
                <span className="flex-1 truncate">{domain ? `https://${domain}` : `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${projectId}`}</span>
                <button type="button" onClick={copyPublicUrl} className="self-end sm:self-auto text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  {copied ? <CheckCheck className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </section>

            {/* Custom Domain */}
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Custom Domain</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Point your domain to this app. Set a CNAME record to <code className="bg-[var(--muted)] px-1">dccortex.com</code> (or the IP/host of this server) in your DNS settings.</p>
              </div>
              <input type="text" value={domain} onChange={e => setDomain(e.target.value)}
                placeholder="app.yourdomain.com"
                className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] font-mono" />
              <div className="bg-[var(--muted)] border border-[var(--border)] p-3 space-y-1 text-xs text-[var(--muted-foreground)]">
                <p className="font-medium text-[var(--foreground)]">DNS setup instructions</p>
                <p>1. Add a CNAME record: <code className="bg-[var(--background)] px-1">{domain || 'app.yourdomain.com'}</code> → <code className="bg-[var(--background)] px-1">dccortex.com</code></p>
                <p>2. Or add an A record pointing to this server&apos;s IP.</p>
                <p>3. Once DNS propagates, traffic to your domain will route here automatically.</p>
                <p className="text-amber-600 dark:text-amber-400">Note: Custom domain routing requires Cloudflare tunnel or a reverse proxy (Traefik/nginx) configured on the server to forward <code className="bg-[var(--background)] px-1">Host: {domain || 'your-domain'}</code> to this container.</p>
              </div>
            </section>

            {/* Favicon */}
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Favicon</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">16×16, 32×32 or 64×64 PNG/ICO. Shown in browser tabs.</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {faviconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={faviconUrl} alt="favicon" className="w-12 h-12 object-contain border border-[var(--border)] bg-[var(--muted)] p-1" />
                ) : (
                  <div className="w-12 h-12 border-2 border-dashed border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)]">
                    <Globe className="h-6 w-6" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="cursor-pointer flex items-center gap-2">
                    <input type="file" className="hidden" accept="image/png,image/ico,image/svg+xml,image/x-icon,image/webp" onChange={handleFaviconUpload} />
                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80">
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Upload
                    </span>
                  </label>
                  {faviconUrl && (
                    <input type="text" value={faviconUrl} onChange={e => setFaviconUrl(e.target.value)}
                      placeholder="/uploads/…"
                      className="w-full sm:w-72 px-2 py-1 text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] font-mono" />
                  )}
                </div>
              </div>
            </section>

            {/* Global SEO defaults */}
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Default SEO</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Applied to all screens that don&apos;t override them. Use <code className="bg-[var(--muted)] px-1">{'{{screenName}}'}</code> and <code className="bg-[var(--muted)] px-1">{'{{projectName}}'}</code> tokens.</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Default page title', key: 'title' as const, placeholder: '{{screenName}} | My App' },
                  { label: 'Default meta description', key: 'description' as const, placeholder: 'Short description shown in search results…' },
                  { label: 'Default OG image URL', key: 'ogImage' as const, placeholder: 'https://…/social.png' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">{label}</label>
                    <input type="text" value={seo[key]} onChange={e => setSeo(s => ({...s, [key]: e.target.value}))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]" />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Default robots</label>
                  <select value={seo.robots} onChange={e => setSeo(s => ({...s, robots: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]">
                    <option value="index,follow">index, follow</option>
                    <option value="noindex,follow">noindex, follow</option>
                    <option value="index,nofollow">index, nofollow</option>
                    <option value="noindex,nofollow">noindex, nofollow</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Save */}
            <div className="sticky bottom-0 bg-[var(--background)]/95 backdrop-blur border-t border-[var(--border)] pt-3 pb-2 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-black dark:bg-white text-white dark:text-black hover:opacity-80 disabled:opacity-50">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save settings
              </button>
              {saveMsg && <span className="text-sm text-emerald-600 dark:text-emerald-400">{saveMsg}</span>}
              {saveMutation.isError && <span className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-4 w-4" />Failed to save</span>}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
