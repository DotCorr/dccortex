/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useState, useEffect } from 'react'
import { Save, Settings as SettingsIcon, Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingBar } from '@/components/ui/loading-bar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function OrganizationSettingsPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const orgId = params.id as string
  const { theme, setTheme } = useTheme()

  const { data: orgData, isLoading } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      const res = await axios.get(`/api/organizations/${orgId}`)
      return res.data
    },
  })

  const [preferredLLM, setPreferredLLM] = useState('auto')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([])

  // Load settings from metadata
  useEffect(() => {
    if (orgData?.organization?.metadata) {
      const metadata = orgData.organization.metadata as any
      if (metadata.preferredLLM) setPreferredLLM(metadata.preferredLLM)
      if (metadata.geminiApiKey) setGeminiApiKey(metadata.geminiApiKey)
    }
  }, [orgData])
  
  // Fetch available models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_PLATFORM_API_URL || 'http://localhost:3001'
        const response = await axios.get(`${apiUrl}/api/v1/usage/models`)
        if (response.data.success && response.data.models) {
          setAvailableModels(response.data.models)
        } else {
          // Fallback
          setAvailableModels([
            { id: 'auto', name: 'Auto (Intelligent Selection)' },
            { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
            { id: 'gemini-nano', name: 'Gemini Nano' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
            { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
          ])
        }
      } catch (error) {
        // Fallback
        setAvailableModels([
          { id: 'auto', name: 'Auto (Intelligent Selection)' },
          { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
          { id: 'gemini-nano', name: 'Gemini Nano' },
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
          { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
        ])
      }
    }
    fetchModels()
  }, [])

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const res = await axios.put(`/api/organizations/${orgId}`, {
        name: orgData.organization.name,
        description: orgData.organization.description,
        metadata: {
          ...(orgData.organization.metadata || {}),
          ...settings,
        },
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] })
      alert('Settings saved!')
    },
  })

  const organization = orgData?.organization

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingBar fullPage />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen">
        <div className="px-6 lg:px-8 max-w-4xl mx-auto pt-24 pb-24">
          <Breadcrumb
            items={[
              { label: 'Organizations', href: '/dashboard' },
              { label: organization?.name || 'Organization', href: `/organizations/${orgId}` },
              { label: 'Settings' },
            ]}
          />

          <div className="mt-6 mb-8">
            <h1 className="text-4xl font-medium tracking-tighter text-black dark:text-white mb-2">
              Organization Settings
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-light">
              Configure AI preferences and project settings
            </p>
          </div>

          <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-8 space-y-8">
            {/* Appearance Settings */}
            <div>
              <h2 className="text-xl font-medium text-black dark:text-white mb-4 flex items-center gap-2">
                <SettingsIcon size={20} />
                Appearance
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Customize the appearance of the app.
              </p>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    Theme
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex items-center gap-2 px-4 py-2 border transition-colors ${
                        theme === 'light'
                          ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                          : 'bg-white text-black border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Sun size={16} />
                      Light
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex items-center gap-2 px-4 py-2 border transition-colors ${
                        theme === 'dark'
                          ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                          : 'bg-white text-black border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Moon size={16} />
                      Dark
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`flex items-center gap-2 px-4 py-2 border transition-colors ${
                        theme === 'system'
                          ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                          : 'bg-white text-black border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Monitor size={16} />
                      System
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Choose your preferred theme. This applies to all projects.
                  </p>
                </div>
              </div>
            </div>

            {/* AI Settings */}
            <div>
              <h2 className="text-xl font-medium text-black dark:text-white mb-4 flex items-center gap-2">
                <SettingsIcon size={20} />
                AI Settings
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                These settings apply to all AI features and projects.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    Preferred LLM Model
                  </label>
                  <Select value={preferredLLM} onValueChange={setPreferredLLM}>
                    <SelectTrigger className="border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.length > 0 ? (
                        availableModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="auto">Auto (Intelligent Selection)</SelectItem>
                          <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</SelectItem>
                          <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                          <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                          <SelectItem value="gemini-nano">Gemini Nano</SelectItem>
                          <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                          <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                          <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Default model used for AI assistance across the platform.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black dark:text-white mb-2">
                    Gemini API Key (Optional)
                  </label>
                  <Input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIza..."
                    className="border-gray-300"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Override organization-level API key for Gemini models. Leave empty to use platform default.
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-6 border-t border-gray-200">
              <Button
                onClick={() => {
                  updateSettingsMutation.mutate({
                    preferredLLM,
                    geminiApiKey: geminiApiKey || undefined,
                  })
                }}
                disabled={updateSettingsMutation.isPending}
                className="bg-black text-white hover:bg-gray-900"
              >
                <Save size={18} className="mr-2" />
                {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

