/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LoadingBar } from '@/components/ui/loading-bar'
import { Eye, EyeOff } from 'lucide-react'

const OIDC_LOGIN_ENABLED = process.env.NEXT_PUBLIC_ENABLE_OIDC_LOGIN === 'true'
const OIDC_LOGIN_LABEL = process.env.NEXT_PUBLIC_OIDC_LOGIN_LABEL || 'Continue with Enterprise SSO'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [callbackUrl, setCallbackUrl] = useState('/dashboard')

  // Video URL - served from public folder
  const videoUrl = '/auth_illu.mp4'

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const cb = params.get('callbackUrl')
    if (cb && cb.startsWith('/')) {
      setCallbackUrl(cb)
    }
  }, [])

  // Show OAuth error from URL (e.g. ?error=google or ?error=github)
  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const errorParam = params?.get('error')
    if (errorParam === 'google') setError('Google sign-in failed. Try again or use email/password.')
    else if (errorParam === 'github') setError('GitHub sign-in failed. Try again or use email/password.')
    else if (errorParam === 'oidc') setError('Enterprise SSO sign-in failed. Contact your admin or try again.')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        router.push(result?.url || callbackUrl)
      }
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = () => { void signIn('google', { callbackUrl }) }
  const handleGithubAuth = () => { void signIn('github', { callbackUrl }) }
  const handleOidcAuth = () => { void signIn('oidc', { callbackUrl }) }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background">
      {/* Invisible drag region for Tauri window dragging on pages without a header */}
      <div data-tauri-drag-region className="fixed top-0 left-0 right-0 h-7 z-50" />
      {/* Left Section - Login/Signup Form */}
      <div className="w-full lg:w-[70%] flex items-center justify-center p-6 sm:p-8 lg:p-16">
        <div className="w-full max-w-md">
          {/* Heading */}
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-foreground">Welcome!</h1>
          <p className="text-muted-foreground mb-6 sm:mb-8 text-sm sm:text-base">
            Please enter your details to login.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-foreground">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email address"
                className="w-full px-4 py-3 bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-12 bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-foreground text-background py-3.5 px-4 text-sm font-medium hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
            >
              {loading && (
                <div className="absolute inset-0">
                  <LoadingBar />
                </div>
              )}
              <span className="relative">Log In</span>
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-border"></div>
            <span className="px-4 text-sm text-muted-foreground">OR</span>
            <div className="flex-1 border-t border-border"></div>
          </div>

          {/* OAuth Buttons - POST with CSRF so NextAuth redirects to Google/GitHub */}
          <div className="space-y-3">
            {OIDC_LOGIN_ENABLED && (
              <button
                type="button"
                onClick={handleOidcAuth}
                className="w-full bg-card border border-border text-foreground py-3 px-4 text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-3"
              >
                {OIDC_LOGIN_LABEL}
              </button>
            )}

            <button
              type="button"
              onClick={handleGoogleAuth}
              className="w-full bg-card border border-border text-foreground py-3 px-4 text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <button
              type="button"
              onClick={handleGithubAuth}
              className="w-full bg-card border border-border text-foreground py-3 px-4 text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.27.098-2.647 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.377.202 2.394.1 2.647.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              Continue with GitHub
            </button>
          </div>

          {/* Sign up link */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account yet?{' '}
            <Link href="/register" className="text-foreground hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Desktop: Right Section - video only (frosted) */}
      <div className="hidden lg:flex lg:w-[30%] relative bg-background overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 blur-[5px] scale-110">
            <video autoPlay loop muted playsInline className="h-full w-full object-cover">
              <source src={videoUrl} type="video/mp4" />
            </video>
          </div>
        </div>
        <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px]" />
      </div>
    </div>
  )
}
