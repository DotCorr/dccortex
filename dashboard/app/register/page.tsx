/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { LoadingBar } from '@/components/ui/loading-bar'
import axios from 'axios'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('inviteToken')
  const inviteEmail = searchParams.get('email')

  const [formData, setFormData] = useState({
    name: '',
    email: inviteEmail || '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (inviteEmail) {
      setFormData((prev) => ({ ...prev, email: inviteEmail }))
    }
  }, [inviteEmail])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post('/api/auth/register', formData)

      if (response.data.success) {
        if (inviteToken) {
          const result = await signIn('credentials', {
            email: formData.email,
            password: formData.password,
            redirect: false,
          })

          if (result?.ok) {
            try {
              await axios.post(`/api/invitations/${inviteToken}/accept`)
              router.push(`/organizations/${(await axios.get(`/api/invitations/${inviteToken}`)).data.invitation.organizationId}`)
            } catch {
              router.push('/dashboard')
            }
          } else {
            router.push(`/login?callbackUrl=/invitations/${inviteToken}&inviteToken=${inviteToken}`)
          }
        } else {
          router.push('/login?registered=true')
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d1117] flex flex-col items-center justify-start pt-12 pb-24 px-6">
      <div data-tauri-drag-region className="fixed top-0 left-0 right-0 h-7 z-50" />
      <div className="w-full max-w-md mx-auto">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white mb-8 transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Back to Sign in
        </Link>

        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-8 shadow-sm">
          <h1 className="text-2xl font-medium text-black dark:text-white mb-1">
            Create account
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            Get started with DCCortex. Build no-code apps after you sign in.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-black dark:text-white mb-1.5">
                Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-[#30363d] focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white bg-white dark:bg-[#0d1117] placeholder:text-gray-500 dark:placeholder:text-gray-400"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-black dark:text-white mb-1.5">
                Email *
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-[#30363d] focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white bg-white dark:bg-[#0d1117] placeholder:text-gray-500 dark:placeholder:text-gray-400"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-black dark:text-white mb-1.5">
                Password *
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
                className="w-full px-4 py-3 border border-gray-300 dark:border-[#30363d] focus:outline-none focus:border-black dark:focus:border-white text-black dark:text-white bg-white dark:bg-[#0d1117] placeholder:text-gray-500 dark:placeholder:text-gray-400"
                placeholder="Minimum 8 characters"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Minimum 8 characters</p>
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
                Create account
              </button>
              <Link
                href="/login"
                className="inline-flex items-center justify-center border border-gray-300 dark:border-[#30363d] text-black dark:text-white py-3 px-4 text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#21262d] transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-black dark:text-white hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  )
}
