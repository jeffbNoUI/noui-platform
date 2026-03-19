# Platform Enhancements Backlog — Session Starter

> **Read this before writing any code.**

## Background

The 2026-03-19 session completed all integration test gaps, visual polish (responsive tab bar, metrics banner), audit trail filtering, and Clerk webhook signature validation. What remains is a set of medium and low priority enhancements that share a common prerequisite: **background job infrastructure**.

**Test baseline:** 1,630 frontend tests (204 files), all Go services passing, 14/14 CI jobs green, 118 E2E assertions across 4 scripts. Do not regress.

## Session Goal

Work through the enhancement backlog in priority order. Each section is scoped as an independent deliverable — commit after each.

---

## Part 1: Quick Visual Polish (30 min)

### DQ Score Display Formatting
- `frontend/src/components/admin/OperationalMetricsPanel.tsx` line 44 displays raw float: `98.61538461538461%`
- Fix: round to 1 decimal place: `${dqScore.overallScore.toFixed(1)}%`
- Check other panels that consume `dqScore.overallScore` for the same issue

### Audit Trail Cross-Service View (Medium Priority)
The CRM audit log (`GET /api/v1/crm/audit`) only shows CRM entity changes. Security events live in a separate service (`GET /api/v1/security/events`). The frontend `AuditTrailPanel` only queries CRM audit.

**Option A — Frontend aggregation:** Have the AuditTrailPanel fetch from both `/crm/audit` and `/security/events`, merge and sort by timestamp client-side. Simple, no backend changes.

**Option B — Backend aggregation endpoint:** Add a new endpoint (e.g., on healthagg service) that queries both stores and returns a unified timeline. More work but cleaner.

Recommend **Option A** for now — it's a single-file frontend change. The panel already exists at:
- `frontend/src/components/admin/AuditTrailPanel.tsx`
- `frontend/src/hooks/useAuditTrail.ts` (or wherever audit data is fetched)

---

## Part 2: Background Job Infrastructure (2-3h)

Both security and issue enhancements need scheduled tasks. Build this once, use everywhere.

### Design Decision
Go doesn't have a built-in scheduler. Options:
1. **`go-co-op/gocron`** — Lightweight cron scheduler, runs in-process alongside the HTTP server
2. **Separate scheduler service** — New `platform/scheduler/` service that calls other services via HTTP
3. **Database-driven** — Polling loop that checks a `scheduled_jobs` table

**Recommend option 1** — add `gocron` to the security service first (it needs it most), then extract if other services need it. No new service to deploy.

### Implementation Pattern
```go
// In main.go, after starting HTTP server:
s, _ := gocron.NewScheduler()
s.NewJob(gocron.DurationJob(5*time.Minute), gocron.NewTask(cleanupExpiredSessions, db))
s.NewJob(gocron.DurationJob(1*time.Minute), gocron.NewTask(checkBruteForce, db))
s.Start()
defer s.Shutdown()
```

**Note:** This is a new dependency. Flag it per CLAUDE.md rules:
```
## Dependencies Added
- github.com/go-co-op/gocron/v2 — In-process cron scheduler for background jobs
```

---

## Part 3: Security Events Enhancements (4-6h)

### 3a. Session Timeout Configuration
**Current state:** `platform/security/db/sessions.go` — `ListActiveSessions` uses hardcoded `last_seen_at > NOW() - INTERVAL '30 minutes'`.

**Changes:**
- Add `SESSION_IDLE_TIMEOUT_MIN` and `SESSION_MAX_LIFETIME_HR` env vars (defaults: 30min idle, 8hr max)
- Update `ListActiveSessions` query to use configurable values
- Add background job: `cleanupExpiredSessions` — DELETE sessions where `last_seen_at < NOW() - idle_timeout` OR `started_at < NOW() - max_lifetime`
- Run every 5 minutes via gocron

**Files:**
- `platform/security/db/sessions.go` — parameterize timeout
- `platform/security/main.go` — add gocron scheduler + cleanup job
- `platform/security/jobs/cleanup.go` (NEW) — cleanup function
- `platform/security/api/handlers_test.go` — test configurable timeout

### 3b. Brute-Force Detection
**Changes:**
- Add background job: `checkBruteForce` — query `security_events` for `login_failure` events grouped by IP/email in last 15 minutes
- If count > threshold (default 5, configurable via `BRUTE_FORCE_THRESHOLD` env var), insert a `brute_force_detected` security event
- Stats endpoint already returns `failedLogins24h` — extend to include `bruteForceAlerts`

