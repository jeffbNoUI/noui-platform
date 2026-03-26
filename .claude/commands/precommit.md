# Precommit

Graded pre-commit evaluation. Run `/precommit` BEFORE committing to catch issues early.

## Phase 1: Persona Review (Plan-Time — if in plan mode)

If currently in plan mode and the plan touches UI, data model, API routes, or permission logic:

1. Read `config/rubrics/persona-review.json`
2. Spawn 3 parallel reviewer agents. Each receives ONLY its tier's section from the rubric:
   - **T1 Reviewer**: tier1 rubric + review_prompt + the plan under review
   - **T2 Reviewer**: tier2 rubric + review_prompt + the plan under review
   - **T3 Reviewer**: tier3 rubric + review_prompt + the plan under review
3. Each reviewer grades every criterion as: pass / fail / warning
4. Each reviewer must provide evidence for every grade — no grade without evidence
5. Collect all 3 reports, then act as Reconciler:
   - Detect conflicts between tiers
   - Resolve conflicts using fixed priority: T1 > T2 > T3
   - Produce unified verdict: overall pass/fail, blockers, warnings, conflicts resolved
6. Present the unified verdict. If any blocker exists, the plan must be revised.

## Phase 2: Implementation Review (Pre-Commit)

Run after implementation, before commit. Four grading categories:

### Category 1: Spec Adherence
- Read the relevant spec file (if one exists for this module)
- Read CLAUDE.md behavioral guidelines
- Grade: Does the code match the spec? Are CLAUDE.md rules followed?

### Category 2: Type Safety
- Language-specific checks (TypeScript: no `any`, no `enum`; Python: type hints; etc.)
- Framework-specific checks per CLAUDE.md

### Category 3: Data Isolation
- Multi-tenancy checks (RLS, tenant scoping, auth guards)
- PII / security boundary checks
- Permission model enforcement

### Category 4: Test Coverage
```bash
cd frontend && npm test -- --run 2>&1 | tail -10
```
- New code paths have corresponding tests
- All existing tests still pass
- If sprint contract exists at `docs/contracts/sprint-*.json`, grade against it

## Grading

Each category: **PASS**, **FAIL**, or **WARNING**

- Any FAIL = must fix before committing
- WARNINGs are reported but don't block

```
## Review Verdict

| Category | Grade | Notes |
|----------|-------|-------|
| Spec adherence | PASS/FAIL/WARNING | ... |
| Type safety | PASS/FAIL/WARNING | ... |
| Data isolation | PASS/FAIL/WARNING | ... |
| Test coverage | PASS/FAIL/WARNING | ... |

**Overall: [PASS/FAIL/WARNING]** — [summary]
```
