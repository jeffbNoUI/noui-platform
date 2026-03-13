# Session 2 Starter: Dashboard Aggregation API + Member Search

## Context

PR #48 (merged) completed Session 1 of the 8-session Production Foundations roadmap. The case management service now has:
- Notes CRUD (CreateNote, ListNotes, DeleteNote, NoteCount)
- Document metadata CRUD (CreateDocument, ListDocuments, DeleteDocument, DocumentCount)
- SLA deadline tracking (priority-based: urgent=30d, high=60d, standard=90d)
- GET /cases/{id} returns CaseDetail with noteCount + documentCount
- Migration 011, seed data (13 notes, 9 docs), 78 Go tests passing

The full roadmap is in `.claude/plans/merry-stirring-ritchie.md`.

## Session 2 Goal

Build aggregation queries for supervisor/executive dashboards and add member search to the dataaccess service.

## Deliverables

### 1. Case Stats Endpoint
`GET /api/v1/cases/stats` in casemanagement service (port 8088):
- `caseload_by_stage`: count of active cases per stage
- `cases_by_status`: count per status (active, completed, etc.)
- `cases_by_priority`: count per priority
- `cases_by_assignee`: per assignee with avg_days_open
- `total_active`, `completed_mtd`, `at_risk_count`

### 2. SLA Stats Endpoint
`GET /api/v1/cases/stats/sla` in casemanagement service:
- `on_track`, `at_risk`, `overdue` counts (computed from sla_deadline_at vs NOW())
- `avg_processing_days`

### 3. Stage Filter
Add `stage` (string) to `CaseFilter` so the frontend can query cases at a specific stage (for approval queue).

### 4. Member Search
`GET /api/v1/members/search?q={query}&limit=10` in dataaccess service (port 8081):
- Search by last name, first name, or member ID
- SQL ILIKE with index
- Migration 012 for the search index

## Key Files to Create/Modify

### Casemanagement service
- `platform/casemanagement/db/stats.go` (new) — aggregation queries
- `platform/casemanagement/api/handlers.go` — add stats handlers + routes
- `platform/casemanagement/models/types.go` — add CaseStats, SLAStats types
- `platform/casemanagement/db/cases.go` — add stage to CaseFilter

### Dataaccess service
- `platform/dataaccess/api/handlers.go` — add SearchMembers handler
- `domains/pension/schema/012_member_search_index.sql` (new)

### Tests (~12-15 new Go tests)
- `platform/casemanagement/db/stats_test.go` (aggregation queries)
- `platform/casemanagement/api/handlers_test.go` (extend: stats endpoints)
- `platform/dataaccess/` (search: by name, by ID, partial match, empty result)

## Done When
- `GET /api/v1/cases/stats` returns correct caseload-by-stage from seeded data
- `GET /api/v1/members/search?q=martinez` returns Robert Martinez
- All existing tests pass (78 casemanagement + dataaccess tests)
- `go build ./...` clean in both services

## Cleanup First

Before starting Session 2, clean up stale worktrees and branches from previous sessions:

```bash
# Remove stale worktrees (both are from merged PRs)
cd C:/Users/jeffb/noui-platform
git worktree remove .claude/worktrees/suspicious-spence --force
git worktree remove .claude/worktrees/reverent-booth --force

# Delete remote tracking branches for merged PRs
git branch -D claude/suspicious-spence 2>/dev/null
git branch -D claude/reverent-booth 2>/dev/null
git push origin --delete claude/suspicious-spence 2>/dev/null
git push origin --delete claude/reverent-booth 2>/dev/null

# Pull latest main (includes PR #48)
git checkout main && git pull
```

Then start a fresh worktree for Session 2 work.

## Starter Command
```
Continue noui-platform development. PR #48 (merged to main) completed Session 1 of the Production Foundations roadmap: case notes/documents CRUD, SLA tracking, 78 Go tests. State: 327 frontend tests, 78 casemanagement Go tests, all builds clean.

Cleanup: worktrees suspicious-spence and reverent-booth are from merged PRs and should be removed. Run: git worktree remove .claude/worktrees/suspicious-spence --force && git worktree remove .claude/worktrees/reverent-booth --force && git branch -D claude/suspicious-spence claude/reverent-booth 2>/dev/null && git push origin --delete claude/suspicious-spence claude/reverent-booth 2>/dev/null && git pull

Then start Session 2: Dashboard Aggregation API + Member Search. See docs/session-starters/session2-aggregation-api.md and .claude/plans/merry-stirring-ritchie.md for full context.
```
