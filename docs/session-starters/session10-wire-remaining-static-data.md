# Session 10 Starter: Wire Remaining Static Data to Live APIs

## Context

Session 9 (PR pending) expanded demo data from 3 members / 6 cases to 12 members / 18 cases. Dashboards now have realistic data volumes, charts show distributions, and member search returns meaningful results. Docker E2E verified, 355 frontend tests passing.

**Problem:** Several dashboard components still render hardcoded static arrays instead of live API data. The expanded seed data makes this visible — the SupervisorDashboard "Team Performance" table shows 5 fake team members while the work queue shows real cases from 4 assignees.

## Static Data Inventory

### Priority 1 — High Impact, API Already Exists

| Component | Static Data | Live API Available | Notes |
|-----------|------------|-------------------|-------|
| `SupervisorDashboard.tsx` | `TEAM_MEMBERS` (5 hardcoded entries) | `/cases/stats` returns `casesByAssignee` with `assignedTo`, `count`, `avgDaysOpen` | Map casesByAssignee to team table; proficiency/efficiency can be computed from avg days |
| `ExecutiveDashboard.tsx` | `VOLUME_DATA` (6-month static chart) | None yet | Needs new API endpoint — aggregate cases by month from `retirement_case.created_at` |
| `ExecutiveDashboard.tsx` | `STATIC_HEALTH` (4 system health items) | Partial — DQ score is live | Could aggregate from existing endpoints or keep as styled demo |

### Priority 2 — Requires New API Work

| Component | Static Data | What's Needed |
|-----------|------------|---------------|
| `EmployerPortal.tsx` | `DEMO_REPORTING_PERIODS` (6 contribution periods) | Entire Reporting tab is demo. Would need a contribution reporting API |
| `VendorPortal.tsx` | All data (`ENROLLMENT_QUEUE`, stats, etc.) | Entirely hardcoded. Would need vendor-specific APIs |
| `CSRContextHub.tsx` | `MEMBERS` array (3 hardcoded members) | Currently a demo panel. Would need a "recent members" or "pinned members" API |

### Priority 3 — Minor / Acceptable as Static

| Component | Static Data | Notes |
|-----------|------------|-------|
| `MemberPortal.tsx` | Growth rates (7.2%, 5%) in projection chart | Reasonable defaults, could be config |
| `StaffPortal.tsx` | Demo user "Sarah Chen" | Expected — auth-based user identity |
| Various dashboards | Color maps, stage names, styling constants | These are UI constants, not data |

## Session 10 Goal

Wire the highest-impact static arrays to live data. Focus on Priority 1 items that already have (or nearly have) API support. Leave Priority 2-3 for future sessions.

## Deliverables

### 1. Wire SupervisorDashboard Team Performance (Required)

Replace the `TEAM_MEMBERS` static array with live `casesByAssignee` data from the existing `/cases/stats` endpoint.

**Current static data:**
```typescript
const TEAM_MEMBERS = [
  { name: 'Sarah Chen', role: 'Senior Analyst', activeCases: 12, ... },
  ...
];
```

**Available API data (`useCaseStats()`):**
```json
{ "casesByAssignee": [
    { "assignedTo": "Sarah Chen", "count": 9, "avgDaysOpen": 25.3 },
    ...
]}
```

Approach:
- Map `casesByAssignee` entries to the team table rows
- Compute "efficiency" from `avgDaysOpen` relative to average SLA (90 days)
- Keep proficiency styling (green/yellow) based on computed efficiency
- Graceful fallback if API returns empty

### 2. Wire ExecutiveDashboard Processing Volume (Required)

Replace `VOLUME_DATA` (6-month static chart) with real case creation data.

**Option A — Frontend aggregation:** Query all cases via existing API, group by `created_at` month in the frontend. Works with current data but limited to seed date range.

**Option B — New API endpoint:** Add `GET /cases/stats/volume?months=6` that returns monthly case counts directly from SQL. More robust, reusable.

**Recommendation:** Option B — a small SQL query (`SELECT date_trunc('month', created_at), count(*) ... GROUP BY 1`) gives cleaner data and keeps the frontend simple.

### 3. Wire ExecutiveDashboard System Health (Nice to Have)

Replace `STATIC_HEALTH` with aggregated status from existing endpoints:
- Data Quality: Already live via `dqAPI.getScore()`
- API Latency: Could compute from actual response times (complex)
- Storage / Uptime: Would need infrastructure APIs (skip)

Recommendation: Wire DQ score into the health panel, keep remaining items as styled indicators.

### 4. Docker Rebuild + Verify (Required)

After changes:
```bash
docker compose down -v
docker compose up --build -d
```

Verify:
- SupervisorDashboard team table shows real assignees from seed data
- ExecutiveDashboard volume chart shows case creation over time
- No regressions in existing dashboard functionality
- Frontend tests pass

## Key Design Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Team table data source | New endpoint vs. existing `casesByAssignee` | **Existing** — already returns what we need |
| Volume chart endpoint | Frontend aggregation vs. new SQL endpoint | **New endpoint** — cleaner separation |
| Volume endpoint location | `/cases/stats/volume` | Follows existing `/cases/stats/*` pattern |
| System health wiring | Full live data vs. partial | **Partial** — wire DQ score, keep rest as indicators |
| Empty state handling | Show loading vs. fallback data | **Loading skeleton** — consistent with other panels |

## Files to Create/Modify

### Create
- `platform/casemanagement/stats_volume.go` (or extend `stats.go`) — monthly volume query
- Corresponding route registration

### Modify
- `frontend/src/components/dashboards/SupervisorDashboard.tsx` — replace `TEAM_MEMBERS` with `casesByAssignee`
- `frontend/src/components/dashboards/ExecutiveDashboard.tsx` — replace `VOLUME_DATA` with API call, optionally wire DQ into health
- Frontend API hook (if new endpoint needed)

## Acceptance Criteria

- [ ] SupervisorDashboard team table renders live assignee data (4 assignees from seed)
- [ ] ExecutiveDashboard volume chart shows real monthly case creation counts
- [ ] Graceful empty states when API returns no data
- [ ] Docker stack starts cleanly
- [ ] 355+ frontend tests passing, zero regressions
- [ ] TypeScript clean (`npx tsc --noEmit`)
