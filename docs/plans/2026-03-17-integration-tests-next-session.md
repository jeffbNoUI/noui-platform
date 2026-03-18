# Integration Tests — Next Session Starter

## Context

Session added `tests/e2e/services_hub_e2e.sh` — a bash/curl/jq E2E test script that verifies all 7 Services Hub tabs receive valid data from the live Docker Compose stack. 50 assertions across 7 sections, all passing.

**All frontend tests passing, typecheck clean, Go builds clean.**

## What Was Built

### tests/e2e/services_hub_e2e.sh
- **Scaffold:** JWT auth generation (HS256, dev secret), shared helpers (assert_status, assert_json_field, assert_json_gte, assert_json_not_null, assert_contains), do_get/do_post/do_put with auth headers, --wait flag polling all 7 services
- **Section 1 — Health:** GET /health/aggregate, overall status, service count >= 8, per-service health for 8 named platform services
- **Section 2 — Data Quality:** GET /dq/score, /dq/checks, /dq/issues, PUT /dq/issues/{id} status update round-trip with restore
- **Section 3 — Audit Trail:** GET /crm/audit, entity_type filter
- **Section 4 — Metrics:** GET /cases/stats, /cases/stats/sla (onTrack/atRisk/overdue), /cases/stats/volume
- **Section 5 — Security:** GET /security/events/stats, POST /security/events, GET /security/events (verify posted event appears)
- **Section 6 — Issues:** Full CRUD: GET /issues/stats, POST /issues (create), GET /issues/{id} (read), PUT /issues/{id} (update status), GET /issues?status=resolved (filter)
- **Section 7 — Config:** GET /kb/rules, field presence checks

### Key Implementation Details
- Services require JWT Bearer auth (HS256 with `dev-secret-do-not-use-in-production`)
- Issues service uses numeric `id` for GET/PUT paths, not the `issueId` display code (e.g., `ISS-023`)
- DQ issues valid statuses: `open`, `resolved`, `false_positive` (not `acknowledged`)
- The correspondence E2E test (`tests/e2e/correspondence_e2e.sh`) does NOT have JWT auth — it may need updating if auth middleware is enforced on those routes

## Remaining Work (from prior session doc)

### Visual Polish (Priority: Medium)
- Tab bar clips "Issues" and "Config" labels on narrow viewports — responsive/icon-only mode
- Metrics tab shows "-" for all KPIs when backend isn't running — add "unavailable" banner

### Audit Trail Server-Side Filtering (Priority: Medium)
- Add date range query params to `GET /api/v1/crm/audit`
- Add `agent_id` query param for server-side filtering
- Cross-service audit: consume logs from case management, correspondence, etc.

### Security Events Enhancements (Priority: Low)
- Clerk webhook integration for real-time auth event capture
- Failed login alerting / brute-force detection thresholds
- Session timeout / forced logout capabilities

### Issue Management Enhancements (Priority: Low)
- Email/webhook notifications on status changes
- SLA tracking (time-to-triage, time-to-resolve)
- Issue assignment workflow with notifications

### E2E Test Improvements (Priority: Low)
- Add JWT auth to correspondence_e2e.sh (currently no auth — may break if middleware enforced)
- Extract shared helpers into `tests/e2e/_helpers.sh` to reduce duplication
- Add `--cleanup-only` flag for CI pipelines

## Quick Start

```bash
# Docker — all services
docker compose up --build

# Run integration tests
bash tests/e2e/services_hub_e2e.sh --wait

# Frontend dev
cd frontend && npx tsc --noEmit && npm run build && npx vitest run

# Key files from this session
tests/e2e/services_hub_e2e.sh                  # Services Hub E2E tests (50 assertions)
docs/plans/2026-03-17-services-hub-integration-tests-design.md
docs/plans/2026-03-17-services-hub-integration-tests.md
```
