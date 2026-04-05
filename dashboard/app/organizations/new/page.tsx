/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { LoadingBar } from '@/components/ui/loading-bar'

export default function NewOrganizationPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post('/api/organizations', formData, {
        timeout: 15000,
      })
      router.push(`/organizations/${response.data.organization.id}`)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-white dark:bg-[#0d1117] flex flex-col items-center justify-start pt-12 pb-24 px-6">
        <div className="w-full max-w-md mx-auto">
          <Link
            href="/organizations"
            className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white mb-8 transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            Back to Organizations
          </Link>

          <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-8 shadow-sm">
            <h1 className="text-2xl font-medium text-black dark:text-white mb-1">
              Create Organization
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Start a new organization to collaborate with your team. It should appear immediately, while background provisioning finishes in parallel.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-black dark:text-white mb-1.5">
                  Organization name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 dark:border-[#30363d] focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white bg-white dark:bg-[#0d1117] placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  placeholder="My Organization"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-black dark:text-white mb-1.5">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-[#30363d] focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white bg-white dark:bg-[#0d1117] placeholder:text-gray-500 dark:placeholder:text-gray-400 resize-none"
                  placeholder="What is this organization for?"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-black dark:bg-white text-white dark:text-black py-3 px-4 text-sm font-medium hover:bg-gray-900 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                >
                  {loading && (
                    <div className="absolute inset-0">
                      <LoadingBar />
                    </div>
                  )}
                  Create Organization
                </button>
                <Link
                  href="/organizations"
                  className="flex-shrink-0 px-4 py-3 border border-gray-200 dark:border-[#30363d] bg-white dark:bg-[#161b22] text-black dark:text-white text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#1c2128] transition-colors text-center inline-flex items-center justify-center"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

