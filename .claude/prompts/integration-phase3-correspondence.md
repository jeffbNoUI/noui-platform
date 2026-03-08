# Phase 3: Correspondence Integration

## Goal

Switch the Member Dashboard's correspondence history from demo data to live API calls against the Correspondence Go service.

## Context

Read `docs/INTEGRATION_PLAN.md` for the full plan. This is Phase 3 of 5.

## Entry Criteria

- Phase 2 complete: CRM running on real API
- Correspondence service accessible at `http://localhost:8085`

## Tasks

1. Run `/session-start`
2. Start Docker stack: `docker compose up`
3. Verify correspondence service:
   - `curl http://localhost:8085/api/v1/correspondence/templates` → 5 templates
   - `curl http://localhost:8085/api/v1/correspondence/history?member_id=10001` → letters
4. **Seed data gap:** The seed has templates but may lack generated correspondence history. If the history endpoint returns empty:
   - Add seed records to `domains/pension/seed/006_correspondence_seed.sql`
   - Or generate test letters via `POST /api/v1/correspondence/generate`
5. Create `frontend/src/hooks/useCorrespondence.ts` with `useCorrespondenceHistory(memberId)` hook
6. Update `frontend/src/hooks/useMemberDashboard.ts` — replace `DEMO_CORRESPONDENCE`
7. Update `CorrespondenceHistoryCard.tsx` if real data shape differs from demo
8. Test in browser
9. Run frontend tests
10. Update `docs/INTEGRATION_PLAN.md` Phase 3 status

## Key Files

| File | Action |
|------|--------|
| `frontend/src/hooks/useMemberDashboard.ts` | **Modify** — replace demo correspondence |
| `frontend/src/hooks/useCorrespondence.ts` | **Create** — correspondence hooks |
| `frontend/src/lib/correspondenceApi.ts` | **Reference** — API client exists |
| `frontend/src/lib/demoData.ts` | **Reference** — `DEMO_CORRESPONDENCE` being replaced |
| `domains/pension/seed/006_correspondence_seed.sql` | **Possibly modify** — add history records |

## Exit Criteria

- CorrespondenceHistoryCard shows data from PostgreSQL
- Frontend tests pass
