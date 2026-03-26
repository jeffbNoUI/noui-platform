# Migration Services — Autonomous Build Pipeline Design

**Date:** 2026-03-25
**Status:** Approved
**Goal:** Build the remaining migration services to production-ready state via autonomous Claude sessions

---

## 1. Problem

The migration engine is ~70% complete. The data pipeline (Discovery → Reconciliation) works end-to-end with verified Two-Source Proof gates. What remains is the operations layer: parallel run, cutover, monitoring, audit, and hardening. This represents ~80-140 hours of implementation across Go backend, Python intelligence, React frontend, and database schema.

The user wants this built autonomously — Claude sessions executing overnight with human review in the morning.

---

## 2. Approach: Sprint Contract Pipeline

Each unit of work is defined as a **sprint contract** — a machine-readable JSON file specifying goal, acceptance criteria, verification commands, and regression gates. Autonomous sessions read a contract, execute the work, and ship a PR.

### Contract Types

| Type | Purpose | Writes Code? | Naming |
|------|---------|-------------|--------|
| **Build** | Implement a feature | Yes | `sprint-M{NN}{letter}.json` |
| **Checkpoint** | Full regression suite | No | `sprint-CP{NN}.json` |
| **Integration** | Test composed workflows | Tests only | `sprint-INT{NN}.json` |

### Contract Sizing (The Boris Rule)

Each build contract touches **one layer, 3-5 files max**. If a feature spans backend + frontend, it's split into separate contracts. This ensures:
- Each PR is reviewable in 10 minutes
- A failed contract wastes 2-3 hours, not 12
- Layer boundaries are enforced by structure, not discipline

---

## 3. Quality-Gated Session Workflow

Every autonomous session follows this lifecycle:

### Phase 1: Design (before writing code)

1. Read sprint contract + relevant specs + existing code
2. Write implementation design (approach, files, tests, edge cases)
3. Spawn **independent reviewer agent** (dual-agent review)
   - Reviewer receives: design, contract rubric, CLAUDE.md rules
   - Reviewer does NOT receive: implementer's reasoning
   - Reviewer grades against: rubric, layer boundaries, security rules, tenant isolation
   - Returns: CRITICAL / HIGH / MEDIUM findings
4. Implementer addresses all CRITICAL, all feasible HIGH
5. Re-submit to reviewer if changes were significant
6. Log final design review verdict

### Phase 2: Implement

7. Implement against reviewed design
8. Run `/validate` after each significant change

### Phase 3: Quality Gates

9. `/validate` — full lint + typecheck + test suite
10. `/simplify` — up to 3 cycles of code cleanup
11. `/validate` — confirm simplify didn't break anything
12. `/precommit` — 4-category graded evaluation (spec adherence, type safety, data isolation, test coverage)
13. If any FAIL → fix and re-run from step 9

### Phase 4: Ship

14. Commit + push + create PR
15. `/session-end` — exit gates, starter prompt for next session

---

## 4. Six-Layer Quality Architecture

### Per-Contract Quality
1. **Dual-agent design review** — architectural flaws, security, layer violations
2. **Incremental validation** — `/validate` during implementation
3. **Code quality** — `/simplify` + `/validate` post-implementation
4. **Pre-commit grading** — `/precommit` 4-category evaluation

### Cross-Contract Quality (periodic)
5. **Regression checkpoint** — full test suite every 5th contract
6. **Integration milestone** — composed workflow testing at dependency convergence

### Pipeline Integrity
- **Dependency chain enforcement** — each session checks prerequisite contracts are merged before starting
- **Design conformance audit** — every 10th contract, reviewer compares codebase against original design doc

---

## 5. Design Review Rubric

Standard rubric applied to every build contract. Contracts may add domain-specific items.

### CRITICAL (must resolve before implementing)
- Every API endpoint has auth middleware + tenant scoping
- Every DB query uses RLS or explicit tenant_id filter
- No float64 for monetary values (big.Rat or scaled int)
- No schema changes that relax NOT NULL or widen types
- Error thresholds respected (0 tolerance for retiree errors)
- Batch operations are idempotent and restartable
- Lineage written for every canonical record mutation
- Middleware order: CORS → Auth → Logging → Handler

### HIGH (resolve when feasible)
- WebSocket events broadcast for all state changes
- Frontend optimistic updates with rollback on error
- Tests cover happy path + at least 2 error paths
- Existing E2E regression suite unaffected
- slog structured logging (never fmt.Println or log.*)
- HTTP response writer implements Flusher interface if wrapped

