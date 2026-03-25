# Precommit

Graded pre-commit evaluation. Run `/precommit` BEFORE committing to catch issues early.

## Phase 1: Persona Review (Plan-Time — if in plan mode)

If currently in plan mode and the plan touches UI, data model, API routes, or permission logic:

1. Read `config/rubrics/persona-review.json`
2. Spawn 4 parallel reviewer agents. Each receives ONLY its tier's section from the rubric:
   - **T1 Staff Reviewer**: tier1_staff rubric + review_prompt + the plan under review
   - **T2 Member Reviewer**: tier2_member rubric + review_prompt + the plan under review
   - **T2 Employer Reviewer**: tier2_employer rubric + review_prompt + the plan under review
   - **T2 Vendor Reviewer**: tier2_vendor rubric + review_prompt + the plan under review
3. Each reviewer grades every criterion as: pass / fail / warning
4. Each reviewer must provide evidence for every grade — no grade without evidence
5. Collect all 4 reports, then act as Reconciler:
   - Detect conflicts between tiers
   - T1 (Staff) wins over any T2 conflict
   - Conflicts within T2 (Member vs Employer vs Vendor) are flagged for human resolution
   - Produce unified verdict: overall pass/fail, blockers, warnings, conflicts resolved
6. Present the unified verdict. If any blocker exists, the plan must be revised.

## Phase 2: Implementation Review (Pre-Commit)

Run after implementation, before commit. Four grading categories:

### Category 1: Spec Adherence
- Read the relevant spec file (if one exists for this module)
- Read CLAUDE.md behavioral guidelines (layer boundaries, AI boundaries, fiduciary rules, security rules)
- Grade: Does the code match the spec? Are CLAUDE.md rules followed?

### Category 2: Type Safety
- Go: `go vet ./...` in each modified service directory
- TypeScript: `npx tsc --noEmit` — no `any` types, no `enum`
- All monetary values use appropriate precision types (`big.Rat` in Go, `decimal.js` in TS)

### Category 3: Data Isolation
- Multi-tenancy checks (tenant scoping, auth guards)
- JWT claim extraction — identity from context, never headers
- Layer boundary enforcement (connector ↛ platform, platform ↛ connector)
- Permission model enforcement per CLAUDE.md role matrix

### Category 4: Test Coverage
```bash
# Run tests in modified modules
cd frontend && npx tsc --noEmit && npm test -- --run 2>&1 | tail -10
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
