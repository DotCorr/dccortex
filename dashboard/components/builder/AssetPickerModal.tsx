/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import axios from 'axios'

interface Asset {
  id: string
  name: string
  mimetype: string
  size: number
  url: string
}

interface Props {
  projectId: string
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
  /** If set, only show assets of this type group */
  filterType?: 'image' | 'audio' | 'video' | 'all'
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function assetTypeGroup(mime: string): 'image' | 'audio' | 'video' | 'other' {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  return 'other'
}

const ICONS: Record<string, string> = {
  audio: '🔊',
  video: '🎬',
  other: '📄',
}

export function AssetPickerModal({ projectId, open, onClose, onSelect, filterType = 'all' }: Props) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [tab, setTab] = useState<'all' | 'image' | 'audio' | 'video'>(filterType === 'all' ? 'all' : filterType)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchAssets = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const { data } = await axios.get(`/api/projects/${projectId}/assets`)
      setAssets(data.assets ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) fetchAssets()
  }, [open, fetchAssets])

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        await axios.post(`/api/projects/${projectId}/assets`, fd)
      }
      await fetchAssets()
    } catch (err: any) {
      alert(err.response?.data?.error ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.name}"?`)) return
    setDeletingId(asset.id)
    try {
      await axios.delete(`/api/projects/${projectId}/assets/${asset.id}`)
      setAssets((prev) => prev.filter((a) => a.id !== asset.id))
    } catch {
      alert('Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = assets.filter((a) => {
    if (tab === 'all') return true
    return assetTypeGroup(a.mimetype) === tab
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#30363d]">
          <h2 className="text-sm font-semibold text-black dark:text-white">Asset Library</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-black dark:hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Tabs + Upload */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-[#30363d] gap-2">
          <div className="flex gap-1">
            {(['all', 'image', 'audio', 'video'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 text-xs capitalize rounded transition-colors ${tab === t ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,audio/*,video/*,.pdf,.json,.csv"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1 text-xs bg-black dark:bg-white text-white dark:text-black hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {uploading ? 'Uploading…' : '↑ Upload'}
            </button>
          </div>
        </div>

        {/* Asset grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-gray-400 text-sm py-12">Loading…</div>
          ) : filtered.length === 0 ? (
            <div
              className="border-2 border-dashed border-gray-300 dark:border-[#30363d] rounded p-10 text-center cursor-pointer hover:border-gray-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-3xl mb-2">📂</div>
              <p className="text-sm text-gray-500">No assets yet — click to upload</p>
              <p className="text-xs text-gray-400 mt-1">Images, audio, video, PDF, CSV · max 50 MB each</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filtered.map((asset) => {
                const tg = assetTypeGroup(asset.mimetype)
                return (
                  <div
                    key={asset.id}
                    className="relative group border border-gray-200 dark:border-[#30363d] rounded overflow-hidden cursor-pointer hover:border-black dark:hover:border-white transition-colors"
                    onClick={() => { onSelect(asset.url); onClose() }}
                  >
                    {/* Preview */}
                    <div className="w-full h-24 flex items-center justify-center bg-gray-50 dark:bg-[#0d1117]">
                      {tg === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={asset.url} alt={asset.name} className="w-full h-24 object-cover" />
                      ) : (
                        <span className="text-3xl">{ICONS[tg] ?? ICONS.other}</span>
                      )}
                    </div>
                    {/* Info */}
                    <div className="px-1.5 py-1">
                      <p className="text-[10px] text-gray-700 dark:text-gray-300 truncate">{asset.name}</p>
                      <p className="text-[9px] text-gray-400">{humanSize(asset.size)}</p>
                    </div>
                    {/* Delete button (hover) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(asset) }}
                      disabled={deletingId === asset.id}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] items-center justify-center hidden group-hover:flex hover:bg-red-600"
                    >
                      ×
                    </button>
                    {deletingId === asset.id && (
                      <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex items-center justify-center text-xs text-gray-500">Deleting…</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer with drag-drop hint */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-[#30363d] text-[11px] text-gray-400">
          Click an asset to use it · Hover to delete · Assets are stored in your project
        </div>
      </div>
    </div>
  )
}
