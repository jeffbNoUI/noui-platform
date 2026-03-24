# Migration Service Wrap-Up — Design Document

**Date:** 2026-03-23
**Status:** Approved
**Approach:** Vertical slices — each slice delivers backend → frontend → tests end-to-end

## Context

Sessions 18–22 completed the migration service through reconciliation (Phases 1–7c).
All 40/40 E2E tests passing. Source simulation seed data generators working (100 PRISM
members, 100 PAS members). The remaining work falls into 4 vertical slices.

## Slice 1: Reconciliation UI Polish

**Goal:** Make ReconciliationPanel production-complete. No new backend work.

### Frontend Changes (ReconciliationPanel.tsx)

- **Mutation feedback:** Toast/inline success+error for "Run Reconciliation" and "Resolve Pattern"
- **Member drill-down:** Wire "View affected" link on RootCauseAnalysis to filter records table by `suspected_domain`
- **Pattern → members:** Click pattern card → expand to show `affected_members` list
- **P1 currency formatting:** Format `variance_amount` as currency
- **Error states:** Show error UI when any query fails (currently silent)

### Tests

- Unit tests for ReconciliationPanel (render with mock data, mutation feedback, error states)
- Unit tests for ParallelRunPanel checklist logic (auto-check computation)
- Unit test for TierFunnel rendering

### Scope

- 0 new migrations
- 0 new API endpoints
- ~1 file changed (ReconciliationPanel.tsx) + 3 test files added

---

## Slice 2: Certification Workflow

**Goal:** Persist Go/No-Go checklist and sign-off to database. Create audit trail.

### Backend

**Migration 040: `certification_record` table**

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | Record ID |
| engagement_id | UUID FK | Links to engagement |
| gate_score | NUMERIC | Reconciliation gate score at time of certification |
| p1_count | INTEGER | Unresolved P1 count at time of certification |
| checklist_json | JSONB | 5 checklist items with who checked each |
| certified_by | TEXT | User ID from JWT |
| certified_at | TIMESTAMPTZ | When certification was submitted |
| notes | TEXT | Optional notes |

**Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/engagements/{id}/certify` | Validates all checks, creates record, advances to COMPLETE |
| GET | `/engagements/{id}/certification` | Returns latest certification record |

**Rules:**
- Certification is immutable — INSERT only, no UPDATE
- Re-certification after regression creates a new record
- All 5 checklist items must be checked (server-side validation)

### Frontend (ParallelRunPanel.tsx)

- `useCertification` hook — load existing record on mount, restore checklist state
- "Certify Complete" button calls POST mutation with success/error feedback
- Manual checks remain local state until final submit (simple, no draft persistence)

### Tests

- Go unit test: certification handler (happy path, missing checks, duplicate rejection)
- Frontend test: ParallelRunPanel (load existing cert, submit flow)

---

## Slice 3: Lineage API

**Goal:** JSON endpoint exposing the transformation audit trail per batch.

### Backend

**Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/batches/{id}/lineage` | Lineage records, filterable by `member_id`, `canonical_field`, `tier`. Paginated. |
| GET | `/batches/{id}/lineage/summary` | Aggregate stats: records traced, fields covered, transformation types, exception counts |

**Response shape (lineage record):**

```json
{
  "member_id": "M-00042",
  "canonical_field": "monthly_benefit",
  "source_table": "src_prism.prism_benefit_calc",
  "source_column": "CALC_AMT",
  "source_value": "2847.33",
  "transformation": "DIRECT_MAP",
  "canonical_value": "2847.33",
  "lineage_id": "...",
  "batch_id": "...",
  "created_at": "..."
}
```

**No new migrations** — lineage data already exists in `migration.lineage` table from Phase 2.
No frontend UI — JSON API is the deliverable. Viewer component deferred.

### Tests

- Go unit test: lineage query (filter by member, by field, pagination)
- E2E test: GET lineage returns records after batch execute

---

## Slice 4: E2E Hardening

**Goal:** Fix startup race, fix soft failures, add E2E coverage for new endpoints.

### Fixes

| Item | Approach |
|------|----------|
| Startup race | Poll loop in E2E script — wait for `prism_member` row count > 0 before running tests |
| Mapping approval 400 | Use valid mapping ID from `GET /mappings` response earlier in the test |
| Pattern resolve skip | Stays as graceful skip if no patterns generated (seed data is consistent) |

### New E2E Phases

| Phase | Endpoint | Assertion |
|-------|----------|-----------|
| 12 | POST `/engagements/{id}/certify` | 200 + record returned with certified_by |
| 12 | GET `/engagements/{id}/certification` | Record matches what was posted |
| 13 | GET `/batches/{id}/lineage` | Records returned after batch execute |
| 13 | GET `/batches/{id}/lineage/summary` | Aggregate stats with non-zero counts |

---

## Dependency Order

```
Slice 1 (Recon UI Polish)
    ↓
Slice 2 (Certification Workflow)  — needs recon UI working for gate score display
    ↓
Slice 3 (Lineage API)            — independent, but ordered after cert for natural flow
    ↓
Slice 4 (E2E Hardening)          — covers all new endpoints from slices 2+3
```

## Out of Scope

- CDC sync / continuous comparison (deferred, noted in ParallelRunPanel)
- Parallel execution engine (deferred)
- PDF export of lineage (deferred — JSON API first)
- Performance testing at 250K+ scale (separate initiative)
- Lineage viewer UI component (deferred — API is the deliverable)
