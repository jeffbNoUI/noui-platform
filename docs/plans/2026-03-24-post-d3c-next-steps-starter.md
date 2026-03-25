# Session Starter: Post D3-C — Next Steps

## Context

Session 38 completed **Deliverable 3C — Zero-Contribution Member Handling**. The migration pipeline now supports employer-paid contribution models:

1. **Engagement-level flag**: `contribution_model` column on `migration.engagement` — values `standard` (default) or `employer_paid`
2. **Transformer skip**: `ValidateConstraintsHandler` records lineage instead of `MISSING_REQUIRED` exception when `ee_amount` is NULL in employer-paid systems
3. **Vocabulary**: 2 new false cognate entries in `contribution-accounts/accumulated_balance` (MEDIUM risk) warning about zero-balance employer-paid systems (Nevada PERS EPC, Utah RS Tier 1)
4. **Frontend**: Blue info badge on MappingPanel `ee_amount` rows when `contribution_model === 'employer_paid'`

Total: 11 packages pass (Go), 1865 tests across 236 files (frontend). Vocabulary at 468 ExpectedNames.

## What to Read First

1. `BUILD_HISTORY.md` — Session 38 entry
2. `docs/plans/2026-03-24-d3c-zero-contribution-design.md` — design decisions
3. `platform/migration/transformer/handlers.go` — ValidateConstraintsHandler employer-paid skip (search for "employer_paid")
4. `platform/migration/db/engagement.go` — `UpdateContributionModel` function
5. `frontend/src/components/migration/engagement/MappingPanel.tsx` — info badge rendering

## Option A: Engagement Settings UI — Contribution Model Selector

The `contribution_model` field is settable via API but has no dedicated UI control. The analyst currently has no way to set it without API calls.

**What to build:**
- Engagement setup/settings panel with a `contribution_model` dropdown ("Standard" / "Employer-paid")
- Should be settable during DISCOVERY or PROFILING phases, locked after MAPPING begins
- Wire to `PATCH /api/v1/migration/engagements/{id}` with `{ contribution_model: "employer_paid" }`

**Files likely touched:**
- `frontend/src/components/migration/engagement/DiscoveryPanel.tsx` or new EngagementSettingsPanel
- `frontend/src/hooks/useMigrationApi.ts` — `useUpdateEngagement` mutation
- Tests for the new UI

## Option B: Data Quality Check Suppression

The design doc identified DQ check suppression as Layer 4. The DQ service (`platform/dataquality/`) has rules that flag zero-accumulated-balance members as completeness issues. These should be suppressed when `contribution_model = employer_paid`.

**What to build:**
- DQ check reads engagement's `contribution_model`
- When `employer_paid`, skip zero-balance completeness check
- Suppression is logged ("Suppressed: employer-paid system"), not silent

**Files likely touched:**
- `platform/dataquality/` — check suppression logic
- API call to fetch engagement contribution_model
- Tests for suppressed vs. non-suppressed behavior

## Option C: Frontend — Mapping Panel Enhancements from D3-B

The new dual-service and FAC slots from D3-B could benefit from:
- Visual grouping: "Service Credit Split" section showing eligibility vs. benefit service side-by-side
- FAC metadata display: Show window months and anti-spiking cap when matched
- Metadata annotation display: Surface the TMRS benefit model warning in the UI

## Option D: Sprint 13 — Next Deliverable

Check `docs/specs/SPRINT_PLAN.md` for Sprint 13 deliverables beyond the glossary chain.

## Verification Gate

- Go migration: 11/11 packages pass (short mode)
- Frontend: 236 test files, 1865 tests pass
- Frontend: typecheck clean
