/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * GitHub OAuth Callback Handler
 * 
 * Callback URL: http://localhost:3000/api/auth/github/callback
 * (or https://yourdomain.com/api/auth/github/callback in production)
 */

import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state') // projectId
  const error = searchParams.get('error')

  // Handle OAuth errors from GitHub
  if (error) {
    console.error('GitHub OAuth error:', error)
    const redirectUrl = state 
      ? new URL(`/projects/${state}/editor?error=github_auth_failed&error_description=${encodeURIComponent(error)}`, req.url)
      : new URL(`/dashboard?error=github_auth_failed`, req.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Validate we have the authorization code
  if (!code) {
    console.error('No authorization code received from GitHub')
    const redirectUrl = state
      ? new URL(`/projects/${state}/editor?error=no_code`, req.url)
      : new URL(`/dashboard?error=no_code`, req.url)
    return NextResponse.redirect(redirectUrl)
  }

  try {
    // Exchange code for access token
    // Use NEXT_PUBLIC_GITHUB_CLIENT_ID (same as client uses) or GITHUB_CLIENT_ID
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID
    const clientSecret = process.env.GITHUB_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('GitHub OAuth credentials not configured')
      return NextResponse.redirect(
        new URL(`/projects/${state}/editor?error=config_missing`, req.url)
      )
    }

    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    )

    const { access_token } = tokenResponse.data

    if (!access_token) {
      return NextResponse.redirect(
        new URL(`/projects/${state}/editor?error=no_token`, req.url)
      )
    }

    // Store token in localStorage via redirect with token in URL (will be handled client-side)
    // In production, store this server-side in a database
    const redirectUrl = new URL(`/projects/${state}/editor`, req.url)
    redirectUrl.searchParams.set('github_token', access_token)
    redirectUrl.searchParams.set('github_connected', 'true')

    return NextResponse.redirect(redirectUrl)
  } catch (error: any) {
    console.error('GitHub OAuth error:', error)
    return NextResponse.redirect(
      new URL(`/projects/${state}/editor?error=oauth_error`, req.url)
    )
  }
}

