# Session Starter — Post-Phase 8: Employer Domain Next Steps

## Context

Phase 8 (Cross-Service Enhancement) is complete. All 5 existing platform services are now employer-aware:

| Service | New Endpoints | Tests |
|---------|--------------|-------|
| Data Access | 2 (member roster, member summary) | 5 |
| CRM | 3 (org interactions, org contacts, employer interaction) | 7 |
| Correspondence | 2 (employer templates, employer letter generation) | 5 |
| Data Quality | 3 (employer DQ score, issues, checks) | 11 |
| Case Management | 3 (employer cases, case summary, trigger-based case creation) | 17 |

**Total: 13 new endpoints, 45 new tests, zero regressions.**

The employer domain now spans **Phases 1–8**: 6 dedicated services (ports 8094–8099), 27 DB tables, 108+ employer service endpoints, 13 cross-service endpoints, and 279+ Go tests.

## What's Left

Phase 8 completed the **data plumbing** — making existing services employer-aware. The master plan (`docs/plans/2026-03-19-employer-domain-plan.md`) does not define a Phase 9+, but several logical next steps exist:

### Option A: Employer Agent Desktop (Frontend)
Build a staff-facing employer agent desktop that consumes the new Phase 8 endpoints. This would be a new frontend component (e.g., `EmployerAgentDesktop.tsx`) providing:
- Employer health dashboard (DQ score, case summary, open issues)
- Member roster for the selected employer
- Recent interactions and correspondence
- Trigger actions (create cases, generate letters)
- SLA tracking across employer cases

**Depends on:** All 13 Phase 8 endpoints, plus the existing employer portal frontend.

### Option B: Frontend Integration of Phase 8 Endpoints
Wire the 13 new cross-service endpoints into the existing `EmployerPortalApp` tabs. Currently the portal only calls dedicated employer services (8094–8099). Adding:
- DQ score widget on the employer dashboard
- Case list filtered to employer members
- Correspondence generation from the portal
- CRM interaction history per employer

**Depends on:** Phase 8 endpoints + existing `EmployerPortalApp` component.

### Option C: Deferred Infrastructure Work
From `project_deferred_enhancements.md`:
- Security events service (Clerk webhooks, brute-force detection, session timeout)
- Issue Management service (SLA tracking, notifications, assignment)
- Both need background job infrastructure not yet built

### Option D: Non-Employer Work
Return to the PRISM estimation platform (Sprint 12+) or other pension domain work.

## Key Architecture Notes for Next Session

1. **Route prefix pattern:** Phase 8 established `/api/v1/employer/{orgId}/...` for employer-scoped endpoints on existing services (casemanagement uses this to avoid Go 1.22 ServeMux wildcard conflicts with `/cases/{id}`)

2. **Member↔Employer bridge:** `crm_organization(org_id)` → `crm_org_contact(contact_id)` → `crm_contact(legacy_mbr_id)` → `MEMBER_MASTER(member_id)`. Requires `CAST(m.member_id AS TEXT)` due to SERIAL vs VARCHAR type mismatch.

3. **Trigger-based case creation** uses `triggerReferenceId` as the `caseID` for idempotency. The `domain/triggers.go` mapping defines SLA/priority defaults per trigger type.

4. **Employer target tables** for DQ checks: `contribution_file`, `contribution_record`, `contribution_exception`, `enrollment_submission`, `termination_certification`, `certification_hold`.

## Verification

```bash
# Verify all 5 enhanced services
cd platform/dataaccess && go build ./... && go test ./... -short
cd ../crm && go build ./... && go test ./... -short
cd ../correspondence && go build ./... && go test ./... -short
cd ../dataquality && go build ./... && go test ./... -short
cd ../casemanagement && go build ./... && go test ./... -short
```

## Read First

- `BUILD_HISTORY.md` — Phase 8 entry at top
- `docs/plans/2026-03-19-employer-domain-plan.md` — Full employer domain plan (Phases 1–8)
- `docs/plans/2026-03-19-employer-phase8-session-starter.md` — Phase 8 original session starter
