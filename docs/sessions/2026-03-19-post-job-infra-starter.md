# Next Session Starter — Post Job Infrastructure

> **Read this before writing any code.**

## Background

The 2026-03-19 job infrastructure session completed:
- In-process gocron scheduler in security service (two jobs running)
- Session cleanup job (every 5 min, configurable idle timeout + max lifetime)
- Brute-force detection job (every 1 min, configurable threshold + window, dedup)
- `brute_force_detected` event type + stats extension (`bruteForceAlerts24h`)
- Store methods: `CleanupExpiredSessions`, `CountFailedLoginsByActor`, `HasRecentBruteForceAlert`
- Parameterized `ListActiveSessions` with configurable idle timeout

**Dependency added:** `github.com/go-co-op/gocron/v2 v2.19.1`

**Test baseline:** 1,636 frontend tests (204+ files), security service: 3 packages (api, db, jobs) all passing, 6 new job tests + 4 new store tests. All Go services passing. 14/14 CI jobs green. 118 E2E assertions. Do not regress.

## What's Unblocked Now

The gocron pattern is established. Any service can copy it:
1. Add `gocron/v2` to service go.mod
2. Create `jobs/` package with plain functions taking `*sql.DB` + config
3. Wire scheduler in main.go alongside HTTP server

## Recommended Session Scopes

### Option A — Issues Service SLA Tracking (2 sessions)
Copy gocron pattern to issues service. Full SLA implementation:
1. Migration: add `priority`, `response_due_at`, `resolution_due_at`, `sla_breached` to issues table
2. On issue creation: look up matching SLA definition, compute due timestamps
3. SLA breach detection job (every 5 min)
4. `GET /api/v1/issues?sla=at-risk|breached` filter
5. Stats: `slaBreachedCount`, `slaAtRiskCount`

**Key files:**
```
platform/issues/go.mod              # Add gocron/v2
platform/issues/main.go             # Wire scheduler
platform/issues/jobs/sla.go         # NEW: breach detection job
platform/issues/db/issues.go        # Add SLA columns, filters
platform/issues/api/handlers.go     # SLA filter params
```

### Option B — Frontend Polish (1 session)
Items that don't need backend work:
- "Assigned to Me" filter button on IssueManagementPanel
- Seed demo data for audit trail + security events (so cross-service audit panel has content)
- Brute-force alert styling in AuditTrailPanel (distinguish from regular security events)

### Option C — Issues Assignment Workflow (1 session)
- `GET /api/v1/issues?assigned_to=me` endpoint
- Auto-transition status to `in-work` on assignment
- Frontend: "Assigned to Me" filter button

### Option D — Employer Domain Phase 2 (separate worktree)
Employer Reporting engine — `platform/employer-reporting/` on port 8095. See `docs/sessions/2026-03-19-employer-domain-phase2-starter.md`. All new directories, zero conflict risk.

## Quick Start

```bash
# Verify baseline
cd platform/security && go build ./... && go test ./... -short
cd ../issues && go build ./... && go test ./... -short
cd ../../frontend && npx tsc --noEmit && npm test -- --run

# Key reference files (gocron pattern to copy)
platform/security/main.go              # Scheduler wiring
platform/security/jobs/cleanup.go      # Job function pattern
platform/security/jobs/bruteforce.go   # Job with dedup pattern
platform/security/models/types.go      # JobConfig struct

# Design docs
docs/plans/2026-03-19-job-infrastructure-design.md
docs/plans/2026-03-19-job-infrastructure-plan.md
```

## Config Env Vars (Security Service)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SESSION_IDLE_TIMEOUT_MIN` | 30 | Delete sessions idle longer than this |
| `SESSION_MAX_LIFETIME_HR` | 8 | Delete sessions older than this |
| `BRUTE_FORCE_THRESHOLD` | 5 | Failed logins before alert |
| `BRUTE_FORCE_WINDOW_MIN` | 15 | Lookback window for failed logins |
