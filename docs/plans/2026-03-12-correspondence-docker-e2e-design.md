# Task C: Docker Integration + E2E Test Script

**Date:** 2026-03-12
**Status:** Approved
**Depends on:** PR #35 (correspondence enrichment — Tasks A & B)

## Problem

PR #35 added schema migration `008_correspondence_enrich.sql` and seed
`009_correspondence_enrich_seed.sql`, but these files are **not wired into
`docker-compose.yml`**. The postgres init volume mounts stop at
`014_additional_seed.sql`. Docker boots cleanly but the enrichment columns
(`stage_category`, `on_send_effects`) and 6 new stage-mapped templates do not
exist, so the E2E flows cannot be verified.

Additionally, there is no automated integration test covering the
correspondence enrichment flows end-to-end.

## Scope

1. **Docker Compose fix** — wire missing schema/seed mounts
2. **E2E test script** — bash + curl + jq exercising live Docker stack
3. **Fix any issues** discovered during verification

## Part 1: Docker Compose Fix

Add two volume mounts to the `postgres` service in `docker-compose.yml`:

| Source file | Target in container | Order |
|---|---|---|
| `domains/pension/schema/008_correspondence_enrich.sql` | `/docker-entrypoint-initdb.d/015_correspondence_enrich.sql` | After 014 |
| `domains/pension/seed/009_correspondence_enrich_seed.sql` | `/docker-entrypoint-initdb.d/016_correspondence_enrich_seed.sql` | After 015 |

Schema (015) must precede seed (016) — the seed references columns added by
the schema migration.

## Part 2: E2E Test Script

**Location:** `tests/e2e/correspondence_e2e.sh`

**Prerequisites:** Docker stack running (`docker compose up --build`)

### Test 1: Schema Verification
- `GET /api/v1/correspondence/templates?stage_category=intake`
- Assert: HTTP 200, response contains templates with `stageCategory` field
- Assert: At least 2 templates returned (GENERAL_ACK + INTAKE_ACK)

### Test 2: Generate Letter with Merge Fields
- `POST /api/v1/correspondence/generate` with INTAKE_ACK template + merge data
- Assert: HTTP 201, body contains rendered text with substituted fields
- `GET /api/v1/correspondence/history?member_id=10001`
- Assert: New correspondence record appears in history

### Test 3: Correspondence-to-CRM Bridge
- Generate a letter (reuse flow from Test 2)
- `POST /api/v1/crm/interactions` to log the CRM interaction
- `GET /api/v1/crm/interactions?contact_id=...`
- Assert: Interaction exists with `channel=CORRESPONDENCE`, `direction=OUTBOUND`

### Test 4: Stage-Filtered Template Queries
- For each stage category: intake, verify-employment, eligibility, election,
  submit, dro
- Assert: Each returns >= 1 template
- Assert: NULL stage_category templates excluded from filtered results

### Script Features
- `BASE_URL` defaults to `http://localhost:3000`
- `--wait` flag polls health endpoints before running
- Colored pass/fail output
- Exit code 0 = all pass, 1 = any fail

## Part 3: Verify and Fix

Run `docker compose up --build` with fresh volume, execute the E2E script,
fix any issues found.

## Files Changed

| File | Change |
|---|---|
| `docker-compose.yml` | Add 2 postgres volume mounts |
| `tests/e2e/correspondence_e2e.sh` | New — E2E test script |

## Out of Scope

- Frontend browser-based E2E testing (Playwright/Cypress)
- Automated Docker lifecycle management (compose up/down within tests)
- CI pipeline integration (future task)
