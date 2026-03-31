/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useState, useEffect } from 'react'
import { Settings, Zap, DollarSign, AlertTriangle, Rocket, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface ProjectSettingsProps {
  projectId: string
}

export function ProjectSettings({ projectId }: ProjectSettingsProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-3.5')
  const [usageLimit, setUsageLimit] = useState<number>(100)
  const [currentUsage, setCurrentUsage] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [models, setModels] = useState<any[]>([])
  const [project, setProject] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [verificationName, setVerificationName] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    // Load project data
    loadProject()
    // Load available models
    loadModels()
    // Load current usage
    loadUsage()
    // Load saved settings (legacy local fallback)
    const saved = localStorage.getItem(`project_settings_${projectId}`)
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        setSelectedModel(settings.model || 'claude-sonnet-3.5')
        setUsageLimit(settings.usageLimit || 100)
      } catch (e) {
        console.error('Failed to load saved settings:', e)
      }
    }
  }, [projectId])

  const loadProject = async () => {
    try {
      const response = await axios.get(`/api/projects/${projectId}`)
      const loadedProject = response.data.project
      setProject(loadedProject)

      // Prefer backend-persisted project settings when available
      const seoDefaults = loadedProject?.seoDefaults
      const persistedSettings = seoDefaults && typeof seoDefaults === 'object'
        ? (seoDefaults as Record<string, unknown>).projectSettings as Record<string, unknown> | undefined
        : undefined

      if (persistedSettings && typeof persistedSettings === 'object') {
        const model = persistedSettings.model
        const limit = persistedSettings.usageLimit
        if (typeof model === 'string' && model.trim()) {
          setSelectedModel(model)
        }
        if (typeof limit === 'number' && Number.isFinite(limit)) {
          setUsageLimit(limit)
        }
      }
    } catch (error) {
      console.error('Failed to load project:', error)
    }
  }

  const handleDeleteProject = async () => {
    if (!project || verificationName !== project.name) {
      return
    }

    setDeleting(true)
    try {
      await axios.delete(`/api/projects/${projectId}`, {
        data: { verificationName }
      })
      
      // Invalidate queries and redirect
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      router.push('/projects')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete project')
      setDeleting(false)
    }
  }

  const loadModels = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_PLATFORM_API_URL || 'http://localhost:3001'
      const response = await axios.get(`${apiUrl}/api/v1/usage/models`)
      if (response.data.success) {
        setModels(response.data.models || [])
      }
    } catch (error) {
      console.error('Failed to load models:', error)
      // Fallback to default models
      setModels([
        { id: 'auto', name: 'Auto (Intelligent Selection)', provider: 'gemini', inputCostPerMillion: 1.25, outputCostPerMillion: 5 },
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)', provider: 'gemini', inputCostPerMillion: 0.075, outputCostPerMillion: 0.3 },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini', inputCostPerMillion: 1.25, outputCostPerMillion: 5 },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini', inputCostPerMillion: 0.075, outputCostPerMillion: 0.3 },
        { id: 'gemini-nano', name: 'Gemini Nano', provider: 'gemini', inputCostPerMillion: 0.0375, outputCostPerMillion: 0.15 },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini', inputCostPerMillion: 1.25, outputCostPerMillion: 5 },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', inputCostPerMillion: 0.075, outputCostPerMillion: 0.3 },
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', provider: 'gemini', inputCostPerMillion: 0.0375, outputCostPerMillion: 0.15 },
      ])
    }
  }

  const loadUsage = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_PLATFORM_API_URL || 'http://localhost:3001'
      const response = await axios.get(`${apiUrl}/api/v1/usage/current-user/stats`, {
        params: { appId: projectId }
      })
      if (response.data && response.data.totalTokens !== undefined) {
        setCurrentUsage(response.data)
      }
    } catch (error) {
      console.error('Failed to load usage:', error)
      setCurrentUsage(null)
    }
  }

  const handleSaveSettings = async () => {
    setLoading(true)
    try {
      const settings = { model: selectedModel, usageLimit }

      // Persist project settings in backend metadata stored under seoDefaults.projectSettings
      const existingSeoDefaults = project?.seoDefaults && typeof project.seoDefaults === 'object'
        ? project.seoDefaults as Record<string, unknown>
        : {}
      const nextSeoDefaults = {
        ...existingSeoDefaults,
        projectSettings: settings,
      }

      await axios.put(`/api/projects/${projectId}`, {
        seoDefaults: nextSeoDefaults,
      })

      // Keep local cache for offline fallback
      localStorage.setItem(`project_settings_${projectId}`, JSON.stringify(settings))
      setProject((prev: any) => ({
        ...(prev ?? {}),
        seoDefaults: nextSeoDefaults,
      }))
      
      // Also update the editor's model selection
      window.dispatchEvent(new CustomEvent('modelChanged', { detail: { model: selectedModel } }))
      
      alert('Settings saved!')
    } catch (error) {
      alert('Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-2xl font-medium text-black">Project Settings</h2>
        
        {/* AI Model Selection */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={20} className="text-gray-600" />
            <h3 className="text-lg font-medium text-black">AI Model</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Choose the AI model for code generation. Premium models offer better quality but cost more.</p>
          
          <div className="space-y-2">
            {models.map((model) => (
              <label
                key={model.id}
                className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${
                  selectedModel === model.id
                    ? 'border-black bg-black/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="model"
                  value={model.id}
                  checked={selectedModel === model.id}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-4 h-4 text-black"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-black">{model.name}</span>
                    <span className={`text-xs px-2 py-0.5 ${
                      model.inputCostPerMillion >= 10 ? 'bg-purple-100 text-purple-700' :
                      model.inputCostPerMillion >= 3 ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {model.inputCostPerMillion >= 10 ? 'Premium' :
                       model.inputCostPerMillion >= 3 ? 'Standard' : 'Economy'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 capitalize">{model.provider}</span>
                    <span className="text-gray-400">
                      ${model.inputCostPerMillion}/M in, ${model.outputCostPerMillion}/M out
                    </span>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Usage Tracking */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={20} className="text-gray-600" />
            <h3 className="text-lg font-medium text-black">Usage & Limits</h3>
          </div>
          
          {currentUsage && currentUsage.totalTokens !== undefined ? (
            <div className="mb-4 space-y-3 border-b border-gray-200 pb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Tokens</span>
                <span className="font-mono text-sm text-black">{currentUsage.totalTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Cost</span>
                <span className="font-mono text-sm text-black">${(currentUsage.totalCost || 0).toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Operations</span>
                <span className="font-mono text-sm text-black">{currentUsage.operations || 0}</span>
              </div>
            </div>
          ) : (
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-sm text-gray-500">No usage data available yet</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-black">
              Usage Limit (USD per month)
            </label>
            <input
              type="number"
              value={usageLimit}
              onChange={(e) => setUsageLimit(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black"
              min="0"
              step="0.01"
            />
            <p className="text-xs text-gray-500">
              When this limit is reached, you'll be charged extra on top of your subscription.
            </p>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Free tier coming soon!</p>
                <p>We're working on free models that won't count towards your usage limit.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Deploy Section */}
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Rocket size={20} className="text-gray-600" />
            <h3 className="text-lg font-medium text-black">Deployment</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Deploy your project to a local container or custom domain.</p>
          <div className="space-y-3">
            <Button disabled className="w-full bg-gray-100 text-gray-400 cursor-not-allowed">
              <Rocket size={16} className="mr-2" />
              Deploy to Container (Coming Soon)
            </Button>
            <Button disabled className="w-full bg-gray-100 text-gray-400 cursor-not-allowed">
              Configure Custom Domain (Coming Soon)
            </Button>
          </div>
        </div>

        <Button onClick={handleSaveSettings} disabled={loading} className="w-full">
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>

        {/* Danger Zone */}
        <div className="bg-red-50 border border-red-200 p-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={20} className="text-red-600" />
            <h3 className="text-lg font-medium text-red-600">Danger Zone</h3>
          </div>
          <p className="text-sm text-red-700 mb-4">
            Once you delete a project, there is no going back. This will permanently delete:
          </p>
          <ul className="text-sm text-red-700 space-y-1 list-disc list-inside mb-4">
            <li>All project code and scripts</li>
            <li>All builds and generated files</li>
            <li>All deployment data</li>
            <li>All PM2 processes (if deployed)</li>
          </ul>
          <Button
            onClick={() => setDeleteDialogOpen(true)}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 size={16} className="mr-2" />
            Delete Project
          </Button>
        </div>
      </div>

      {/* Delete Project Verification Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{project?.name}</strong> and ALL related data:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 border border-red-200 p-4 rounded">
              <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                <li>All project code and scripts</li>
                <li>All builds and generated files</li>
                <li>All deployment data</li>
                <li>All PM2 processes (if deployed)</li>
              </ul>
              <p className="text-sm text-red-700 font-medium mt-3">
                This action cannot be undone!
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-black mb-2 block">
                Type the project name to confirm: <strong>{project?.name}</strong>
              </label>
              <Input
                type="text"
                placeholder={project?.name}
                value={verificationName}
                onChange={(e) => setVerificationName(e.target.value)}
                className="border-red-200 focus:border-red-400"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDeleteDialogOpen(false)
                  setVerificationName('')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={verificationName !== project?.name || deleting}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
