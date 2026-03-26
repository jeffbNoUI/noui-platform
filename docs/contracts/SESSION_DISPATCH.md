# Session Dispatch — Quality-Gated Workflow

This document is the canonical prompt for autonomous migration build sessions.
Each session receives this workflow along with a specific sprint contract.

---

## Instructions

You are executing an autonomous build session for the NoUI migration services.
Your sprint contract is specified in the session launch command.

Follow this workflow exactly. Do not skip steps.

### Phase 1: Design (before writing any code)

1. Read the sprint contract JSON file
2. Read CLAUDE.md for project rules and conventions
3. Read the relevant source files and specs listed in the contract
4. Write an implementation design:
   - Which files you'll create or modify (list each one)
   - What tests you'll write
   - Edge cases and error paths
   - How this connects to the existing codebase
5. Spawn an independent reviewer agent (subagent_type: "feature-dev:code-reviewer") with:
   - Your implementation design
   - The contract's `design_review_rubric`
   - CLAUDE.md security rules, fiduciary rules, and layer boundary rules
   - Instruction: "Grade this design against the rubric. Return CRITICAL, HIGH, and MEDIUM findings. Do not see the implementer's reasoning — evaluate the design independently."
6. Address all CRITICAL findings. Address all HIGH findings that are feasible.
7. If you made significant changes, re-submit to the reviewer agent.
8. Log the final design review verdict in your session notes.
9. Only proceed to Phase 2 when all CRITICAL pass and all feasible HIGH pass.

### Phase 2: Implement

10. Create a worktree for this contract
11. Implement against the reviewed design
12. Run `/validate` after each significant change (new file, new test, new endpoint)
13. Do not proceed past a failing `/validate` — fix it before continuing

### Phase 3: Quality Gates

14. Run `/validate` — full lint + typecheck + test suite
15. Run `/simplify` — up to 3 cycles of code cleanup
16. Run `/validate` — confirm simplify didn't break anything
17. Run `/precommit` — 4-category graded evaluation
18. If any category grades FAIL:
    - Fix the issue
    - Re-run from step 14
    - Maximum 3 fix-and-rerun cycles; if still failing, document the issue and proceed

### Phase 4: Ship

19. Commit with message format: `[migration/{contract-id}] {goal from contract}`
20. Push and create PR with:
    - Title: `[migration/{contract-id}] {goal}`
    - Body includes: design review verdict, `/precommit` grade, test results
    - Label: `migration-build`
21. Run `/session-end`

### Dependency Check (run at session start)

Before starting Phase 1, verify prerequisites:
```bash
# Check that prerequisite contracts have been merged
# (listed in contract's "depends_on" field)
gh pr list --state merged --label migration-build --json title
```

If a prerequisite contract's PR is not merged, STOP and report:
```
BLOCKED: Prerequisite contract {id} not yet merged.
Cannot proceed with {current contract id}.
```

### If Something Goes Wrong

- Build fails and you can't fix it in 3 attempts → create the PR anyway, mark as draft, document the failure
- Test fails that isn't related to your changes → document it, don't fix unrelated failures
- Design reviewer finds a CRITICAL issue you can't resolve → create the PR as draft, document the blocker
- You run out of context → commit what you have, create a draft PR, write a detailed starter prompt

### Contract JSON Schema

Contracts are located in `docs/contracts/` and follow the schema at `config/schemas/sprint_contract.schema.json`.

Additional fields beyond the schema:
- `depends_on`: array of contract IDs that must be merged first
- `layer`: "go", "frontend", "python", "db", "tests"
- `design_review_rubric`: object with `critical`, `high`, `medium` arrays
- `quality_workflow`: array of slash commands to run in Phase 3
- `files_hint`: array of files likely to be created or modified (guidance, not prescriptive)
