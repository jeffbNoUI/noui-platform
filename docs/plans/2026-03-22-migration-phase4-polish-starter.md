# Migration Phase 4: Polish & Merge Starter Prompt

## Context

Migration Management Frontend Phase 4 is complete on branch `claude/stupefied-jones`.
The full v2.0 UI enhancement has been implemented across **18 tasks, 36 files, +4,248 lines**.

### What Was Built in Phase 4

**Backend (14 new endpoints):**
- Phase gate management: advance, regress, gate-status, gate-history
- Attention queue: unified items, cross-engagement summary
- AI recommendation stubs: gate readiness, batch sizing, remediation, root cause
- Notifications: list, mark read, mark all read
- DB migrations: `033_gate_transition.sql`, `034_notification.sql`

**Frontend (12 new components + 9 enhanced):**
- Reusable AI components: AIRecommendationCard, CorpusIndicator, RootCauseAnalysis
- DiscoveryPanel: inline source connection + table selection (replaces dialog flow)
- PhaseGateDialog: gate metrics, AI recommendation, override controls, audit trail
- AttentionQueue: cross-cutting P1/P2/P3 unified view with filters and bulk actions
- ParallelRunPanel: Go/No-Go checklist for migration certification
- NotificationBell: top nav bell with dropdown notifications
- ComparativeView: stage-gated side-by-side engagement comparison
- PhaseStepper: updated to 7 phases with attention badges, gate tooltips, regression
- Phase panels enhanced: AI remediation (quality), corpus indicators (mapping), batch sizing (transformation), root cause (reconciliation)
- Dashboard: attention count card, risk de-duplication, health bar colors, connection details on cards

### Verification Status
- `npx tsc --noEmit` — ✅ Zero errors
- `npm run build` — ✅ Built in 5.46s
- `npm test -- --run` — ✅ 231 test files, 1,838 tests passing
- `go build ./...` — ✅ Clean build
- `go test ./... -short` — ✅ 11 packages passing
- Visual verification — ✅ Docker stack tested, Discovery panel flow confirmed

## What Needs Polish (3 Issues)

### 1. Title Truncation
- **File:** `frontend/src/components/migration/engagement/EngagementDetail.tsx`
- **Issue:** The engagement name in the header truncates too aggressively ("Retir..." for "RetireEase 3.1")
- **Fix:** Increase min-width for the title area, or use `flex-shrink: 0` on the status badge / connection indicator so the title gets more space

### 2. Default Tab for DISCOVERY Phase
- **File:** `frontend/src/components/migration/engagement/EngagementDetail.tsx`
- **Issue:** When opening an engagement in DISCOVERY phase, the default tab is "Quality Profile" instead of "Discovery"
- **Fix:** Verify the `defaultTab` function has `case 'DISCOVERY': return 'discovery';` and the useEffect fires correctly

### 3. Phase Stepper Overflow
- **File:** `frontend/src/components/migration/engagement/PhaseStepper.tsx`
- **Issue:** With 7 phases, steps 1-2 (Discover, Profile) scroll off-screen on narrower viewports
- **Fix:** Add `overflow-x: auto` to the stepper container, or reduce step circle size / connector width to fit within typical viewport widths

## After Polish: Merge Strategy

This branch should be merged via PR. Use `finishing-a-development-branch` skill.
- 19 commits on `claude/stupefied-jones`
- Design documents: `docs/plans/2026-03-21-migration-frontend-design.md` (v2.0) and `docs/plans/2026-03-21-migration-phase4-plan.md`
- Schema change: `db/migrations/030_migration_schema.sql` updated with DISCOVERY + new tables
- Docker: `docker-compose.yml` updated with migration SQL mounts

## Architecture Reference

- **Design doc:** `docs/plans/2026-03-21-migration-frontend-design.md` (v2.0 — authoritative)
- **Implementation plan:** `docs/plans/2026-03-21-migration-phase4-plan.md` (18 tasks — all complete)
- **Backend routes:** `platform/migration/api/handlers.go` — 30+ routes registered
- **Frontend types:** `frontend/src/types/Migration.ts` — includes Phase 4 types
- **API client:** `frontend/src/lib/migrationApi.ts` — 30+ API functions
- **React Query hooks:** `frontend/src/hooks/useMigrationApi.ts` + `useMigrationNotifications.ts`
- **AI components:** `frontend/src/components/migration/ai/` (3 reusable components)
- **Attention:** `frontend/src/components/migration/attention/` (cross-cutting queue)
- **Design system:** `frontend/src/lib/designSystem.ts` (C, BODY, DISPLAY, MONO)
