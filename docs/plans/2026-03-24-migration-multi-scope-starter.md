# Next Session Starter — Multi-Scope Batch Execution + Tier 2/3 Reconciliation

## Context

Session 27 populated all 21 PRISM source tables with seed data (PR #158, merged).
Previously only `prism_member` had data, so batch execution only worked for
ACTIVE_MEMBERS scope. Now all tables are populated:

- 100 members, 173 addresses, 160 service credit records
- 820 pre-1998 annual salary + contribution records each
- 44,902 biweekly salary periods, 20,496 monthly contributions
- 35 benefit calcs, 35 payment schedules, 529 payment history records
- 154 beneficiaries, 4 QDROs, 5 disability records
- 154 notes, 158 life events, 396 COLA adjustments

Known data quality issues are intentionally embedded (P-02, P-07, P-08, P-09).

## What's Ready

- All 21 tables discoverable via connector introspection
- Migration E2E: 47/47, Employer E2E: 49/49
- Seed data is deterministic (`random.seed(42)`)

## What to Do

### Step 1: Browser Walkthrough — Multi-Scope Discovery

Verify the connector discovers all 21 tables (not just `prism_member`):

1. Create engagement → configure source (prism-source:5432, prism_prod)
2. Discover tables → should find all 21 `src_prism.*` tables
3. Select all → advance to profiling
4. Profile → quality radar should now show richer data across more tables

### Step 2: Multi-Scope Batch Execution

Test batch execution for scopes beyond ACTIVE_MEMBERS:

| Scope | Expected Source Table | Expected Rows |
|-------|---------------------|---------------|
| ACTIVE_MEMBERS | prism_member | 100 |
| SALARY_HISTORY | prism_sal_period | 44,902 |
| BENEFICIARIES | prism_beneficiary | 154 |
| CONTRIBUTIONS | prism_contrib_hist | 20,496 |
| PAYMENT_HISTORY | prism_pmt_hist | 529 |

For each scope:
- Create batch → Execute → verify status transitions (PENDING → RUNNING → LOADED)
- Check loaded row count matches expected
- Check exception count (should be > 0 for scopes with data quality issues)

### Step 3: Tier 2/3 Reconciliation

After batches load:
- Tier 1 (member identity): already working — should still produce MATCH records
- Tier 2 (benefit calculation): needs `canonical_members.canonical_benefit` populated
  from `PRISM_BENEFIT_CALC.CALC_RESULT`. Check if transformation pipeline maps this.
- Tier 3 (payment history): needs payment amounts loaded into `migration.payment_history`.
  Verify reconciliation scores compute for payment-level checks.

### Step 4: Fix JWT Expiry Silent Failure

Known issue from Session 26: batch status gets stuck at RUNNING when the JWT expires
during a long batch execution. The batch executor doesn't handle token refresh or
propagate the auth failure. Investigate:

- `platform/migration/api/batch_handlers.go` — `executeBatch()` function
- Check if the DB connection uses the JWT-derived context
- Proposed fix: use a service-level context for batch execution, not the HTTP request context

## Key Files

| Area | File |
|------|------|
| Batch execution | `platform/migration/api/batch_handlers.go` |
| Scope → table mapping | `batch_handlers.go:resolveSourceTable()` |
| Transformation | `platform/migration/batch/transformer.go` |
| Reconciliation | `platform/migration/reconciler/reconciler.go` |
| Canonical tables | `platform/migration/db/migrations/036_canonical_tables.sql` |
| Seed data | `migration-simulation/sources/prism/prism_data_generator.py` |
| Schema | `migration-simulation/sources/prism/init/01_schema.sql` |

## Test Baseline

- **Go migration:** 11/11 packages pass
- **Frontend:** 235 files, 1856 tests pass
- **Migration E2E:** 47/47
- **Employer E2E:** 49/49
