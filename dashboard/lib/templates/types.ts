/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/** A self-contained project template that can be imported from the organisation page. */
export type ProjectTemplate = {
  /** Human-readable name shown in the gallery */
  name: string
  description: string
  /** Emoji or short icon string shown in the gallery card */
  icon: string
  /** Short phrase that categorises the template (e.g. "Weather · Open API") */
  tags: string[]
  /** One screen created per entry */
  screens: Array<{
    name: string
    slug: string
    /** Full screen layout object (stateDefinitions, theme, root, …) */
    layout: unknown
  }>
  /** External REST API sources to create for this project */
  apiSources?: Array<{
    name: string        // binding key: {{data.NAME}}
    url: string
    method: string      // GET | POST | …
    authType: string    // none | bearer | basic | apiKey
    authValue?: string
    authHeader?: string
    headers?: Record<string, string>
    body?: string
    schema?: unknown
  }>
  /**
   * Internal DB tables to seed.
   * The template creator bootstraps: datasource → table per entry → columns → rows.
   */
  dbSetup?: {
    tables: Array<{
      name: string
      columns: Array<{ name: string; type: string; sortOrder: number }>
      rows: Array<Record<string, unknown>>
    }>
  }
}
