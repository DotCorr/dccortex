# UI Runtime + Next.js Codegen Feasibility

## Decision Question
Can DCCortex move toward generating pure Next.js code while preserving:
- runtime events
- bindings
- animations
- workflow-style actions
- AI predictability for future app generation

## Short Answer
Yes, with a hybrid architecture.

Do not replace JSON layout/runtime state as source of truth yet.
Treat JSON as the canonical intermediate representation (IR), and add deterministic Next.js code generation on top.

This keeps existing progress (events, bindings, animations, live preview) while enabling exportable code and better AI code generation ergonomics.

## What The Current System Is (Today)
Current implementation is already a Next.js runtime interpreter over JSON layout/state:
- Screen layout is stored as JSON in database (`AppScreen.layout`)
- Screen script is stored as text (`AppScreen.script`)
- Public preview renders through Next.js React components
- Bindings are resolved at runtime (`{{state.*}}`, `{{data.*}}`, `{{script.*}}`, etc.)
- Event actions run through normalized event config
- Animation sequences are executed in the frontend runtime

Key code paths:
- Screen storage model: `dashboard/prisma/schema.prisma`
- Screen update/read API: `dashboard/app/api/projects/[id]/screens/[screenId]/route.ts`
- Migration/versioned layout shape: `dashboard/lib/layout-migration.ts`
- Public runtime shell: `dashboard/app/p/[projectId]/page.tsx`
- Runtime app execution: `dashboard/app/p/[projectId]/PreviewApp.tsx`
- Binding resolution: `dashboard/components/builder/bindingResolver.ts`
- Event normalization/types: `dashboard/components/builder/eventHelpers.ts`
- Animation runtime execution: `dashboard/components/builder/animationSequenceExecutor.ts`
- Registry introspection endpoint: `dashboard/app/api/runtime-registry/route.ts`

## Risk If You Fully Switch To Direct Codegen Now
If you immediately abandon runtime JSON interpretation and only emit ad-hoc code:
1. You lose live editing determinism (builder currently depends on mutable JSON tree + sync).
2. Event compatibility can drift quickly (editor and runtime currently share event semantics).
3. Animation behavior can diverge between builder preview and generated app.
4. AI-generated code quality may become inconsistent without a strict schema/IR contract.
5. Rollback/versioning becomes harder (today you can store/replay layout JSON snapshots).

## Recommended Architecture (Hybrid)
1. Keep JSON layout + event config as canonical IR.
2. Introduce deterministic codegen pipeline:
   - IR -> typed AST -> Next.js files
3. Share one runtime kernel package between:
   - interpreted mode (current preview)
   - generated mode (exported Next.js app)
4. Add conformance tests to ensure interpreted and generated behavior match.

## Runtime Kernel To Extract
Create a shared runtime package (`packages/runtime-kernel`) for:
- binding resolver
- event condition evaluator
- event action execution semantics
- animation sequence contract
- data source variable interpolation logic

This package must be the single source of truth used by both runtime modes.

## Codegen Scope (MVP)
Start with export-first, not replace-first.

Phase 1 (safe):
- Generate React component files from JSON tree
- Preserve component registry mapping
- Emit bindings as helper calls into runtime kernel
- Emit event handlers mapped from `EventActionConfig`
- Emit CSS/style objects from existing prop-to-style logic

Phase 2:
- Generate route/page structure from project screens
- Generate typed state model from `stateDefinitions`
- Generate named script wrappers and imports
- Generate workflow/action stubs

Phase 3:
- Make generated app runnable standalone
- Add optional "detach mode" where runtime DB is no longer required

## Conformance Strategy (Critical)
For each component and action type, run test pairs:
- Interpreted result (current preview runtime)
- Generated result (exported Next.js)

Assertions:
- same rendered text/content
- same style tokens
- same event side effects
- same animation start/stop/tick semantics
- same data binding outputs

Use existing exhaustive component tests as a baseline and execute in dual mode.

## AI Generation Implications
This architecture improves AI reliability because:
- AI targets a strict IR schema instead of arbitrary code
- AI can still generate code through deterministic transpilation
- behavior remains predictable due to shared runtime kernel
- generated code remains editable by humans

## What This Involves (Concrete Work)
1. Package extraction
- Move binding/event/animation logic into a shared runtime module.

2. Typed IR contract
- Freeze a versioned IR schema for nodes, actions, screen metadata.

3. Generator implementation
- Build `ir-to-nextjs` generator with stable templates.

4. Test harness
- Add interpreted vs generated parity tests for all components/events.

5. Export UX
- Add dashboard action: "Export Next.js App".

6. Incremental rollout
- Keep current runtime as default.
- Offer generated mode as opt-in until parity is proven.

## Recommendation
Proceed with hybrid architecture now.

Do not do a hard cut from JSON-runtime to direct code-only generation.
The hybrid path preserves current momentum, supports workflows/events/animations, and gives you a stronger AI-generation future with lower regression risk.
