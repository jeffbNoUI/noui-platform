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

### Phase 2: Red — Write Tests First (TDD)

15. Create an isolated branch for this contract. Preferred method: use `EnterWorktree` with name `migration-{contract-id}`. If `EnterWorktree` is unavailable (headless `-p` mode), use git directly:
    ```bash
    git checkout -b migration-{contract-id} origin/main
    ```
    If this is a resume session (draft PR found in step 7), check out the existing branch instead.
16. After entering the worktree, ensure it's up to date:
    ```bash
    git fetch origin && git rebase origin/main
    ```
17. **Write test files first.** For each acceptance criterion in the contract:
    - Create the test file (e.g., `attention_handlers_test.go`, `JobQueuePanel.test.tsx`)
    - Write test functions matching the verification commands (e.g., `TestResolveAttention`)
    - Tests should assert the expected behavior described in the AC
    - For Go: write test functions with the expected HTTP status codes, response shapes, and DB state assertions
    - For frontend: write test cases with expected renders, user interactions, and API call assertions
    - Include at minimum: happy path, primary error path (e.g., 409, 403), and edge case per AC
18. **Create minimal stubs** so tests compile but fail:
    - Go: empty handler functions that return 501 Not Implemented, empty DB query functions that return errors
    - Frontend: component shells that render nothing, API functions that throw "not implemented"
19. **Run tests — verify they ALL FAIL (Red).** This confirms your tests actually test something:
    ```bash
    # Go:
    cd platform/migration && go test ./... -run "TestResolveAttention|TestDeferAttention|..." -count=1 -v
    # Frontend:
    cd frontend && npm test -- --run -t "AttentionQueue|JobQueuePanel|..."
    ```
    If any test passes at this stage, the test is not asserting the right behavior — fix the test.
20. **Commit the failing tests** as a checkpoint:
    ```bash
    git add <test files and stubs>
    git commit -m "RED: [migration/{contract-id}] test scaffolding — all tests failing"
    ```

### Phase 3: Green — Make Tests Pass

21. Implement the actual logic, one AC at a time:
    - Pick the simplest AC first (build confidence, establish patterns)
    - Write just enough code to make that AC's tests pass
    - Run `/validate` after each AC is green
    - Do not proceed past a failing `/validate` — fix it before continuing
22. After all ACs are green, run the full verification suite:
    ```bash
    # Run every verification command from the contract's acceptance_criteria
    ```
    Every AC verification command must pass.

### Phase 4: Refactor — Quality Gates

23. **Squash into a clean commit** before running quality gates:
    ```bash
    git add <all implementation files>
    git commit -m "GREEN: [migration/{contract-id}] all tests passing"
    ```
24. Run `/validate` — full lint + typecheck + test suite
25. Run `/simplify` — up to 3 cycles of code cleanup (the Refactor in Red-Green-Refactor)
26. Run `/validate` — confirm simplify didn't break anything
27. Run `/precommit` — 4-category graded evaluation
28. If any category grades FAIL:
    - Fix the issue
    - Re-run from step 24
    - Maximum 3 fix-and-rerun cycles
    - If still failing after 3 cycles, create a **draft** PR (not ready for review), document the unresolved issue in the PR description, and proceed to Phase 5

### Phase 5: Ship

29. Squash all commits (RED + GREEN + refactor) into a single clean commit:
    ```bash
    # Count commits since branching from main:
    N=$(git rev-list --count origin/main..HEAD)
    if [ "$N" -gt 0 ] 2>/dev/null; then
      git reset --soft HEAD~$N && git commit -m "[migration/{contract-id}] {goal from contract}"
    else
      echo "No commits to squash — single commit already clean"
    fi
    ```
    **Do NOT use `git rebase -i` — it requires interactive input and will hang in headless sessions.**
30. Push and create PR:
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
31. Run `/session-end`

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
- Test fixtures use obviously fake data (Jane Doe, SSN 000-00-0000, $1234.56). No realistic PII. Test SourceConnection objects use localhost/test credentials, never real hostnames or passwords.

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
- **Red phase: tests won't compile even with stubs** → check for import cycles or missing dependencies. If unfixable after 3 attempts, create a draft PR with the test files and document the compilation issue.
- **Green phase: stuck on one AC after 3 attempts** → commit partial progress (passing ACs green, stuck AC still red). Create a draft PR documenting which AC is stuck and why. The next session can pick up from the GREEN commit.
- **Red phase: a test passes unexpectedly** → the test is wrong, not the code. Rewrite the test to assert the correct behavior. If it still passes after 3 rewrites, the behavior may already be implemented — verify and document.

### Autonomous Mode Overrides

When running in a headless `-p` session (no interactive user):
- **Session-end Gate 2** ("Commit or discard?"): Always commit. Never discard work.
- **Session-end Gate 3** ("Merge and clean up?"): Always choose **Path C** — push, create PR, keep worktree. Do not attempt to merge PRs autonomously.
- **Any interactive confirmation prompt**: Choose the non-destructive option. Never delete, discard, or force-push without a human present.

### Contract JSON Schema

Contracts are in `docs/contracts/` and follow `config/schemas/sprint_contract.schema.json`.