### MEDIUM (document as known limitation if not resolved)
- Performance tested with 250K+ member dataset
- Graceful degradation if intelligence service unavailable
- Notification channels beyond in-app

---

## 6. Contract Dependency Map

### Foundation (must complete first)
```
M00 (RLS policies on migration tables) ──> M02a-d (job queue infrastructure)
```

### Critical Path (sequential)
```
M01 (attention queue backend) ──> M01b (attention queue frontend)
                                   ├──> M03a-c (parallel run) ──> M04a-c (cutover) ──> M05a-c (monitoring)
M02a-d (job queue infrastructure) ┘
     ↑ depends on M02c (API), NOT M02d (frontend)
```

### Independent Track (can run in parallel with critical path)
```
M06a-b (audit trail & compliance)
M07a-c (PDF report generation)
M08a-b (schema versioning)
M09a-b (reconciliation rule management)
M10a-b (intelligence pattern refinement)
```

### Dependent on Critical Path
```
M11a-c (CDC infrastructure) — depends on M05
M12a-b (frontend polish + E2E hardening) — depends on M01b, M02d, M05c, M07c (frontend contracts only)
```

### Checkpoints and Integration
```
CP-01: after M02d (job queue complete)
CP-02: after M05c (parallel run + monitoring complete)
INT-01: after M04b (parallel run full workflow test)
CP-03: after M09b (all independent tracks complete)
INT-02: after M12b (full system integration test)
```

---

## 7. Full Contract Inventory

### Foundation

| Contract | Goal | Layer | Files | Effort | Depends On |
|----------|------|-------|-------|--------|------------|
| M00 | RLS policies on all migration tables | DB | 2 | 3h | — |

### Critical Path (~50h)

| Contract | Goal | Layer | Files | Effort | Depends On |
|----------|------|-------|-------|--------|------------|
| M01 | Attention queue resolve/defer (backend) | Go | 3 | 3h | — |
| M01b | Attention queue resolve/defer (frontend) | Frontend | 3 | 2h | M01 |
| M02a | Job queue: DB schema + Go models | Go/DB | 4 | 3h | M00 |
| M02b | Job queue: execution engine + retry | Go | 4 | 4h | M02a |
| M02c | Job queue: API handlers + monitoring | Go | 4 | 3h | M02b |
| M02d | Job queue: frontend status panel | Frontend | 4 | 2h | M02c |
| CP-01 | Regression checkpoint: full suite | — | 0 | 1h | M02d |
| M03a | Parallel run: DB schema + models | Go/DB | 3 | 3h | M01, M02c |
| M03b | Parallel run: execution engine | Go | 4 | 4h | M03a |
| M03c | Parallel run: API handlers + WebSocket | Go | 4 | 3h | M03b |
| M04a | Certification: checklist + gate logic | Go | 3 | 3h | M03c |
| M04b | Cutover: execution + rollback | Go | 4 | 4h | M04a |
| INT-01 | Integration: parallel run full workflow | Tests | 2 | 2h | M04b |
| M05a | Post-go-live: drift detection engine | Go | 4 | 4h | M04b |
| M05b | Post-go-live: monitoring API + alerts | Go | 3 | 4h | M05a |
| M05c | Post-go-live: frontend dashboard | Frontend | 3 | 4h | M05b |
| CP-02 | Regression checkpoint: full suite | — | 0 | 1h | M05c |

### Independent Track (~40h)

| Contract | Goal | Layer | Files | Effort | Depends On |
|----------|------|-------|-------|--------|------------|
| M06a | Audit trail: immutable log + DB schema | Go/DB | 3 | 4h | — |
| M06b | Audit trail: export + retention | Go | 3 | 4h | M06a |
| M07a | PDF reports: Puppeteer setup + mapping spec | Go | 4 | 4h | — |
| M07b | PDF reports: lineage + reconciliation | Go | 3 | 4h | M07a |
| M07c | PDF reports: frontend export buttons | Frontend | 3 | 4h | M07b |
| M08a | Schema versioning: DB + models | Go/DB | 3 | 3h | — |
| M08b | Schema versioning: compatibility checking | Go | 3 | 3h | M08a |
| M09a | Recon rules: versioning + audit trail | Go/DB | 3 | 3h | — |
| M09b | Recon rules: comparison + rollback | Go | 3 | 3h | M09a |
| M10a | Intelligence: pattern persistence | Python | 3 | 4h | — |
| M10b | Intelligence: cross-engagement learning | Python | 3 | 4h | M10a |
| CP-03 | Regression checkpoint: full suite | — | 0 | 1h | M09b, M10b |

