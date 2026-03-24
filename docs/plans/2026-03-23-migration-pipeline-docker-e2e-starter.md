# Next Session Starter — Migration Pipeline Docker E2E Verification

## Context

Session 25 fixed the two critical pipeline blockers:

1. **Batch scope → source table mapping** (PR #150, merged): `resolveSourceTable` now
   reads field mappings (set during Phase 3 Mapping) to resolve the real source table
   instead of relying on hard-coded system name switches. PK column is auto-discovered
   from `information_schema`. Fallbacks preserved for known systems (PRISM, PAS).

2. **NaN% AI Recommendation** (PR #150): `AIRecommendationCard` guards against
   undefined/null confidence values.

Phase 5g bugs (dbcontext stale connection, uploaded_by UUID, hireDate parsing) were
already fixed in PR #134.

## What's Left: Docker E2E Verification

The code fixes are in but haven't been tested through Docker. The next session should:

### Step 1: Docker Stack Up + Migration E2E

```bash
docker compose up --build -d
# Wait for services, then:
bash tests/e2e/migration_e2e.sh
```

Expected: 47/47 passing (baseline from last session).

### Step 2: Browser Walkthrough — Batch Execution

The real test is whether batch execution now works through the UI:

1. **Create engagement** → "PRISM" or any name
2. **Configure source** → prism-source:5432, src_prism DB
3. **Discover tables** → should find `src_prism.prism_member` + others
4. **Profile** → approve quality baseline
5. **Generate mappings** → auto-discover from source
6. **Create batch** → scope "ACTIVE_MEMBERS", version "v1.0"
7. **Execute batch** → POST /batches/{id}/execute → should now resolve to
   `src_prism.prism_member` via field mappings

**Key verification points:**
- [ ] Batch status transitions: PENDING → RUNNING → LOADED
- [ ] Row counts populate (source, loaded, exception)
- [ ] Error rate shows a real number (not NaN)
- [ ] Exception clusters appear if there are transformation errors
- [ ] Transformation tab shows batch in LOADED state

### Step 3: Reconciliation with Real Data

After batch loads successfully:
- [ ] Run reconciliation → should produce scores (not empty)
- [ ] P1 issues table shows discrepancies (if any)
- [ ] Root cause analysis produces AI-like pattern groupings
- [ ] Gate scores compute for the 5-item Go/No-Go checklist

### Step 4: Certification End-to-End

After reconciliation completes with gate score > 0:
- [ ] Go/No-Go checklist: auto-checks pass (error rate, recon score)
- [ ] Manual checks can be toggled
- [ ] "Certify Complete" button enables when all 5 checks pass
- [ ] Certification POST succeeds, engagement moves to CERTIFIED

### Step 5: Full E2E + Employer Suite

Run both E2E suites to confirm no regressions:
```bash
bash tests/e2e/migration_e2e.sh    # Target: 47/47
bash tests/e2e/employer_e2e.sh     # Target: full green
```

## Key Files

| Area | File | What to check |
|------|------|--------------|
| Batch execution | `platform/migration/api/batch_handlers.go` | `resolveSourceTable` uses mappings |
| Source row provider | `platform/migration/batch/db_provider.go` | DSN + table + key column |
| Reconciliation | `platform/migration/reconciler/reconciler.go` | Score computation |
| Certification | `platform/migration/api/certification_handlers.go` | Go/No-Go validation |
| Frontend batch | `frontend/src/components/migration/engagement/BatchDetail.tsx` | Status display |
| Frontend recon | `frontend/src/components/migration/engagement/ReconciliationPanel.tsx` | Data unwrapping |
| Frontend cert | `frontend/src/components/migration/engagement/PhaseGateDialog.tsx` | Checklist logic |
| AI card | `frontend/src/components/migration/ai/AIRecommendationCard.tsx` | NaN guard |

## Known Issues / Edge Cases

1. **Source loader for MSSQL**: `discoverPrimaryKey` queries `information_schema` which
   works for PostgreSQL. MSSQL uses the same schema but parameter syntax differs (`$1`
   vs `@p1`). Not a blocker for Docker E2E (source is PostgreSQL) but needs attention
   for production MSSQL sources.

2. **Empty mappings fallback**: If no field mappings exist when batch executes, it falls
   back to the hard-coded system name switch. The UI flow should always produce mappings
   before batch execution (Phase 3 → Phase 4), but defensive coding is in place.

3. **Reconciliation data requirements**: The reconciler needs `canonical_members` rows
   with `canonical_benefit` values. The transformation pipeline must populate this field
   from source data (maps from `gross_monthly_benefit` or `calc_result`). If source
   data lacks benefit amounts, recon scores will be 0.

## Test Baseline

- **Go migration:** 11/11 packages, all passing
- **Frontend:** 235 files, 1856 tests, all passing
- **Migration E2E:** 47/47 (last run before this session's code changes)
- **Employer E2E:** 47/47 (from PR #149)
