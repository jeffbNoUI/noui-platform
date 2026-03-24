# Migration Phase 5h: Next Steps — Starter Prompt

## Context

Migration Phase 5g is complete. All known defects from Phase 5f are fixed:

- **dbcontext:** `defer tx.Rollback()` prevents stale connection cascades
- **employer-reporting:** `uploaded_by` wired to portal user UUID (from request body or JWT)
- **employer-terminations:** `parseFlexDate()` handles both date and timestamp formats
- **E2E:** JWT uses UUID sub, division codes corrected, portal user ID extraction fixed

### Stats (Phase 5g)
- 7 files changed
- Docker E2E: **167/167** across 5 suites (20+50+24+23+50)
- Zero skips, zero failures
- Employer suite grew from 46 to 50 tests

### E2E Suite Summary
| Suite | Tests | Status |
|-------|-------|--------|
| Workflows | 20 | PASS |
| Services Hub | 50 | PASS |
| Correspondence | 24 | PASS |
| Migration | 23 | PASS |
| Employer | 50 | PASS |
| **Total** | **167** | **ALL PASS** |

## What's Next

Options for Phase 5h (discuss with user):

1. **PR for Phase 5g** — Create PR from `claude/ecstatic-rosalind` to `main`
2. **Employer service hardening** — Add negative test cases, edge cases, error paths
3. **Next migration phase** — Check BUILD_HISTORY and migration roadmap for what follows
4. **Frontend integration** — Wire employer portal UI to the new E2E-verified endpoints

## Architecture Reference

- **dbcontext fix:** `platform/dbcontext/dbcontext.go:171` — single `defer tx.Rollback()` line
- **employer-reporting:** `platform/employer-reporting/api/handlers.go` — `auth.UserID` + request body fallback
- **employer-terminations:** `platform/employer-terminations/domain/refund.go:183-190` — `parseFlexDate` helper
- **E2E scripts:** `tests/e2e/employer_e2e.sh`, `tests/e2e/lib/jwt.sh`, `tests/e2e/workflows_e2e.sh`