### Dependent Track (~25h)

| Contract | Goal | Layer | Files | Effort | Depends On |
|----------|------|-------|-------|--------|------------|
| M11a | CDC: change tracking schema + models | Go/DB | 3 | 5h | M05c |
| M11b | CDC: delta merge + conflict resolution | Go | 4 | 6h | M11a |
| M11c | CDC: incremental load pipeline | Go | 4 | 5h | M11b |
| M12a | Frontend: polish all migration panels | Frontend | 5 | 4h | M01b, M02d, M05c, M07c |
| M12b | Frontend: E2E test hardening | Frontend | 4 | 4h | M12a |
| INT-02 | Integration: full system test | Tests | 2 | 2h | M12b |

### Total: 33 build + 3 checkpoint + 2 integration = 38 contracts (~120h)

---

## 8. Session Dispatch

### Single Session
```bash
claude --name "migration-M01" -p "Execute sprint contract docs/contracts/sprint-M01.json using the quality-gated workflow. [full prompt in docs/contracts/SESSION_DISPATCH.md]"
```

### Overnight Batch (sequential)
```bash
for contract in M01 M02a M02b M02c M02d; do
  claude --name "migration-$contract" -p "Execute sprint contract docs/contracts/sprint-$contract.json using the quality-gated workflow described in docs/contracts/SESSION_DISPATCH.md"
done
```

### Parallel Independent Tracks
Critical path and independent track can run simultaneously in separate worktrees, as long as they don't touch the same files.

---

## 9. Review Workflow

Morning review checklist:
1. Check PR list: `gh pr list --label migration-build`
2. For each PR:
   - Read the design review verdict (logged in PR description)
   - Read the `/precommit` grade (logged in PR description)
   - Scan the diff (should be 3-5 files, ~200 lines)
   - Merge or request changes
3. If a contract failed:
   - Check the session log for the failure point
   - Decide: re-run the contract, or modify it
4. Queue next batch of contracts based on what merged

---

## 10. Success Criteria

The autonomous build is complete when:
- All 35 contracts have merged PRs
- INT-02 (full system integration) passes
- Docker E2E suite has expanded to cover parallel run + monitoring
- No regressions in existing 96 E2E tests
- Design conformance audit shows no critical drift from original migration engine design

---

## 11. Iteration Plan

**Night 1 (tonight):** M00 (RLS), M01 (attention backend) — can run in parallel. Then M01b, M02a sequentially.
**Night 2:** M02b, M02c, M02d, CP-01 — job queue engine through checkpoint
**Night 3:** M03a, M03b, M03c — parallel run
**Night 4:** M04a, M04b, INT-01 — cutover + integration test
**Night 5:** M05a, M05b, M05c, CP-02 — monitoring + checkpoint
**Night 6+:** Independent track contracts (can be parallelized)

Adjust based on Night 1 learnings.

---

## 12. Known Gaps (Deferred)

Identified during independent review (2026-03-25). These are acknowledged gaps not covered by the current contract inventory:

| Gap | Status | Rationale |
|-----|--------|-----------|
| In-flight workflow migration (mid-stream retirement apps, DROs) | Deferred | Requires case management service integration. Add contracts when case management is built. |
| Performance optimization for 250K+ members | Deferred (Phase 5) | First client engagement unlikely to hit this scale. Profile first, optimize second. |
| Template governance as client base grows | Deferred (Phase 5) | Requires 3+ client engagements to be meaningful. |
| k-anonymity on shared corpus | Add to M10b | Add as acceptance criterion in M10b contract. |
| Data archival/cleanup post-migration | Add to independent track | Low priority but needed for production hygiene. |

## 13. Review History

| Date | Reviewer | Critical Findings | Resolution |
|------|----------|------------------|------------|
| 2026-03-25 | 3 independent reviewer agents | C1: /validate missing, C2: wrong attention domain model, C3: no session sync, C4: no RLS, C5: simplify diff issue | All 5 CRITICAL fixed. 12 IMPORTANT fixed. Design doc, contracts, and SESSION_DISPATCH.md updated. |

---

*Generated 2026-03-25 — NoUI Platform Migration Autonomous Build*
*Reviewed 2026-03-25 — 3 independent reviewer agents, 5 CRITICAL + 12 IMPORTANT findings resolved*
