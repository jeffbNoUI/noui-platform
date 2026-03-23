# Starter Prompt: Post Intelligence Integration — Next Steps

## Context

The Migration Intelligence Integration is **complete on branch `claude/exciting-jang`** (12 commits, pushed). The Python migration-intelligence service's `POST /intelligence/analyze-mismatches` is now wired into the Go reconciler's post-reconciliation flow.

**What was built (Session 20):**

| Layer | What | Status |
|-------|------|--------|
| Migration 039 | `reconciliation_pattern` table | Done |
| Go model | `ReconciliationPattern` struct | Done |
| Intelligence client | `AnalyzeMismatches()` + `Analyzer` interface | Done, 3 tests |
| Persistence | `PersistPatterns()`, `GetPatternsByEngagement()` | Done |
| ReconcileBatch | Async `analyzePatterns` goroutine (nil-safe, 5s timeout) | Done |
| GET endpoint | `/reconciliation/patterns` | Done |
| Frontend type + API + hook | `ReconciliationPattern`, `getReconciliationPatterns`, `useReconciliationPatterns` | Done |
| ReconciliationPanel | Systematic Patterns section (domain badges, correction type, confidence) | Done, 2 tests |

**Tests:** Go 11 packages pass (short), Frontend 232 files / 1840 tests pass.

## Recommended Next Steps (in priority order)

### 1. Create PR and Merge `claude/exciting-jang`

Branch is pushed. Create PR → merge to main.

```bash
gh pr create --title "Migration intelligence integration" --body "Wire Python analyze-mismatches into Go reconciler post-reconciliation flow"
```

### 2. Docker E2E Verification

With Docker stack running, verify the full flow:
1. Create engagement, configure source, profile, map, batch, execute, reconcile
2. Confirm `POST /reconcile` triggers intelligence call to Python service on port 8101
3. Confirm `GET /reconciliation/patterns` returns persisted patterns
4. Confirm ReconciliationPanel shows Systematic Patterns section

Check Docker logs for the intelligence service:
```bash
docker compose logs migration-intelligence --tail=20
```

### 3. Resolution Workflow

The `reconciliation_pattern` table has `resolved`, `resolved_at`, `resolved_by` columns but no endpoint to update them. Next:
- Add `PATCH /api/v1/migration/reconciliation/patterns/{id}/resolve` endpoint
- Add resolve toggle button in ReconciliationPanel pattern cards
- Track who resolved (from JWT claims)

### 4. Corpus Learning Integration

The Python service has `POST /intelligence/record-decision` for storing analyst mapping decisions. Wire this:
- When analyst approves/rejects a mapping, call `record-decision`
- Add Go client method `RecordDecision()`
- Over time, `corpus_match` signal in scoring improves

### 5. Enhanced Root Cause Analysis

Current `/reconciliation/root-cause` is deterministic Go logic. Enhance by calling the Python service's pattern data:
- If patterns exist, include them in the root cause response
- Show "23 members in TIER_1 show systematic salary variance" instead of generic "Major mismatches exceed minor ones"

## Key Files

### Go Backend
- `platform/migration/intelligence/client.go` — `Analyzer` interface + `AnalyzeMismatches()`
- `platform/migration/api/reconciliation_handlers.go` — `analyzePatterns` goroutine (line ~350)
- `platform/migration/api/pattern_handlers.go` — GET patterns endpoint
- `platform/migration/db/pattern.go` — `PersistPatterns()`, `GetPatternsByEngagement()`
- `platform/migration/db/migrations/039_reconciliation_patterns.sql`

### Frontend
- `frontend/src/types/Migration.ts` — `ReconciliationPattern` interface
- `frontend/src/hooks/useMigrationApi.ts` — `useReconciliationPatterns()`
- `frontend/src/components/migration/engagement/ReconciliationPanel.tsx` — Systematic Patterns section

### Python Intelligence Service
- `migration-intelligence/service.py` — FastAPI entry
- `migration-intelligence/reconciliation/analysis.py` — `detect_systematic_patterns()`
- `migration-intelligence/reconciliation/corrections.py` — `suggest_corrections()`

## Design Docs
- `docs/plans/2026-03-22-intelligence-integration-design.md` — Approved design
- `docs/plans/2026-03-22-intelligence-integration-plan.md` — 10-task implementation plan
