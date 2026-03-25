# D3-C Design: Zero-Contribution Member Handling

**Date:** 2026-03-24
**Status:** Approved
**Effort:** 0.5 session

## Problem

Nevada PERS (EPC) and Utah RS (Tier 1 noncontributory) have members with full pension eligibility but zero employee contributions. The current system treats zero/NULL `ee_amount` as a validation error (`MISSING_REQUIRED`) and flags zero-balance members as data quality issues. Both are false positives for employer-paid systems.

## Design

### Signal: Engagement-Level `contribution_model`

Single source of truth: `contribution_model` column on `migration.engagement`.

- `standard` (default) — employee + employer contributions expected
- `employer_paid` — zero employee contributions are legitimate

Set once per engagement by the analyst during setup. All downstream layers read from it.

### Layer 1: Data Model

Migration 032 adds `contribution_model VARCHAR(20) DEFAULT 'standard'` to `migration.engagement` with CHECK constraint.

### Layer 2: Transformer — Context-Aware Validation

- Add `ContributionModel string` to `TransformContext`
- `ValidateConstraintsHandler`: when `ContributionModel == "employer_paid"` and column is `ee_amount`, skip the required-NULL check. Record lineage entry instead of exception.
- All other required fields remain enforced.

### Layer 3: Vocabulary — False Cognate Warning

New entry in `contribution-accounts` section for `accumulated_contributions` / `accumulated_balance` warning: employer-paid systems show zero balances by design, not data error.

### Layer 4: Data Quality — Check Suppression

When `contribution_model = employer_paid`, suppress the zero-accumulated-balance completeness check. Suppression is logged ("Suppressed: employer-paid system"), not silent.

### Layer 5: Frontend

- **Engagement form**: `contribution_model` dropdown — "Standard" / "Employer-paid"
- **MappingPanel**: Blue info badge on `ee_amount` row when `employer_paid`: "Employer-paid system — zero employee contributions expected"

### Tests

- Transformer: `ee_amount = nil` + `employer_paid` → no exception, lineage recorded
- Transformer: `ee_amount = nil` + `standard` → `MISSING_REQUIRED` (existing behavior)
- Vocabulary: false cognate count updated
- Frontend: info badge renders when `contribution_model === 'employer_paid'`

## Files (~10)

| File | Change |
|------|--------|
| `db/migrations/032_contribution_model.sql` | ALTER TABLE add column |
| `platform/migration/transformer/pipeline.go` | `ContributionModel` on TransformContext |
| `platform/migration/transformer/handlers.go` | Conditional skip in ValidateConstraints |
| `platform/migration/transformer/handlers_test.go` | 2 new tests |
| `platform/migration/mapper/vocabulary.yaml` | New false cognate entry |
| `platform/migration/mapper/vocabulary_test.go` | Updated count |
| `platform/migration/api/engagement_handlers.go` | Accept/return contribution_model |
| `frontend/src/types/Migration.ts` | contribution_model field |
| `frontend/src/components/migration/engagement/MappingPanel.tsx` | Info badge |
| `frontend/src/components/migration/engagement/__tests__/MappingPanel.test.tsx` | Badge test |
