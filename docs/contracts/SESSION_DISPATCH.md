# Session Dispatch — Quality-Gated Workflow

This document is the canonical prompt for autonomous migration build sessions.
Each session receives this workflow along with a specific sprint contract.

---

## Instructions

You are executing an autonomous build session for the NoUI migration services.
Your sprint contract is specified in the session launch command.

Follow this workflow exactly. Do not skip steps.

### Phase 0: Sync and Baseline

1. Run `git fetch origin && git merge --ff-only origin/main` to sync with remote
2. Run `git status --short` to verify clean working tree
3. Read `CLAUDE.md` for project rules and conventions
4. Read the original migration design doc at `docs/plans/2026-03-20-migration-engine-design.md` for domain context

### Phase 1: Design (before writing any code)

5. Read the sprint contract JSON file
6. **Dependency check**: verify all contracts in `depends_on` have merged PRs:
   ```bash
   # For each prerequisite contract ID:
   gh pr list --state merged --search "migration/{prerequisite-id} in:title" --json title,mergedAt
   ```
   If any prerequisite is not merged, STOP:
   ```
   BLOCKED: Prerequisite contract {id} not yet merged.
   Cannot proceed with {current contract id}.
   ```
7. **Resume check**: look for an existing draft PR for this contract:
   ```bash
   gh pr list --state open --draft --search "migration/{contract-id} in:title" --json title,url,headRefName
   ```
   If a draft PR exists, this is a continuation session. Check out the existing branch instead of creating a new worktree. Read `.claude/starter-prompt-next-session.md` for context on what was completed.
8. Read the relevant source files listed in `files_hint` to understand existing code
9. Write an implementation design:
   - Which files you'll create or modify (list each one)
   - What tests you'll write (list test function names)
   - Edge cases and error paths
   - How this connects to the existing codebase
   - Note any existing code that overlaps with the contract — build on it, don't rebuild it
10. **Design review** — spawn an independent reviewer agent (subagent_type: "feature-dev:code-reviewer") with:
    - Your implementation design
    - The contract's `design_review_rubric`
    - The standard design review rubric (Section 5 of the autonomous build design doc)
    - CLAUDE.md security rules, fiduciary rules, and layer boundary rules
    - The original migration design doc for domain context
    - Instruction: "Grade this design against BOTH the contract-specific rubric AND the standard rubric. Return CRITICAL, HIGH, and MEDIUM findings. Evaluate independently."

    If subagent spawning is not available, perform self-review against both rubrics.
11. Address all CRITICAL findings. Address all HIGH findings that are feasible.
12. If you made significant changes, re-submit to the reviewer agent.
13. Log the final design review verdict in your session notes.
14. Only proceed to Phase 2 when all CRITICAL pass and all feasible HIGH pass.

### Phase 2: Implement

15. Create a worktree named after the contract: use `EnterWorktree` with name `migration-{contract-id}` (e.g., `migration-M01`, `migration-M02a`). If this is a resume session, skip this step — you're already on the branch.
16. After entering the worktree, ensure it's up to date:
    ```bash
    git fetch origin && git rebase origin/main
    ```
17. Implement against the reviewed design
18. Run `/validate` after each significant change (new file, new test, new endpoint)
19. Do not proceed past a failing `/validate` — fix it before continuing

### Phase 3: Quality Gates

20. **WIP commit** — stage and commit all changes before running quality gates:
    ```bash
    git add -A && git commit -m "WIP: [migration/{contract-id}] implementation complete, running quality gates"
    ```
    This ensures `/simplify` can diff against the correct baseline.
21. Run `/validate` — full lint + typecheck + test suite
22. Run `/simplify` — up to 3 cycles of code cleanup
23. Run `/validate` — confirm simplify didn't break anything
24. Run `/precommit` — 4-category graded evaluation
25. If any category grades FAIL:
    - Fix the issue
    - Re-run from step 21
    - Maximum 3 fix-and-rerun cycles
    - If still failing after 3 cycles, create a **draft** PR (not ready for review), document the unresolved issue in the PR description, and proceed to Phase 4

### Phase 4: Ship

26. Amend the WIP commit with the final changes and a proper message:
    ```bash
    git add -A && git commit --amend -m "[migration/{contract-id}] {goal from contract}"
    ```
27. Push and create PR:
    - Branch: `migration-{contract-id}`
    - Base: `main`
    - Title: `[migration/{contract-id}] {goal}`
    - Label: `migration-build`
    - Body must include:
      - Design review verdict (PASS/FAIL + iteration count)
      - `/precommit` grade (4 categories)
      - Test results summary
      - Files changed list
    - If quality gates failed after 3 cycles, create as **draft** PR
28. Run `/session-end`

### Standard Design Review Rubric (applied to EVERY contract)

These items supplement the contract-specific rubric. Both are checked.

**CRITICAL:**
- Every API endpoint has auth middleware + tenant scoping
- Every DB query uses RLS or explicit tenant_id filter
- No float64 for monetary values (big.Rat or scaled int)
- No schema changes that relax NOT NULL or widen types
- Error thresholds respected (0 tolerance for retiree errors)
- Batch operations are idempotent and restartable
- Lineage written for every canonical record mutation
- Middleware order: CORS → Auth → Logging → Handler

**HIGH:**
- WebSocket events broadcast for all state changes
- Frontend optimistic updates with rollback on error
- Tests cover happy path + at least 2 error paths
- Existing E2E regression suite unaffected
- slog structured logging (never fmt.Println or log.*)
- HTTP response writer implements Flusher interface if wrapped

**MEDIUM:**
- Performance tested with 250K+ member dataset
- Graceful degradation if intelligence service unavailable
- Notification channels beyond in-app

### If Something Goes Wrong

- **Build fails, can't fix in 3 attempts** → commit what you have, create a **draft** PR, document the failure in the PR description and in `.claude/starter-prompt-next-session.md`
- **Test fails unrelated to your changes** → document it in the PR description, don't fix unrelated failures
- **Design reviewer finds a CRITICAL you can't resolve** → create a **draft** PR, document the blocker
- **Context running low** → commit what you have, create a **draft** PR, write a detailed starter prompt to both:
  - `.claude/starter-prompt-next-session.md` (in-repo, for PR context)
  - The canonical memory location (for cross-session continuity)
- **Prerequisite not merged** → STOP immediately, do not attempt the contract

### Contract JSON Schema

Contracts are in `docs/contracts/` and follow `config/schemas/sprint_contract.schema.json`.
