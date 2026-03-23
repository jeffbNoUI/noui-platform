# Starter Prompt: Post Reconciliation Completion — Next Steps

## Context

Session 21 completed **all 5 remaining reconciliation items** on branch `claude/quizzical-murdock` (merged to main via PR). This builds on Session 20's intelligence integration.

**What was built (Sessions 20 + 21 combined):**

| Layer | What | Status |
|-------|------|--------|
| Migration 039 | `reconciliation_pattern` table | Done |
| Go model | `ReconciliationPattern` struct + `Patterns` on `RootCauseResponse` | Done |
| Intelligence client | `AnalyzeMismatches()`, `RecordDecision()`, `CorpusRecorder` interface | Done, 5 tests |
| Persistence | `PersistPatterns()`, `GetPatternsByEngagement()`, `ResolvePattern()` | Done |
| ReconcileBatch | Async `analyzePatterns` goroutine (nil-safe, 5s timeout) | Done |
| GET endpoint | `/reconciliation/patterns` | Done |
| PATCH endpoint | `/reconciliation/patterns/{id}/resolve` | Done |
| Root cause | Enriched with intelligence patterns | Done |
| Corpus learning | Fire-and-forget `RecordDecision` on mapping approval | Done |
| Frontend | Pattern cards, resolve button, tier derivation fix, batch trigger | Done |

**Tests:** Go 11 packages pass (short), Frontend 232 files / 1840 tests pass.

## Recommended Next Steps (in priority order)

### 1. Docker E2E Verification of Full Reconciliation Flow

With Docker stack running, verify the complete end-to-end:
1. Create engagement → configure source → profile → map → batch → execute → reconcile
2. Confirm `POST /reconcile` triggers intelligence call to Python service on port 8101
3. Confirm `GET /reconciliation/patterns` returns persisted patterns
4. Confirm `PATCH /reconciliation/patterns/{id}/resolve` marks pattern resolved
5. Confirm ReconciliationPanel shows: Systematic Patterns section, Resolve buttons, batch trigger
6. Confirm root cause endpoint includes patterns in response
7. Confirm mapping approval fires corpus `record-decision` (check Docker logs)

```bash
docker compose up --build
docker compose logs migration-intelligence --tail=20
```

### 2. Parallel Run Infrastructure (Phase 4)

The migration service needs parallel-run capability: run legacy and new systems side-by-side, compare outputs in real-time, build confidence before cutover.

Key design decisions:
- How to route requests to both systems simultaneously
- How to compare outputs (field-level diff vs. aggregate metrics)
- How to handle timing mismatches between systems
- Dashboard for parallel-run health metrics

### 3. Auditor-Readable Lineage Reports

For pension fund compliance, every data transformation must be traceable:
- Source record → mapping applied → transformation → target record
- Complete audit trail per member
- Exportable report format (PDF or structured JSON)

### 4. Performance Testing at 250K+ Member Scale

The current implementation works for small datasets. At pension fund scale (250K members, 30-year history), we need to verify:
- Batch reconciliation performance (bulk `INSERT ... ON CONFLICT`)
- Pattern detection scalability (Python service with large mismatch sets)
- Frontend rendering performance (virtualized lists for large pattern sets)

## Key Files

### Go Backend
- `platform/migration/intelligence/client.go` — `Analyzer` + `CorpusRecorder` interfaces
- `platform/migration/api/reconciliation_handlers.go` — `analyzePatterns` goroutine
- `platform/migration/api/pattern_handlers.go` — GET patterns + PATCH resolve
- `platform/migration/api/ai_handlers.go` — Enriched root cause
- `platform/migration/api/mapping_handlers.go` — Corpus learning wiring
- `platform/migration/db/pattern.go` — Pattern CRUD

### Frontend
- `frontend/src/components/migration/engagement/ReconciliationPanel.tsx` — Pattern UI
- `frontend/src/hooks/useMigrationApi.ts` — `useReconciliationPatterns`, `useResolvePattern`
- `frontend/src/lib/migrationApi.ts` — API functions

### Python Intelligence Service
- `migration-intelligence/service.py` — FastAPI entry
- `migration-intelligence/reconciliation/analysis.py` — Pattern detection
- `migration-intelligence/reconciliation/corrections.py` — Correction suggestions

## Design Docs
- `docs/plans/2026-03-22-intelligence-integration-design.md` — Intelligence architecture
- `docs/plans/2026-03-22-intelligence-integration-plan.md` — 10-task implementation plan
- `docs/plans/2026-03-22-post-intelligence-next-session.md` — Previous session's next-steps (now completed)
