# Migration Phase 5: Panel Wiring Starter Prompt

## Context

Migration Management Phases 2–4 are complete and merged. The full migration management
system now has:

- **Backend:** 30+ API endpoints across migration, intelligence, and source connection
- **Frontend:** Full v2.0 UI with 7-phase stepper, 8 tab panels, 12+ components
- **Infrastructure:** SQL Server + PostgreSQL source drivers, WebSocket hub, 4 DB migrations

### What's Built and Working
- **Dashboard:** Summary cards, engagement list with pagination, risk panel, system health bar (color-coded), notification bell, attention count card
- **Engagement Detail:** 7-phase stepper with gate tooltips, 8 tabs (Discovery, Quality Profile, Mappings, Transformation, Reconciliation, Parallel Run, Risks, Attention)
- **Discovery Panel:** Inline source connection, table discovery (85 tables from live DB), table selection with checkboxes
- **Phase Gate Dialog:** Gate metrics, AI recommendation stub, override controls, audit trail
- **Attention Queue:** Cross-cutting P1/P2/P3 unified view with filters and bulk actions
- **Comparative View:** Stage-gated side-by-side engagement comparison
- **Parallel Run Panel:** Go/No-Go certification checklist
- **AI Components:** AIRecommendationCard, CorpusIndicator, RootCauseAnalysis (reusable)
- **Activity Log:** Paginated, WebSocket with polling fallback

### Known Fix Applied This Session
- **Enum case mismatch:** `apiClient.ts` globally lowercases all `status` fields for CRM/case services. Migration types use UPPERCASE. Fixed by adding `select: normalizeEngagement` in React Query hooks (`useMigrationApi.ts`). This pattern should be applied to any future migration hooks that return engagement data.

## What Needs Wiring (Phase 5)

The panels exist but several show placeholder/stub content. The backend endpoints exist.
The wiring is connecting real API data to the panel UIs.

### 1. Quality Profile Panel — Wire Real Data
- **Current state:** Shows "Ready to Profile" with Run Profile button, but profiling results aren't wired back
- **Backend endpoints:** `POST /engagements/:id/profile` (run), profiles stored on engagement
- **Todo:** After profiling completes, display radar chart with real ISO 8000 scores, per-table breakdown, "Approve Baseline" button that PATCHes `quality_baseline_approved_at`
- **Files:** `QualityProfilePanel.tsx`, `RunProfileDialog.tsx`, `migrationApi.ts`

### 2. Mapping Panel — Wire Field Mappings
- **Current state:** Basic structure exists but field mapping table is placeholder
- **Backend endpoints:** `GET /engagements/:id/mappings`, `PUT /mappings/:id` (approve/reject), `POST /engagements/:id/generate-mappings`, `GET /engagements/:id/code-mappings`
- **Todo:** Show real field mappings with agreement badges (AGREED/DISAGREED/TEMPLATE_ONLY/SIGNAL_ONLY), inline approve/reject, "Generate Mappings" button, agreement summary bar, code table section
- **Files:** `MappingPanel.tsx`, `migrationApi.ts`, `useMigrationApi.ts`

### 3. Transformation Panel — Wire Batch Management
- **Current state:** Basic structure exists
- **Backend endpoints:** `POST /engagements/:id/batches` (create), `GET /engagements/:id/batches` (list), `GET /batches/:id` (detail), `POST /batches/:id/retransform`
- **Todo:** Create Batch dialog (select scope from mapped tables), batch list with real progress bars, WebSocket-driven progress updates, click-through to batch detail view (row browser, lineage, exceptions)
- **Files:** `TransformationPanel.tsx`, `BatchDetail.tsx` (new), `migrationApi.ts`

### 4. Reconciliation Panel — Wire Gate Score + Tier Funnel
- **Current state:** Basic structure with placeholder charts
- **Backend endpoints:** `GET /engagements/:id/reconciliation`, `GET /engagements/:id/reconciliation/detail`, `POST /engagements/:id/reconciliation/run`
- **Todo:** Wire GateScoreGauge to real weighted gate score, TierFunnel to real tier breakdown, P1 items table with correction proposals, "Run Reconciliation" button
- **Files:** `ReconciliationPanel.tsx`, `GateScoreGauge.tsx`, `TierFunnel.tsx`, `migrationApi.ts`

### 5. Exception Triage — Wire to Clusters + Resolutions
- **Backend endpoints:** `GET /engagements/:id/exception-clusters`, `POST /exception-clusters/:id/apply`
- **Todo:** P1 individual exception cards with resolution workflow, P2/P3 AI-clustered groups with bulk actions (Apply All, Review, Exclude, Defer), exception detail with source row data
- **Note:** This may fit into the Transformation panel's batch detail view

## Architecture Reference

- **Design doc:** `docs/plans/2026-03-21-migration-frontend-design.md` (v2.0 — authoritative)
- **Backend routes:** `platform/migration/api/handlers.go` — 30+ routes registered
- **Frontend types:** `frontend/src/types/Migration.ts` — full Phase 4 types
- **API client:** `frontend/src/lib/migrationApi.ts` — 30+ API functions
- **React Query hooks:** `frontend/src/hooks/useMigrationApi.ts` — includes normalizeEngagement
- **AI components:** `frontend/src/components/migration/ai/` (3 reusable)
- **Design system:** `frontend/src/lib/designSystem.ts` (C, BODY, DISPLAY, MONO)

## Important Patterns

1. **Enum normalization:** Use `select: normalizeEngagement` in any React Query hook returning engagement data (see `useMigrationApi.ts`)
2. **WebSocket events:** Use `useMigrationEvents(engagementId)` hook — provides `connected`, `events`, `useFallback`
3. **Activity log:** Events auto-appear via WebSocket or polling fallback
4. **Phase gating:** Use `PhaseGateDialog` for phase transitions — includes AI readiness check stubs
5. **Pre-commit hook:** `.husky/pre-commit` runs lint-staged + Go tests + frontend typecheck + tests. Must have `#!/bin/sh` shebang and LF line endings.
