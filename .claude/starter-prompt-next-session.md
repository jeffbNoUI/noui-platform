# Starter Prompt: Sprint contracts batch defined, CP01 passed

## What was completed last session
- CP01 regression checkpoint: all 5 acceptance criteria PASS (Go tests, frontend tests, typecheck, build, ESLint)
- Drafted 5 sprint contracts for the next autonomous build batch:
  - M03a: Parallel run DB schema + models (migration 045)
  - M03b: Parallel run execution engine (job executor)
  - M03c: Parallel run API handlers + WebSocket events
  - M06a: Audit trail immutable log + DELETE triggers + integrity hashes (migration 046)
  - M07a: PDF reports via chromedp + mapping spec export
- Contracts reviewed through 3 independent review rounds (16 critical + 14 high → 0 remaining)
- PR #185 open for contract batch

## Files changed
- docs/contracts/sprint-M03a.json (new)
- docs/contracts/sprint-M03b.json (new)
- docs/contracts/sprint-M03c.json (new)
- docs/contracts/sprint-M06a.json (new)
- docs/contracts/sprint-M07a.json (new)

## Current project state
- Migration: 13 Go packages, all green in -short mode
- Frontend: 1902 tests passing (239 files)
- Main updated through M02d (PR #184)
- Completed contracts: M00, M01, M01b, M02a-d, CP01
- Remaining: 29 build + 2 checkpoint + 2 integration contracts (of 38 total)

## What needs to happen next
- Merge PR #185 (contract definitions)
- Begin executing contracts — 3 can run immediately:
  - M03a (parallel run schema) — critical path
  - M06a (audit trail) — independent track, no dependencies beyond M01
  - M07a (PDF reports) — independent track, no dependencies
- After M03a merges: M03b, then M03c
- Consider defining next contract batches: M04a-b (certification/cutover), M08a (schema versioning)

## Key architecture notes for next session
- RLS pattern: Tier A (direct tenant_id), Tier B (engagement_id→engagement.tenant_id), Tier C (batch_id→batch→engagement). Use current_setting('app.tenant_id'), NOT engagement_members
- Executor interface: Execute(ctx, *jobqueue.Job, *jobqueue.Queue, *sql.DB) — 4 params
- Worker.Hub injection: post-construction field assignment (w.Hub = hub), not constructor
- analyst_decision table: Tier A (has tenant_id column) — matches existing 043 RLS policy
- Cooperative cancel: job ends FAILED, parallel_run ends CANCELLED — intentional divergence
- M07a Dockerfile: debian:bookworm-slim + chromium apt, golang:1.22-alpine builder
- 26+ stale worktrees — recommend batch cleanup

## Verification baseline
- Migration: 13 packages, all green in -short mode
- Frontend: 1902 tests passing (239 files)
- CP01: all 5 gates PASS
