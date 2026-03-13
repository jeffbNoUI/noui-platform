# Design: Dashboard Aggregation API + Member Search

**Date:** 2026-03-13
**Session:** 2 of 8 (Production Foundations)
**Services:** casemanagement (8088), dataaccess (8081)

## Deliverables

### 1. Case Stats Endpoint

`GET /api/v1/cases/stats` — tenant-scoped aggregation for supervisor dashboards.

Response shape:
```json
{
  "data": {
    "totalActive": 4,
    "completedMTD": 0,
    "atRiskCount": 1,
    "caseloadByStage": [{ "stage": "Intake & Verification", "stageIdx": 0, "count": 1 }],
    "casesByStatus": [{ "status": "active", "count": 3 }],
    "casesByPriority": [{ "priority": "urgent", "count": 1 }],
    "casesByAssignee": [{ "assignedTo": "Sarah Chen", "count": 2, "avgDaysOpen": 15.5 }]
  }
}
```

Implementation: 4 separate SQL queries in `GetCaseStats()` — simpler to test and read than one CTE mega-query. All tenant-scoped.

### 2. SLA Stats Endpoint

`GET /api/v1/cases/stats/sla` — SLA health for active cases.

Response shape:
```json
{
  "data": {
    "onTrack": 2,
    "atRisk": 1,
    "overdue": 1,
    "avgProcessingDays": 18.5,
    "thresholds": { "urgent": 6, "high": 12, "standard": 18 }
  }
}
```

SLA classification (20% proportional threshold):
- `overdue`: `sla_deadline_at < NOW()`
- `at_risk`: deadline within `sla_target_days * 0.20` days from now
- `on_track`: everything else

Single SQL query with `CASE WHEN` buckets. `avgProcessingDays` from `AVG(EXTRACT(EPOCH FROM NOW() - created_at) / 86400)`.

Thresholds field included so frontend doesn't hardcode priority-to-window mapping.

### 3. Stage Filter on ListCases

Add `Stage string` to `CaseFilter`. Handler reads `r.URL.Query().Get("stage")`. DB layer adds `WHERE rc.current_stage = $N` to dynamic query. Enables `GET /api/v1/cases?stage=Eligibility%20Review` for approval queue views.

### 4. Member Search

`GET /api/v1/members/search?q={query}&limit=10` in dataaccess service.

Response: lightweight `MemberSearchResult` (memberId, firstName, lastName, tier, dept, status) — not the full Member struct.

SQL: `WHERE LOWER(last_name) LIKE $1 OR LOWER(first_name) LIKE $1 OR CAST(member_id AS TEXT) = $2` with limit capped at 50.

Migration 012: functional index `CREATE INDEX idx_member_search ON member_master (LOWER(last_name), LOWER(first_name))`.

## Files

| File | Action |
|------|--------|
| `platform/casemanagement/models/types.go` | Add stats types, `Stage` to `CaseFilter` |
| `platform/casemanagement/db/stats.go` | New — `GetCaseStats()`, `GetSLAStats()` |
| `platform/casemanagement/db/cases.go` | Add stage filter to `ListCases` |
| `platform/casemanagement/api/handlers.go` | Add stats handlers + routes, stage param |
| `platform/dataaccess/models/types.go` | Add `MemberSearchResult` |
| `platform/dataaccess/api/handlers.go` | Add `SearchMembers` handler + route |
| `domains/pension/schema/012_member_search_index.sql` | New — functional index |
| `platform/casemanagement/db/stats_test.go` | New — ~8 tests |
| `platform/casemanagement/api/handlers_test.go` | Extend — stats + stage filter |
| `platform/dataaccess/api/handlers_test.go` | New/extend — search tests |

~15-18 new Go tests.

## Done When

- `GET /api/v1/cases/stats` returns correct caseload-by-stage from seeded data
- `GET /api/v1/cases/stats/sla` returns correct on_track/at_risk/overdue counts
- `GET /api/v1/cases?stage=...` filters correctly
- `GET /api/v1/members/search?q=martinez` returns Robert Martinez
- All existing tests pass (78 casemanagement + dataaccess)
- `go build ./...` clean in both services
