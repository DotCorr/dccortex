/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

/**
 * Layout for the public preview route (/p/[projectId]).
 * Forces html + body to have an explicit height so that percentage heights
 * in the user's app (e.g. height: 100% on the root container) resolve to
 * the viewport height — matching how they behave inside the builder editor.
 */
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Scoped to this route only — does not affect the rest of the dashboard */}
      <style>{`html, body { height: 100%; overflow: hidden; }`}</style>
      {children}
    </>
  )
}
