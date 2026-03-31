/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import type { ReusableDefinition } from './globals'

export type PackageDef = {
  id: string
  name: string
  description: string
  thumbnailUrl: string
  tags: string[]
  content: ReusableDefinition
  isPublic: boolean
  version: string
  authorUserId: string
  organizationId?: string | null
  createdAt: string
  updatedAt: string
}

interface PackageManagerProps {
  open: boolean
  onClose: () => void
  orgId: string | null
  projectId: string
  globalReusables: ReusableDefinition[]
  onInstall: (reusable: ReusableDefinition) => void
  currentUserId?: string
}

// ── small reusable UI pieces ────────────────────────────────────────────────

function Tag({ label }: { label: string }) {
  return (
    <span className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-[#21262d] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#30363d]">
      {label}
    </span>
  )
}

function Spinner() {
  return <div className="h-5 w-5 rounded-full border-2 border-gray-200 border-t-gray-500 animate-spin mx-auto" />
}

function PackageCard({
  pkg,
  onInstall,
  onDelete,
  showDelete,
  installing,
}: {
  pkg: PackageDef
  onInstall: (pkg: PackageDef) => void
  onDelete?: (pkg: PackageDef) => void
  showDelete?: boolean
  installing: boolean
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] p-3 hover:border-gray-300 dark:hover:border-[#484f58] transition-colors">
      {pkg.thumbnailUrl && (
        <img
          src={pkg.thumbnailUrl}
          alt={pkg.name}
          className="w-full h-28 object-cover rounded border border-gray-100 dark:border-[#30363d]"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      {!pkg.thumbnailUrl && (
        <div className="w-full h-20 rounded bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#21262d] dark:to-[#30363d] flex items-center justify-center">
          <span className="text-2xl">📦</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{pkg.name}</span>
          <span className="text-[10px] text-gray-400 shrink-0">v{pkg.version}</span>
        </div>
        {pkg.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{pkg.description}</p>
        )}
        {pkg.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {pkg.tags.slice(0, 4).map((t) => <Tag key={t} label={t} />)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <button
          type="button"
          disabled={installing}
          onClick={() => onInstall(pkg)}
          className="flex-1 py-1.5 text-xs font-medium rounded border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50 transition-colors"
        >
          {installing ? 'Installing…' : '⬇ Install'}
        </button>
        {showDelete && onDelete && (
          <button
            type="button"
            onClick={() => { if (confirm(`Delete "${pkg.name}"?`)) onDelete(pkg) }}
            className="px-2 py-1.5 text-xs rounded border border-gray-200 dark:border-[#30363d] text-gray-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
            title="Delete package"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  )
}

// ── main component ───────────────────────────────────────────────────────────

export function PackageManager({
  open,
  onClose,
  orgId,
  globalReusables,
  onInstall,
  currentUserId,
}: PackageManagerProps) {
  const [tab, setTab] = useState<'browse' | 'mine' | 'publish'>('browse')
  const [search, setSearch] = useState('')
  const [packages, setPackages] = useState<PackageDef[]>([])
  const [loading, setLoading] = useState(false)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [publishError, setPublishError] = useState('')
  const [publishSuccess, setPublishSuccess] = useState(false)

  // Publish form state
  const [selectedReusableId, setSelectedReusableId] = useState('')
  const [pubName, setPubName] = useState('')
  const [pubDesc, setPubDesc] = useState('')
  const [pubThumb, setPubThumb] = useState('')
  const [pubTags, setPubTags] = useState('')
  const [pubPublic, setPubPublic] = useState(false)
  const [pubVersion, setPubVersion] = useState('1.0.0')
  const [publishing, setPublishing] = useState(false)

  const fetchPackages = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/packages${orgId ? `?orgId=${orgId}` : ''}${search ? `${orgId ? '&' : '?'}search=${encodeURIComponent(search)}` : ''}`
      const res = await axios.get(url)
      setPackages(res.data.packages ?? [])
    } catch {
      setPackages([])
    } finally {
      setLoading(false)
    }
  }, [orgId, search])

  useEffect(() => {
    if (open) fetchPackages()
  }, [open, fetchPackages])

  const handleInstall = useCallback(async (pkg: PackageDef) => {
    setInstallingId(pkg.id)
    try {
      // Assign a new unique id so multiple installs don't conflict
      const newReusable: ReusableDefinition = {
        ...pkg.content,
        id: `reusable-${Date.now()}`,
        name: pkg.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      onInstall(newReusable)
    } finally {
      setInstallingId(null)
    }
  }, [onInstall])

  const handleDelete = useCallback(async (pkg: PackageDef) => {
    try {
      await axios.delete(`/api/packages/${pkg.id}`)
      setPackages((p) => p.filter((x) => x.id !== pkg.id))
    } catch {
      alert('Failed to delete package')
    }
  }, [])

  const handlePublish = useCallback(async () => {
    setPublishError('')
    if (!pubName.trim()) { setPublishError('Name is required'); return }
    const reusable = globalReusables.find((r) => r.id === selectedReusableId)
    if (!reusable) { setPublishError('Select a reusable component to publish'); return }
    setPublishing(true)
    try {
      await axios.post('/api/packages', {
        name: pubName.trim(),
        description: pubDesc,
        thumbnailUrl: pubThumb,
        tags: pubTags.split(',').map((t) => t.trim()).filter(Boolean),
        content: reusable,
        isPublic: pubPublic,
        version: pubVersion || '1.0.0',
        organizationId: orgId,
      })
      setPublishSuccess(true)
      setPubName(''); setPubDesc(''); setPubThumb(''); setPubTags(''); setPubVersion('1.0.0'); setSelectedReusableId('')
      setTimeout(() => { setPublishSuccess(false); setTab('mine'); fetchPackages() }, 1500)
    } catch (e: any) {
      setPublishError(e?.response?.data?.error ?? e?.message ?? 'Failed to publish')
    } finally {
      setPublishing(false)
    }
  }, [pubName, pubDesc, pubThumb, pubTags, pubPublic, pubVersion, selectedReusableId, globalReusables, orgId, fetchPackages])

  if (!open) return null

  const browsePackages = packages.filter((p) => tab === 'browse' ? true : p.authorUserId === currentUserId)
  const myPackages = packages.filter((p) => p.authorUserId === currentUserId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-[#30363d] rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-[#30363d] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">📦</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">Package Manager</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#21262d] text-gray-500">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-5 pt-3 border-b border-gray-200 dark:border-[#30363d] shrink-0">
          {(['browse', 'mine', 'publish'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t === 'browse' ? '🔍 Browse' : t === 'mine' ? '📋 My Packages' : '🚀 Publish'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Browse / My Packages ─────────────────────── */}
          {(tab === 'browse' || tab === 'mine') && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search packages…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchPackages()}
                  className="flex-1 text-sm px-3 py-2 rounded border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={fetchPackages}
                  className="px-3 py-2 text-xs font-medium rounded border border-gray-200 dark:border-[#30363d] hover:bg-gray-50 dark:hover:bg-[#21262d] text-gray-600 dark:text-gray-300"
                >
                  Search
                </button>
              </div>

              {loading ? (
                <div className="py-10"><Spinner /></div>
              ) : (tab === 'browse' ? packages : myPackages).length === 0 ? (
                <div className="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
                  {tab === 'browse'
                    ? <>No packages found. <button type="button" className="text-blue-500 underline" onClick={() => setTab('publish')}>Publish one?</button></>
                    : <>You haven't published any packages yet. <button type="button" className="text-blue-500 underline" onClick={() => setTab('publish')}>Publish one</button></>
                  }
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(tab === 'browse' ? packages : myPackages).map((pkg) => (
                    <PackageCard
                      key={pkg.id}
                      pkg={pkg}
                      onInstall={handleInstall}
                      onDelete={handleDelete}
                      showDelete={tab === 'mine'}
                      installing={installingId === pkg.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Publish ─────────────────────────────────── */}
          {tab === 'publish' && (
            <div className="flex flex-col gap-4 max-w-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Publish one of your reusable components as an installable package. Other people in your org (or publicly) can then install it into their projects.
              </p>

              {/* How to use hint */}
              <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/10 px-4 py-3 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                <strong>How packages work:</strong><br/>
                1. Build and test a reusable component in your project's Reusables panel.<br/>
                2. Publish it here with a name, description and optional thumbnail screenshot.<br/>
                3. Any project can then install it — it appears in the Reusables panel ready to drop onto the canvas, and accepts props just like the original.
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Reusable to publish <span className="text-red-500">*</span></span>
                <select
                  value={selectedReusableId}
                  onChange={(e) => {
                    setSelectedReusableId(e.target.value)
                    const r = globalReusables.find((x) => x.id === e.target.value)
                    if (r && !pubName) setPubName(r.name)
                  }}
                  className="text-sm px-3 py-2 rounded border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">— select a reusable —</option>
                  {globalReusables.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                {globalReusables.length === 0 && (
                  <span className="text-xs text-amber-600">No reusables found. Create one in the Reusables panel first.</span>
                )}
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Package name <span className="text-red-500">*</span></span>
                <input
                  type="text"
                  value={pubName}
                  onChange={(e) => setPubName(e.target.value)}
                  placeholder="e.g. Navigation Header"
                  className="text-sm px-3 py-2 rounded border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Description</span>
                <textarea
                  rows={2}
                  value={pubDesc}
                  onChange={(e) => setPubDesc(e.target.value)}
                  placeholder="What does this component do?"
                  className="text-sm px-3 py-2 rounded border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Thumbnail URL <span className="text-gray-400 font-normal">(screenshot or preview image)</span></span>
                <input
                  type="text"
                  value={pubThumb}
                  onChange={(e) => setPubThumb(e.target.value)}
                  placeholder="https://…"
                  className="text-sm px-3 py-2 rounded border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {pubThumb && (
                  <img src={pubThumb} alt="preview" className="mt-1 h-24 w-full object-cover rounded border border-gray-200 dark:border-[#30363d]"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                )}
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Tags <span className="text-gray-400 font-normal">(comma separated)</span></span>
                <input
                  type="text"
                  value={pubTags}
                  onChange={(e) => setPubTags(e.target.value)}
                  placeholder="navigation, header, layout"
                  className="text-sm px-3 py-2 rounded border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>

              <div className="flex items-center gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Version</span>
                  <input
                    type="text"
                    value={pubVersion}
                    onChange={(e) => setPubVersion(e.target.value)}
                    className="text-sm px-3 py-2 w-28 rounded border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center gap-2 cursor-pointer mt-4">
                  <input
                    type="checkbox"
                    checked={pubPublic}
                    onChange={(e) => setPubPublic(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Make public (visible to everyone)</span>
                </label>
              </div>

              {publishError && <p className="text-xs text-red-500">{publishError}</p>}
              {publishSuccess && <p className="text-xs text-green-600">✓ Published successfully!</p>}

              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="self-start px-5 py-2 text-sm font-medium rounded bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
              >
                {publishing ? 'Publishing…' : '🚀 Publish package'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
