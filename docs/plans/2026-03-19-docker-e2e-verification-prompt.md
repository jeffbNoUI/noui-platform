# Starter Prompt: Docker End-to-End Verification — Rules Explorer

## Context

The Rules Explorer and Demo Cases features were built in PR (see `claude/sweet-lalande` branch). The frontend components, backend handlers, API client, and hooks are all implemented and unit-tested. However, the full pipeline has **never been tested end-to-end with Docker**.

## Goal

Verify that the complete data flow works: **YAML rule files → Go KB service loader → REST API → React frontend rendering**. This means starting Docker, hitting real endpoints, and seeing real rule data in the browser.

## Prerequisites

- Merge the Rules Explorer PR to main first
- Docker Desktop running
- All services healthy via `docker compose up --build`

## Tasks

### 1. Generate the Test Report

```bash
# From repo root
chmod +x scripts/generate-test-report.sh
./scripts/generate-test-report.sh
# Produces: test-results/intelligence-report.json
```

Verify the file exists and contains valid JSON lines (`go test -json` format).

### 2. Verify Docker Compose Config

Check `docker-compose.yml` has these volume mounts for the `knowledgebase` service:
- `./domains/pension/rules/definitions:/data/rules:ro`
- `./domains/pension/demo-cases:/data/demo-cases:ro`
- `./test-results:/data/test-results:ro`

And these env vars:
- `RULES_DIR=/data/rules`
- `DEMO_CASES_DIR=/data/demo-cases`
- `TEST_REPORT_PATH=/data/test-results/intelligence-report.json`
- `TEST_MAPPING_PATH=/data/test-results/test-rule-mapping.json`
- `RULES_CACHE_TTL_MIN=5`

### 3. Start Services and Verify Health

```bash
docker compose up --build
# Wait for all services healthy
curl http://localhost:8087/health
```

### 4. Test Backend Endpoints

Hit each endpoint and verify responses:

```bash
# All rule definitions
curl http://localhost:8087/api/v1/kb/rules/definitions | jq '.data | length'
# Expected: number of YAML files worth of rules (50+)

# Single domain
curl http://localhost:8087/api/v1/kb/rules/definitions?domain=eligibility | jq '.data | length'

# Single rule
curl "http://localhost:8087/api/v1/kb/rules/definitions/ELIG-001" | jq '.data.name'

# Test report
curl http://localhost:8087/api/v1/kb/test-report | jq '.data.summary'
# Expected: { total, passed, failed, skipped }

# Demo cases
curl http://localhost:8087/api/v1/kb/demo-cases | jq '.data | length'
# Expected: number of demo case JSON files

# Single demo case
curl "http://localhost:8087/api/v1/kb/demo-cases/case-1" | jq '.data.member_name'
```

### 5. Verify Frontend Rendering

1. Open `http://localhost:3000` in browser
2. Log in as admin or staff role
3. Navigate to Staff Portal → Configuration / Reference → Rules Explorer
4. Verify:
   - Summary bar shows pass/fail counts
   - Domain filter pills appear
   - Rules list populates with real rule data
   - Clicking a rule opens detail view with Logic, I/O, Tests, Governance tabs
   - Each logic type renders correctly (conditional, formula, lookup_table, procedural)
   - Test status badges show real pass/fail from CI report
5. Navigate to Demo Cases
6. Verify:
   - Case cards appear with member names and tier badges
   - Clicking a case opens detail with Profile, Calculation Trace, Test Points tabs
   - Rule links in Calculation Trace navigate to Rules Explorer

### 6. Edge Cases to Check

- **Cache behavior**: Hit an endpoint, wait 5+ minutes, hit again — should reload from disk
- **Missing test report**: Delete/rename `intelligence-report.json`, restart KB service — endpoints should still work, just no test status
- **CORS**: Frontend on port 3000 calling KB on port 8087 — verify CORS headers are correct
- **Empty domain filter**: Filter to a domain with no rules — should show empty state

### 7. Fix Any Issues Found

Common things that might need fixing:
- CORS origin config for the KB service
- File path mismatches between Docker volumes and env vars
- YAML parsing edge cases with real rule files (special characters, missing fields)
- Demo case JSON structure differences from what the loader expects
- API response envelope format mismatches between backend and frontend types

## Success Criteria

- [ ] All 6 backend endpoints return valid data
- [ ] Rules Explorer renders with real rule definitions
- [ ] Test status badges reflect actual CI test results
- [ ] Demo Cases render with real demo case data
- [ ] Cross-links between Rules Explorer and Demo Cases work
- [ ] No console errors (other than expected auth-related ones in dev mode)
