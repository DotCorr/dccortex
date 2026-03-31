/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import axios from 'axios'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function AcceptInvitationPage() {
  const params = useParams()
  const router = useRouter()
  const { status } = useSession()
  const token = params.token as string
  const [statusState, setStatusState] = useState<'loading' | 'success' | 'error' | 'needs-signup'>('loading')
  const [message, setMessage] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [invitationEmail, setInvitationEmail] = useState('')

  useEffect(() => {
    if (status === 'loading') return // Wait for session to load

    const loadInvitation = async () => {
      try {
        const inviteRes = await axios.get(`/api/invitations/${token}`)
        setOrganizationName(inviteRes.data?.invitation?.organizationName || '')
        setInvitationEmail(inviteRes.data?.invitation?.email || '')
        setStatusState('needs-signup')
      } catch (error: any) {
        setStatusState('error')
        setMessage(error.response?.data?.error || 'Failed to load invitation. The link may be expired or invalid.')
      }
    }

    const acceptInvitation = async () => {
      try {
        const res = await axios.post(`/api/invitations/${token}/accept`)
        setStatusState('success')
        setOrganizationName(res.data.organizationName)
        setMessage('You have successfully joined the organization!')
        
        // Redirect to organization page after 2 seconds
        setTimeout(() => {
          router.push(`/organizations/${res.data.organizationId}`)
        }, 2000)
      } catch (error: any) {
        setStatusState('error')
        setMessage(error.response?.data?.error || 'Failed to accept invitation. The link may be expired or invalid.')
      }
    }

    if (status === 'unauthenticated') {
      // Let invite recipients choose signup or login.
      loadInvitation()
      return
    }

    if (status === 'authenticated' && token) {
      acceptInvitation()
    }
  }, [token, status, router])

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d] p-8 sm:p-12 max-w-md w-full text-center">
          {statusState === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-gray-400" />
              <h2 className="text-xl font-medium text-black dark:text-white mb-2">Accepting invitation...</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Please wait while we add you to the organization.</p>
            </>
          )}

          {statusState === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <h2 className="text-xl font-medium text-black dark:text-white mb-2">Invitation Accepted!</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                You've successfully joined <strong>{organizationName}</strong>
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs">Redirecting to organization...</p>
            </>
          )}

          {statusState === 'needs-signup' && (
            <>
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-blue-500" />
              <h2 className="text-xl font-medium text-black dark:text-white mb-2">You've been invited!</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                You've been invited to join <strong>{organizationName}</strong>. Create an account to accept.
              </p>
              <div className="space-y-3">
                <Button asChild className="w-full">
                  <Link href={`/register?inviteToken=${token}&email=${encodeURIComponent(invitationEmail)}`}>
                    Create Account & Accept
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/login?callbackUrl=/invitations/${token}&inviteToken=${token}`}>
                    Already have an account? Sign in
                  </Link>
                </Button>
              </div>
            </>
          )}

          {statusState === 'error' && (
            <>
              <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <h2 className="text-xl font-medium text-black dark:text-white mb-2">Invitation Failed</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{message}</p>
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

