/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Legacy backend/frontend segment route.
 * Redirects to the no-code builder (screens).
 */
export default function OrganizationProjectSegmentPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.id as string
  const projectId = params.projectId as string

  useEffect(() => {
    router.replace(`/organizations/${orgId}/projects/${projectId}/screens`)
  }, [orgId, projectId, router])

  return null
}
