# Phase 2: CRM Integration

## Goal

Switch the Member Dashboard's CRM data (contacts, interactions, commitments) from the in-memory demo store to live API calls against the CRM Go service backed by PostgreSQL.

## Context

Read `docs/INTEGRATION_PLAN.md` for the full plan. This is Phase 2 of 5.

## Entry Criteria

- Phase 1 complete: Docker stack runs, all health endpoints respond
- CRM service accessible at `http://localhost:8084`

## Tasks

1. Run `/session-start`
2. Start Docker stack: `docker compose up`
3. Verify CRM seed data:
   - `curl http://localhost:8084/api/v1/crm/contacts-by-legacy/10001` → Robert's contact
   - `curl http://localhost:8084/api/v1/crm/contacts/{contactId}/timeline` → interactions
4. Compare real API response shapes vs. demo data shapes — identify mismatches
5. Switch hooks in `frontend/src/hooks/useCRM.ts`:
   - `useContactByMemberId()` → `crmAPI.getContactByLegacyId()`
   - `useFullTimeline()` → `crmAPI.getContactTimeline()`
   - `useContactCommitments()` → `crmAPI.listCommitments()`
6. Handle the `{ data, meta, pagination }` envelope (real API) vs raw arrays (demo)
7. Handle loading/error states (demo is instant, real API has latency)
8. Test in browser: Member Dashboard for member 10001
9. Verify InteractionHistoryCard shows real data
10. Run `cd frontend && npm test -- --run`
11. Run `cd platform/crm && go test ./...`
12. Update `docs/INTEGRATION_PLAN.md` Phase 2 status

## Key Decision

**Demo data fallback:** Should hooks fall back to demo data when the API is unavailable (e.g., local dev without Docker)? Or hard-switch to API only?

## Key Files

| File | Action |
|------|--------|
| `frontend/src/hooks/useCRM.ts` | **Modify** — switch portal hooks from demo to real API |
| `frontend/src/hooks/useMemberDashboard.ts` | **Modify** — update CRM data flow |
| `frontend/src/lib/crmApi.ts` | **Reference** — real API client (already exists) |
| `frontend/src/lib/crmDemoData.ts` | **Reference** — demo data being replaced |
| `frontend/src/types/CRM.ts` | **Reference** — type definitions |

## Exit Criteria

- InteractionHistoryCard shows data from PostgreSQL via CRM service
- No demo CRM data used in the dashboard path
- Frontend tests pass
- CRM service tests pass
