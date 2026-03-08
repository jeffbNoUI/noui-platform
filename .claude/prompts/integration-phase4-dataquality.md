# Phase 4: Data Quality Integration

## Goal

Switch the Member Dashboard's data quality card from demo data to live API calls against the Data Quality Go service.

## Context

Read `docs/INTEGRATION_PLAN.md` for the full plan. This is Phase 4 of 5.

## Entry Criteria

- Phase 3 complete: Correspondence on real API
- Data Quality service accessible at `http://localhost:8086`

## Tasks

1. Run `/session-start`
2. Start Docker stack: `docker compose up`
3. Verify DQ service:
   - `curl http://localhost:8086/api/v1/dq/issues` → 4 open issues
   - `curl http://localhost:8086/api/v1/dq/score` → overall quality score
   - `curl http://localhost:8086/api/v1/dq/score/trend?days=30` → trend data
4. **Design decision:** DQ issues in seed data use record IDs (1247, 1398), not member IDs (10001-10003). Options:
   - Show org-wide DQ issues on the dashboard (not per-member)
   - Add member_id to DQ issue schema and update seed data
   - Ask the user which approach they prefer
5. Create `frontend/src/hooks/useDataQuality.ts` with DQ hooks
6. Update `frontend/src/hooks/useMemberDashboard.ts` — replace `DEMO_DQ_ISSUES`
7. Update `DataQualityCard.tsx` if needed
8. Test in browser
9. Run frontend tests
10. Update `docs/INTEGRATION_PLAN.md` Phase 4 status

## Key Files

| File | Action |
|------|--------|
| `frontend/src/hooks/useMemberDashboard.ts` | **Modify** — replace demo DQ data |
| `frontend/src/hooks/useDataQuality.ts` | **Create** — DQ hooks |
| `frontend/src/lib/dqApi.ts` | **Reference** — API client exists |
| `frontend/src/lib/demoData.ts` | **Reference** — `DEMO_DQ_ISSUES` being replaced |
| `domains/pension/seed/005_dataquality_seed.sql` | **Possibly modify** — add member refs |

## Key Decision

Should the DQ card show per-member issues or org-wide quality metrics? This affects both the API query and the card's presentation.

## Exit Criteria

- DataQualityCard shows data from PostgreSQL
- Frontend tests pass
