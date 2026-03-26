# Starter Prompt: Execute Contract Batch — Sprint 15

## What was completed last session
- Defined 13 remaining contracts for the 38-contract migration pipeline
- Ran 2 adversarial review rounds resolving 4 CRITICAL and 9 HIGH issues
- Key fixes: dependency chain gaps, drift executor registration (M05b), phaseOrder update (M11a), EngagementStatus type propagation (FE-01), L3/L4 executor file placement (worker/ not profiler/)
- Committed to branch claude/cranky-stonebraker at 4392778, PR #200 created

## Files changed
- 13 new files in docs/contracts/: sprint-M09b, M05b, M10a, M10b, M11a, FE-01..FE-06, INT-01, CP02

## Current project state
- Main at commit 457ddee
- PR #200 pending merge (contract definitions)
- Migration: 15 Go packages, all passing
- Frontend: 239 test files, 1,902 tests passing
- Migrations on disk: 043 through 051. Next available: 052
- Completed contracts: 25 of 38 (66%)
- Defined but unbuilt: 13 contracts

## What needs to happen next
1. Merge PR #200 to main (contract definitions)
2. Execute Sprint 15 — M09b + M05b in parallel via agent dispatch
   - M09b: Recon execution engine (migration 052, reconciler/execution.go, worker executor, API)
   - M05b: Drift monitoring (migration 053, scheduler, CreateNotification, executor registration)
3. After Sprint 15, execute Sprint 16: M10a then M10b (sequential)

## Key architecture notes for next session
- Migration numbering: 052 (M09b), 053 (M05b), 054 (M10a), 055 (M10b)
- M05b must register drift executor in main.go (gap from M05a)
- M11a must update phaseOrder/orderedPhases in gate_handlers.go
- FE-01 is the type-system gate — extends EngagementStatus union
- All recon arithmetic uses math/big.Rat (not float64)
- Frontend tests mock at fetch layer per feedback_testing_strategy.md
- The romantic-shamir worktree still exists — check if still needed
- Pre-commit hook runs tests for ALL Go packages when migration files change

## Verification baseline
- Migration: 15 packages, all passing (go test ./... -short -count=1)
- Frontend: 1,902 tests passing
- Contract files: 33 total (20 existing + 13 new)
