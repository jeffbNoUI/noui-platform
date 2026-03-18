# Services Hub Integration Tests — Design

## Goal

Verify all 7 Services Hub tabs receive valid data from real backend services running in Docker Compose. Tests exercise every API endpoint the frontend calls, including CRUD flows for Issues and Security events.

## Approach

Bash + curl + jq scripts matching the established `correspondence_e2e.sh` pattern: colored output, assert helpers, `--wait` flag for service readiness, exit 0/1 for CI.

## File

`tests/e2e/services_hub_e2e.sh`

## Test Sections

### 1. Health Tab (healthagg:8091)
- `GET /api/v1/health/aggregate` — overall status, service count >= 8, per-service fields

### 2. Data Quality Tab (dataquality:8086)
- `GET /api/v1/dq/score` — score between 0–100
- `GET /api/v1/dq/checks` — at least 1 check
- `GET /api/v1/dq/issues` — seeded issues exist
- `PUT /api/v1/dq/issues/{id}` — status update round-trip

### 3. Audit Trail Tab (crm:8084)
- `GET /api/v1/audit/log` — returns entries
- Filter by `entity_type` narrows results

### 4. Metrics Tab (casemanagement:8088)
- `GET /api/v1/cases/stats` — has totalActive
- `GET /api/v1/cases/stats/sla` — has onTrack/atRisk/overdue
- `GET /api/v1/cases/stats/volume` — monthly array

### 5. Security Tab (security:8093)
- `GET /api/v1/security/events/stats` — returns stats
- `POST /api/v1/security/events` — log event (201)
- `GET /api/v1/security/events` — new event appears

### 6. Issues Tab (issues:8092)
- `GET /api/v1/issues/stats` — returns counts
- `POST /api/v1/issues` — create (201)
- `GET /api/v1/issues/{id}` — read back
- `PUT /api/v1/issues/{id}` — update status
- `GET /api/v1/issues?status=...` — filter works

### 7. Config Tab (knowledgebase:8087)
- `GET /api/v1/knowledgebase/rules` — rules array, count >= 1

## Out of Scope

- CSV export (frontend-only, no backend endpoint)
- WebSocket testing (bash limitation; data path covered by REST)
- Browser/Playwright tests (can add later if needed)

## Expected Assertions

~30–35 total across all 7 sections.

## Prerequisites

- `docker compose up --build` with fresh volumes
- Seed data loaded (016_issues_seed.sql, 017_security_seed.sql, etc.)
