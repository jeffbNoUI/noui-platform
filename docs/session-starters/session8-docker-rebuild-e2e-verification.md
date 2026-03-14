# Session 8 Starter: Docker Rebuild + End-to-End Dashboard Verification

## Context

Session 7 (PR #52, merged) wired the frontend dashboards and member search to live backend APIs:
- `SupervisorDashboard` now uses `useCaseStats()` and `useCases({ stage: 'certification' })` for KPIs, caseload chart, and approval queue
- `ExecutiveDashboard` now uses `useSLAStats()` for On-Time Rate, Avg Processing, and a new SLA Health Breakdown stacked bar
- `MemberSearch` now uses `useMemberSearch()` hook with 300ms debounced API calls to `/v1/members/search`
- 21 new component tests added (SupervisorDashboard: 8, ExecutiveDashboard: 7, MemberSearch: 6)
- 355 frontend tests passing, zero regressions

**Problem:** The running Docker containers were built **before** PR #50 added the backend endpoints (`/api/v1/cases/stats`, `/api/v1/cases/stats/sla`, `/api/v1/members/search`). The frontend gracefully degrades (shows `--` placeholders, subtle error notices), but no live data flows until the containers are rebuilt.

## Session 8 Goal

Rebuild Docker images so the backend serves the stats and search endpoints. Then verify end-to-end that the dashboards display live data and member search returns results. Fix any integration issues discovered during E2E testing.

## Deliverables

### 1. Docker Rebuild
```bash
docker compose down
docker compose up --build -d
```
Verify all services are healthy:
```bash
docker compose ps
# All services should show "Up" / "healthy"
```

### 2. Backend Endpoint Smoke Tests
Verify the new endpoints respond correctly:
```bash
# Case stats
curl -s http://localhost:8088/api/v1/cases/stats | jq .

# SLA stats
curl -s http://localhost:8088/api/v1/cases/stats/sla | jq .

# Member search
curl -s "http://localhost:8081/api/v1/members/search?q=Martinez&limit=5" | jq .

# Cases filtered by stage
curl -s "http://localhost:8088/api/v1/cases?stage=certification" | jq .
```

### 3. Frontend E2E Verification
With the dev server running (`cd frontend && npm run dev`), verify in the browser:

**SupervisorDashboard (`/staff` → Supervisor tab):**
- [ ] KPI cards show live numbers (Active Cases, At Risk, Completed MTD, Pending Approval)
- [ ] Caseload by Stage chart renders with real stage names and counts
- [ ] Approval queue shows certification-stage cases with Review buttons
- [ ] No error notices visible (amber banner should be absent)

**ExecutiveDashboard (`/staff` → Executive tab):**
- [ ] On-Time Rate shows a percentage (not `--`)
- [ ] Avg Processing shows days (not `--`)
- [ ] SLA Health Breakdown stacked bar renders with on-track/at-risk/overdue segments
- [ ] Data Quality KPI still loads from DQ API

**MemberSearch (search bar in StaffPortal header):**
- [ ] Typing a name shows results dropdown after ~300ms
- [ ] Results show first/last name, tier badge, department, status
- [ ] Clicking a result navigates to member detail
- [ ] Loading spinner appears during search
- [ ] Empty query shows no dropdown

### 4. Fix Any Integration Issues
Common things to check if data doesn't appear:
- **CORS**: Ensure the Go services allow the frontend origin
- **JSON field casing**: Frontend expects camelCase (`totalActive`), Go must use matching JSON tags
- **Envelope format**: `fetchAPI<T>` unwraps `{ data: T }` — verify Go endpoints return this envelope
- **Port mapping**: Verify `VITE_CASE_URL` and `VITE_DATA_URL` env vars match Docker port mappings

### 5. Optional: Seed More Test Data
If the dashboards look sparse with few cases, consider:
- Running the seed script to add more retirement cases across different stages
- Adding cases at different SLA states (on-track, at-risk, overdue) for a richer SLA breakdown
- Adding more members across departments for better search results

## Success Criteria
- All Docker services healthy
- All four new endpoints return valid JSON
- SupervisorDashboard shows live KPIs and caseload chart
- ExecutiveDashboard shows live SLA metrics with stacked bar
- MemberSearch returns results from the API
- 355+ frontend tests still passing

## Files Likely to Touch
- `docker-compose.yml` — if port or env changes needed
- `frontend/.env` or `frontend/.env.local` — if API URL config needs updating
- Any Go handler files if JSON response format doesn't match frontend expectations
- `BUILD_HISTORY.md` — update with Session 8 results