**Files:**
- `platform/security/jobs/bruteforce.go` (NEW) — detection logic
- `platform/security/db/events.go` — add `CountFailedLoginsByActor` query
- `platform/security/models/types.go` — add `brute_force_detected` to EventTypeValues
- `platform/security/api/handlers_test.go` — test detection

### 3c. Additional Clerk Event Types
**Current mapping** in `platform/security/api/handlers.go` `mapClerkEventType()`:
```
user.signed_in    → login_success
session.created   → session_start
session.ended     → session_end
user.updated      → role_change
```

**Add:**
```
user.created      → account_created
user.deleted      → account_deleted
session.revoked   → session_revoked
organization.membership.created → org_member_added
organization.membership.deleted → org_member_removed
```

**Files:**
- `platform/security/api/handlers.go` — extend `mapClerkEventType` switch
- `platform/security/models/types.go` — add new event type constants to `EventTypeValues`
- `platform/security/api/handlers_test.go` — extend `TestMapClerkEventType` table

---

## Part 4: Issue Management Enhancements (multi-session, start here)

### 4a. SLA Tracking (8-12h)
**Current state:** `crm_sla_definition` and `crm_sla_tracking` tables exist in the CRM schema but are NOT linked to the issues table.

**Changes:**
- Migration: add columns to `issues` table:
  - `priority` VARCHAR(20) (currently only `severity` exists — SLAs match on priority)
  - `response_due_at` TIMESTAMPTZ
  - `resolution_due_at` TIMESTAMPTZ
  - `first_response_at` TIMESTAMPTZ
  - `sla_breached` BOOLEAN DEFAULT FALSE
- On issue creation: look up matching SLA definition, compute due timestamps, set on issue
- Background job: `checkSLABreaches` — every 5 minutes, find issues where `resolution_due_at < NOW()` and `sla_breached = FALSE`, mark as breached
- API: add `GET /api/v1/issues?sla=at-risk` filter (due within 2h) and `sla=breached`
- Stats: extend `GET /api/v1/issues/stats` with `slaBreachedCount`, `slaAtRiskCount`

**Files:**
- `domains/pension/schema/018_issues_sla.sql` (NEW migration)
- `platform/issues/db/issues.go` — add SLA columns to queries, add SLA filter
- `platform/issues/api/handlers.go` — read SLA filter param, auto-assign SLA on create
- `platform/issues/jobs/sla.go` (NEW) — breach detection job
- `platform/issues/main.go` — add gocron scheduler

### 4b. Assignment Workflow (4-6h)
- `GET /api/v1/issues?assigned_to=me` — "my issues" queue endpoint
- On assignment change: auto-transition status to `in-work` if currently `open` or `triaged`
- Track assignment history (who assigned, when) — new `issue_assignment_log` table or JSONB field
- Frontend: add "Assigned to Me" filter button on IssueManagementPanel

### 4c. Notifications (8-12h, likely separate session)
- Requires deciding on notification channel (in-app toast, email, Slack webhook)
- `platform/dataaccess/notify/` already has a `NotificationProvider` interface + `ConsoleProvider` (built during Phase 10)
- Build on that: create `EmailProvider` or `SlackProvider`
- Trigger points: SLA warning (80% consumed), SLA breach, issue assigned to you, issue you reported resolved

---

## Quick Start

```bash
# Verify baseline
cd frontend && npx tsc --noEmit && npm test -- --run
cd ../platform/security && go build ./... && go test ./... -short
cd ../issues && go build ./... && go test ./... -short

# Key files
platform/security/api/handlers.go          # Webhook, event types
platform/security/db/sessions.go           # Session timeout query
platform/security/db/events.go             # Event queries
platform/issues/api/handlers.go            # Issue CRUD
platform/issues/db/issues.go               # Issue queries
frontend/src/components/admin/AuditTrailPanel.tsx
frontend/src/components/admin/OperationalMetricsPanel.tsx
```

## Recommended Session Scope

A single session can realistically cover:
- Part 1 (visual polish — 30 min)
- Part 2 (background job infra — 2h)
- Part 3a + 3c (session timeout + Clerk events — 3h)

That's a solid day. Parts 3b, 4a, 4b, 4c are follow-on sessions.
