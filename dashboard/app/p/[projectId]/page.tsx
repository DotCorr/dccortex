/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import type { Metadata } from 'next'
import PreviewApp from './PreviewApp'
import { getCachedPublicProjectPayload } from '@/lib/public-project-cache'
import { getCachedRuntimeData } from '@/lib/public-runtime-cache'

export const metadata: Metadata = { title: 'App Preview' }

export default async function PublicPreviewPage({
  params,
}: any) {
  const { projectId } = params
  let initialProject: Awaited<ReturnType<typeof getCachedPublicProjectPayload>>['payload'] | null = null
  let initialData: Record<string, unknown> | null = null
  try {
    const [projectResult, dataResult] = await Promise.all([
      getCachedPublicProjectPayload(projectId),
      getCachedRuntimeData(projectId, {}),
    ])
    initialProject = projectResult.payload
    initialData = dataResult.data
  } catch {
    initialProject = null
    initialData = null
  }
  return <PreviewApp projectId={projectId} initialProject={initialProject} initialData={initialData} />
}
