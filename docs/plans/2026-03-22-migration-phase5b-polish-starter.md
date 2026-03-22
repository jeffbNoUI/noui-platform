# Migration Phase 5b: Panel Polish + E2E Fix — Starter Prompt

## Context

Migration Phase 5 panel wiring is complete (PR #127). The four core panels are now
connected to real API data:

- **Quality Profile:** Fetches profiles via GET `/profiles`, displays radar chart + per-table
  scores, "Approve Quality Baseline" button with PATCH `/approve-baseline`
- **Transformation:** Batch list table with "+ Create Batch" dialog, click-through to BatchDetail
- **BatchDetail:** Full view with header stats, exception clusters (Apply Fix), exception table,
  Retransform/Reconcile action buttons
- **Mappings & Reconciliation:** Were already wired in Phase 4

### Stats (Phase 5)
- 7 commits, 14 files, +1,430 lines
- 6 new Go endpoints, 6 new API functions, 6 new React Query hooks
- 2 new components (CreateBatchDialog, BatchDetail)
- Go build clean, 1,838 frontend tests passing

## What Needs Doing (Phase 5b)

### 1. Polish Already-Wired Panels

**Mappings Panel — CorpusIndicator + Generate button:**
- `getMappingCorpusContext` API function exists but no hook or UI consumer
- `CorpusIndicator` component is imported but never receives data
- Add `useMappingCorpusContext(engagementId, mappingId)` lazy-load hook
- Add "Generate Mappings" button to MappingPanel (calls existing `useGenerateMappings` hook)
- Files: `useMigrationApi.ts`, `MappingPanel.tsx`

**Reconciliation Panel — TierFunnel integration:**
- `TierFunnel.tsx` component exists but is unused — ReconciliationPanel uses inline SVG gauge
- `useReconciliationByTier` hook exists and returns data
- Wire TierFunnel into ReconciliationPanel with real tier data
- Files: `ReconciliationPanel.tsx`, `TierFunnel.tsx`

### 2. Fix Pre-Existing E2E Failure

**Correspondence → CRM bridge test failure:**
- Fails on main AND on our branch — not a regression
- Test: `tests/e2e/correspondence_e2e.sh`, Test 3: "POST CRM interaction (CORRESPONDENCE)"
- Expected HTTP 201, got 400
- Likely a CRM service validation change that broke the E2E test fixture
- Investigate and fix so CI goes green

### 3. Flagged Technical Debt

**apiClient.ts enum normalization (CRITICAL for future work):**
- `apiClient.ts` line 17: `ENUM_FIELDS` set globally lowercases ALL `status` fields
- Migration types use UPPERCASE enums (DISCOVERY, PROFILING, etc.)
- Current fix: `select: normalizeEngagement` in React Query hooks
- This pattern must be applied to ANY future hook returning engagement data
- Options: (a) document the pattern, (b) refactor apiClient to be opt-in per service,
  (c) move normalization into the API function layer instead of hooks

### 4. Docker E2E Verification

- Rebuild Docker stack with new migration endpoints
- Run quality profile against real source tables
- Verify radar chart renders with actual ISO 8000 scores
- Advance engagement to TRANSFORMING, create batch, verify batch list + detail

## Architecture Reference

- **Design doc:** `docs/plans/2026-03-22-migration-phase5-panel-wiring-design.md`
- **Implementation plan:** `docs/plans/2026-03-22-migration-phase5-panel-wiring.md`
- **Frontend types:** `frontend/src/types/Migration.ts`
- **API client:** `frontend/src/lib/migrationApi.ts` (36+ functions)
- **React Query hooks:** `frontend/src/hooks/useMigrationApi.ts` (30+ hooks)
- **Backend handlers:** `platform/migration/api/handlers.go` (50+ routes)
- **Design system:** `frontend/src/lib/designSystem.ts` (C, BODY, DISPLAY, MONO)

## Important Patterns

1. **Enum normalization:** Use `select: normalizeEngagement` in any React Query hook returning
   engagement data (see `useMigrationApi.ts` line 43-45)
2. **WebSocket events:** Use `useMigrationEvents(engagementId)` hook
3. **Phase gating:** TransformationPanel gates on `TRANSFORMING` status
4. **Empty array normalization:** All list handlers return `[]` not `null`
5. **Pre-commit hook:** `.husky/pre-commit` runs lint-staged + Go tests + frontend typecheck +
   tests. Must have `#!/bin/sh` shebang and LF line endings.
