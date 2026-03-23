# Next Session Starter — Migration End-to-End UI Testing

## Context

Session 23 completed the migration wrap-up plan (PR #147, merged to main):
- Certification workflow (backend + frontend)
- Lineage API (2 endpoints)
- Reconciliation UI polish (feedback, drill-downs, currency formatting)
- E2E hardened to 46/46
- Fixed: JSONB inserts, attention query, status casing, AI card crashes, tab error boundaries

## Current State

Docker services are running with seed data (100 PRISM members). Two E2E-created
engagements exist but were created by automated scripts, not through the UI.

**The migration UI has NOT been tested as a real user would use it.** Individual
panels render, but the full workflow — creating an engagement, connecting a source,
profiling tables, generating mappings, creating and executing batches, running
reconciliation, and certifying — has not been walked through in the browser.

## Goal: Full UI Walkthrough

Test every phase of the migration lifecycle through the frontend, fixing any issues
that prevent a user from completing the flow:

### Phase 1: Discovery
- [ ] Create a new engagement via "+ New Engagement" button
- [ ] Configure source connection (prism-source, port 5432, prism_prod, user prism)
- [ ] Discover tables — should show 21 src_prism tables
- [ ] Select tables and advance to Profiling

### Phase 2: Profiling
- [ ] Run quality profiling on selected tables
- [ ] Verify radar chart renders with ISO 8000 scores
- [ ] Approve quality baseline
- [ ] Advance to Mapping

### Phase 3: Mapping
- [ ] Generate field mappings
- [ ] Review mappings list — should show canonical field mappings
- [ ] Advance to Transformation

### Phase 4: Transformation
- [ ] Create a batch (ACTIVE_MEMBERS scope)
- [ ] Execute the batch — should process source rows
- [ ] Verify batch status updates (RUNNING → LOADED or FAILED)
- [ ] If failed, check exception clusters and investigate
- [ ] Advance to Reconciliation

### Phase 5: Reconciliation
- [ ] Run reconciliation on the batch
- [ ] Verify gate score gauge, summary counters, tier funnel
- [ ] Check root cause analysis and P1 issues
- [ ] Advance to Parallel Run

### Phase 6: Parallel Run + Certification
- [ ] Verify Go/No-Go checklist auto-checks (gate score, P1 count)
- [ ] Check manual checkboxes (parallel duration, stakeholder, rollback)
- [ ] Click "Certify Complete"
- [ ] Verify certification record persists on page reload

## Known Issues to Watch For

1. **Phase gate transitions** — the advance-phase API was fixed (JSONB cast) but
   gate metric computation may still have edge cases
2. **Batch execute** — depends on source connection + active_members view in
   prism-source. E2E test returned 202 but batch status was "failed" in UI
3. **WebSocket disconnected** — expected without WS server, polling fallback works
4. **Seed data regeneration** — if Docker volumes were cleared, run:
   ```bash
   python migration-simulation/sources/prism/prism_data_generator.py
   ```

## Key Files

- `frontend/src/components/migration/` — all UI components
- `platform/migration/api/` — Go API handlers
- `platform/migration/batch/batch.go` — batch execution pipeline
- `tests/e2e/migration_e2e.sh` — 46 E2E assertions for reference
- `docs/plans/2026-03-23-migration-wrap-up-design.md` — design doc
