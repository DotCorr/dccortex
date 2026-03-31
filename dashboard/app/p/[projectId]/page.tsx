/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import type { Metadata } from 'next'
import PreviewApp from './PreviewApp'

export const metadata: Metadata = { title: 'App Preview' }

export default async function PublicPreviewPage({
  params,
}: {
  params: Promise<{ projectId: string }> | { projectId: string }
}) {
  const { projectId } = await Promise.resolve(params)
  return <PreviewApp projectId={projectId} />
}
