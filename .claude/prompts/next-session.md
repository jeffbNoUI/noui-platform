# Next Session Starter

## Current State (as of 2026-03-11)

**Branch `claude/competent-banzai` has 4 bug-fix commits ready for PR.** These fix 3 bugs found during E2E workflow testing of the 4 seeded retirement cases, plus 1 additional bug discovered during live verification.

### Commits on this branch (oldest → newest):

1. **`4f28494`** — `[platform/intelligence] Fix Rule of N sum missing from eligibility response`
   - Added `RuleOfNSum` field to Go `EligibilityResult` struct + set it in `EvaluateEligibility()`
   - Added `rule_of_n_sum` to frontend `EligibilityResult` type
   - Updated `EligibilityStage.tsx` to read new field with backward-compatible fallback
   - Added RuleOfNSum assertions to Go eligibility tests + frontend test fixtures

2. **`93d1ff4`** — `[frontend] Fix DRO stage appearing on non-DRO cases in deriveCaseFlags`
   - Root cause: `deriveCaseFlags()` OR'd case flags with member-level DRO data
   - Fix: Case flags are authoritative when present; member data is fallback only
   - Created `workflowComposition.test.ts` with 7 regression tests

3. **`54c6326`** — `[platform/intelligence + frontend] Fix DRO payment calculation using wrong retirement date`
   - Added `retirement_date` to `DROCalcRequest` struct (required field)
   - Handler now validates and parses date instead of using `time.Now()`
   - Frontend `calculateDRO` API updated to pass retirement date

4. **`ecd1a93`** — `[platform/intelligence] Fix DRO date parsing — dataaccess returns RFC3339, not bare dates`
   - Root cause: `fetchDRO()` parsed dates with `"2006-01-02"` but dataaccess returns `"1999-08-15T00:00:00Z"`
   - Silent parse failure left zero-value dates → negative marital fractions → $85K inflated payments
   - Added `parseFlexDate()` helper that tries bare date then RFC3339

### Verified results:
- Martinez eligibility: `rule_of_n_sum = 91.75` (was 0.00)
- Martinez standard case: 7 stages, no DRO (was showing DRO stage incorrectly)
- Martinez DRO case: 8 stages, DRO Division included correctly
- Martinez DRO benefit: `member_benefit_after_dro = $2,213.35` (was $85,238.94)
- 18/18 Go intelligence tests pass
- 204/204 frontend tests pass (including 7 new workflowComposition tests)

## First Action: Create PR

These 4 commits are tested, verified, and ready. Create a PR against `main`:

```bash
git push -u origin claude/competent-banzai
gh pr create --title "Fix 3 E2E bugs: Rule of N sum, DRO stage visibility, DRO date parsing" --body "..."
```

## What's built and running on main:

- 10-service Docker Compose stack: 7 Go services + PostgreSQL + connector + nginx frontend
- All 12 PostgreSQL init scripts (schema + seed) run on first boot
- Staff Portal work queue showing 4 live retirement cases
- Member Dashboard with 8 cards — all showing live data
- 197/197 frontend tests on main (204/204 on this branch with new tests)

## What to Work On After PR Merge

### Option A: Interaction Detail Panel
An approved plan exists at `.claude/plans/shiny-inventing-allen.md` and prompt at `.claude/prompts/interaction-detail-panel.md`. This adds a click-to-expand detail panel to the interaction history card with spawn-from-row animation. 3 new files, 2 modified files.

### Option B: Case Management Go Tests
`platform/casemanagement/` has zero test coverage. Adding handler tests would match patterns in `platform/crm/api/handlers_test.go`.

### Option C: E2E Workflow Stage Advancement
Click through the full 7/8-stage workflow in the browser: advance stages via `POST /api/v1/cases/{id}/advance`, verify stage transitions, audit trail, and that eligibility/benefit data renders correctly at each stage.

### Option D: User's Choice
The platform is at a stable milestone with all critical calculation bugs fixed.

## Services Reference

| Service | Port | Status |
|---------|------|--------|
| `platform/dataaccess` | 8081 | Live — member/salary/benefit queries |
| `platform/intelligence` | 8082 | Live — eligibility, benefit calc, DRO |
| `platform/crm` | 8083 (host: 8084) | Live — contacts, interactions, messaging |
| `platform/correspondence` | 8085 | Live — templates, merge fields, letters |
| `platform/dataquality` | 8086 | Live — quality checks, scoring, issues |
| `platform/knowledgebase` | 8087 | Live — articles, stage help, search |
| `platform/casemanagement` | 8088 | Live — case workflow, 7 stages, work queue |
| `connector` | 8090 | Live — schema introspection |

## Build Verification

```bash
# Frontend
cd frontend && npx tsc --noEmit && npm test -- --run

# Go services
cd platform/intelligence && go build ./... && go test ./...
cd platform/dataaccess && go build ./... && go test ./...
cd platform/casemanagement && go build ./...
```
