/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export default function ProjectScreensPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.id as string
  const projectId = params.projectId as string
  const createAttemptedRef = useRef(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['screens', projectId],
    queryFn: async () => {
      const res = await axios.get(`/api/projects/${projectId}/screens`)
      return res.data
    },
    retry: 1,
  })

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (data?.screens && data.screens.length > 0) {
      const indexScreen = data.screens.find((s: any) => s.slug === 'index')
      const screenId = indexScreen?.id || data.screens[0].id
      router.replace(`/organizations/${orgId}/projects/${projectId}/screens/${screenId}/edit`)
      return
    }

    if (createAttemptedRef.current) return
    createAttemptedRef.current = true

    const createDefaultScreen = async () => {
      try {
        const { data: created } = await axios.post(`/api/projects/${projectId}/screens`, {
          name: 'Home',
          slug: 'index',
          layout: { id: 'root', type: 'container', props: {}, children: [] },
        })
        const createdId = created?.screen?.id
        if (createdId) {
          router.replace(`/organizations/${orgId}/projects/${projectId}/screens/${createdId}/edit`)
          return
        }
      } catch (error: any) {
        if (error?.response?.status !== 409) {
          console.error('[ProjectScreensPage] Failed to create default screen:', error)
        }
      }

      try {
        const { data: fallback } = await axios.get(`/api/projects/${projectId}/screens`)
        const screens = Array.isArray(fallback?.screens) ? fallback.screens : []
        if (screens.length > 0) {
          const indexScreen = screens.find((s: any) => s.slug === 'index')
          const screenId = indexScreen?.id || screens[0].id
          router.replace(`/organizations/${orgId}/projects/${projectId}/screens/${screenId}/edit`)
          return
        }
      } catch (fallbackError) {
        console.error('[ProjectScreensPage] Failed to reload screens after creation attempt:', fallbackError)
      }

      router.replace('/dashboard')
    }

    void createDefaultScreen()
  }, [data, isLoading, isError, orgId, projectId, router])

  return null
}