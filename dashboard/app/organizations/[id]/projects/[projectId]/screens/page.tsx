/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LoadingBar } from '@/components/ui/loading-bar'

export default function ProjectScreensPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.id as string
  const projectId = params.projectId as string

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
      return; // Wait for the query to finish
    }

    if (data?.screens && data.screens.length > 0) {
      const indexScreen = data.screens.find((s: any) => s.slug === 'index');
      const screenId = indexScreen?.id || data.screens[0].id;
      router.replace(`/organizations/${orgId}/projects/${projectId}/screens/${screenId}/edit`);
    } else if (!isLoading) {
      // If there are no screens and we are not loading, it implies a new project.
      // The user should be redirected to the editor to create the first screen.
      // We can't create a screen here, but we can redirect to a URL that implies creation.
      // For now, we'll just redirect to the base editor URL. The editor page itself
      // should handle the "no screens" case gracefully.
      router.replace(`/organizations/${orgId}/projects/${projectId}/screens/new/edit`);
    }
  }, [data, isLoading, isError, orgId, projectId, router]);

  return (
    <DashboardLayout>
      <div className="flex h-full w-full items-center justify-center">
        <LoadingBar />
        <p className="text-sm text-gray-500">Loading screens...</p>
      </div>
    </DashboardLayout>
  )
}