# Next Session Starter — Post-Polish Enhancements

> **Read this before writing any code.**

## Background

The 2026-03-19 sessions completed:
- All E2E integration test gaps (118 assertions across 4 scripts)
- Visual polish (responsive tab bar, metrics banner, DQ score formatting)
- Audit trail cross-service view (CRM + security events merged in frontend)
- Clerk webhook signature validation + 5 new event type mappings (9 total)
- Audit trail filtering (agent_id, date_from, date_to)
- Background job infrastructure **design exploration** — deferred, captured in memory

**Test baseline:** 1,636 frontend tests (204 files), all Go services passing, 14/14 CI jobs green, 118 E2E assertions. Do not regress.

## What Remains (Enhancement Backlog)

All items below are blocked on **background job infrastructure** which was deferred pending a concrete need. The design is captured in `docs/plans/` and Claude memory — PostgreSQL-native `SKIP LOCKED` behind a `JobStore` interface, with database portability in mind.

### Security Events (requires job infra)
- **Session timeout config** — currently hardcoded 30min in `platform/security/db/sessions.go`. Need env vars + cleanup job.
- **Brute-force detection** — background job to count failed logins per IP/email, trigger alerts above threshold.

### Issue Management (requires job infra)
- **SLA tracking** — CRM schema exists (`crm_sla_definition`) but NOT linked to issues table. Need migration + enforcement job.
- **Assignment workflow** — `assigned_to` field exists but no queue endpoint (`/issues?assigned_to=me`), no auto-state transitions.
- **Notifications** — No channel selection, preferences, or triggers. `NotificationProvider` interface exists in `platform/dataaccess/notify/` but is dev-only (console logging).

### Items That Don't Need Job Infra
These could be tackled independently:

1. **Additional Clerk event types** (already done — 9 types mapped)
2. **Frontend issue management polish** — "Assigned to Me" filter button on IssueManagementPanel
3. **Data seeding** — Create seed data for audit trail + security events so the cross-service audit panel has demo data to show
4. **Member Portal enhancements** — card-based dashboard is complete (all 11 phases), but could add more card types or sections

## Recommended Session Scopes

**Option A — Job Infrastructure + Security (2-3 sessions)**
Start building the `platform/jobrunner/` service with the PostgreSQL `SKIP LOCKED` design. Then wire session cleanup and brute-force detection.

**Option B — Frontend Polish (1 session)**
Seed demo data for audit trail, add "Assigned to Me" filter, polish the issue management panel.

**Option C — SLA Tracking (2 sessions)**
Migration to link SLA definitions to issues, auto-assign on creation, stats endpoint extension. Requires job infra for breach detection.

## Quick Start

```bash
# Verify baseline
cd frontend && npx tsc --noEmit && npm test -- --run
cd ../platform/security && go build ./... && go test ./... -short
cd ../issues && go build ./... && go test ./... -short

# Key files for job infra (when ready)
# Design notes in Claude memory: project_deferred_enhancements.md
# Session starter with original scope: docs/sessions/2026-03-19-enhancements-backlog-starter.md

# Key files for frontend polish
frontend/src/components/admin/AuditTrailPanel.tsx    # Cross-service audit (just built)
frontend/src/components/admin/IssueManagementPanel.tsx
platform/security/api/handlers.go                     # 9 Clerk event types mapped
```
