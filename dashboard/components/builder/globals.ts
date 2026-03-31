/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import type { Node } from './registry'
import type { CustomTypeDef, ScreenTheme, StateDefinition } from './PropertyPanel'

export type ReusablePropSchema = {
  key: string
  type: 'string' | 'number' | 'boolean'
  defaultValue?: string
  /** When true, placing the reusable requires this prop to be set. */
  required?: boolean
}

export type ReusableDefinition = {
  id: string
  name: string
  root: Node
  propsSchema?: ReusablePropSchema[]
  createdAt?: string
  updatedAt?: string
}

export type BuilderGlobals = {
  globalReusables: ReusableDefinition[]
  globalStateDefinitions: StateDefinition[]
  globalCustomTypes?: CustomTypeDef[]
  globalTheme?: ScreenTheme
  builderPackages?: BuilderPackageEntry[]
}

export type BuilderPackageScope = 'project' | 'organization' | 'public'

export type BuilderPackageEntry = {
  id: string
  name: string
  imageUrl?: string
  sourceUrl: string
  resolvedUrl?: string
  version?: string
  scope: BuilderPackageScope
  installedAt?: string
}

export const EMPTY_BUILDER_GLOBALS: BuilderGlobals = {
  globalReusables: [],
  globalStateDefinitions: [],
  globalCustomTypes: [],
  globalTheme: {},
  builderPackages: [],
}
