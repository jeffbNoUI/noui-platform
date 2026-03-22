# Starter Prompt: Migration Profiling Enhancements — Commit + Docker E2E

## Context

The previous session implemented 5 enhancements to the migration engine based on a data profiling research synthesis. All code is written, all Go tests pass (11/11 packages), frontend typechecks clean. **Nothing has been committed yet.**

## What Was Built

### Enhancement A: Canonical Coverage Report (HIGH priority)
- `platform/migration/profiler/coverage.go` — `ComputeCoverage()` iterates all canonical fields from the mapper Registry and scores how well source columns satisfy each one
- `platform/migration/profiler/coverage_test.go` — 4 tests (full coverage, similarity fallback, no candidates, sorted candidates)
- `platform/migration/api/coverage_handler.go` — `GET /api/v1/migration/engagements/{id}/coverage-report`
- Output: per-canonical-field status (COVERED/TRANSFORMABLE/UNCOVERED), ranked candidates, coverage rate, required gaps count

### Enhancement B: Mapping Specification Document (MEDIUM priority)
- `platform/migration/api/report_handler.go` — `GET /api/v1/migration/engagements/{id}/reports/mapping-spec`
- Aggregates field_mapping, code_mapping, exception counts, DERIVED lineage, EXCLUDED exceptions into an auditable JSON document for pension boards

### Enhancement C: Pattern Auto-Detection (MEDIUM priority)
- `platform/migration/profiler/patterns.go` — `DetectPatterns()` with 7 pension-domain regex patterns (CYYMMDD, YYYYMMDD, SSN x2, implicit decimal, alpha-prefix member ID, 2-char status code)
- `platform/migration/profiler/patterns_test.go` — 7 tests (CYYMMDD, SSN, alpha prefix, below threshold, empty column, schema-qualified table, parseSchemaTable)
- Integrated into `ProfileTable()` — detected patterns included in profile response
- **IMPORTANT:** Code comment + design doc Section 16 + project memory track the need to migrate pattern detection to the Python intelligence service when it's deployed

### Enhancement D+E: Design Doc + Platform Type Column
- `docs/plans/2026-03-20-migration-engine-design.md` — Added Sections 16 (Coverage Report + Pattern Detection + Python migration path), 17 (Mapping Library — Phase 5), 18 (Platform Profiles — Phase 5)
- `platform/migration/db/migrations/035_platform_type.sql` — `source_platform_type VARCHAR(50)` on engagement table
- Model, DB layer, handler, and all test mocks updated for the new 10-column engagement schema

### Frontend + E2E
- `frontend/src/types/Migration.ts` — Added CoverageReport, MappingSpecReport, DetectedPattern types + source_platform_type on engagement
- `frontend/src/lib/migrationApi.ts` — Added `getCoverageReport()` and `getMappingSpec()` API methods
- `tests/e2e/migration_e2e.sh` — Phase 10 added: coverage report + mapping spec E2E assertions

## What This Session Should Do

### 1. Commit the work
```bash
# Verify tests still pass
cd platform/migration && go test ./... -short -count=1
cd ../../frontend && npx tsc --noEmit 2>&1 | grep "Migration.ts\|migrationApi.ts" # should be 0

# Commit
git add platform/migration/profiler/coverage.go platform/migration/profiler/coverage_test.go \
       platform/migration/profiler/patterns.go platform/migration/profiler/patterns_test.go \
       platform/migration/api/coverage_handler.go platform/migration/api/report_handler.go \
       platform/migration/db/migrations/035_platform_type.sql \
       platform/migration/profiler/profiler.go platform/migration/models/types.go \
       platform/migration/db/engagement.go platform/migration/db/engagement_test.go \
       platform/migration/api/engagement_handlers.go platform/migration/api/engagement_handlers_test.go \
       platform/migration/api/mapping_handlers_test.go platform/migration/api/handlers.go \
       frontend/src/types/Migration.ts frontend/src/lib/migrationApi.ts \
       tests/e2e/migration_e2e.sh docs/plans/2026-03-20-migration-engine-design.md
```

### 2. Run Docker E2E to verify new endpoints
```bash
docker compose up --build -d
./tests/e2e/migration_e2e.sh --wait
```
- Existing 23 tests must still pass
- New Phase 10 tests (3 assertions): coverage report, coverage structure, mapping spec
- Expected total: 26/26

### 3. Update BUILD_HISTORY.md

## File Inventory

**New files (7):**
- `platform/migration/profiler/coverage.go`
- `platform/migration/profiler/coverage_test.go`
- `platform/migration/profiler/patterns.go`
- `platform/migration/profiler/patterns_test.go`
- `platform/migration/api/coverage_handler.go`
- `platform/migration/api/report_handler.go`
- `platform/migration/db/migrations/035_platform_type.sql`

**Modified files (12):**
- `platform/migration/api/handlers.go` — 2 new route registrations
- `platform/migration/profiler/profiler.go` — DetectedPatterns field + pattern detection in ProfileTable
- `platform/migration/models/types.go` — SourcePlatformType on Engagement + request types
- `platform/migration/db/engagement.go` — 10-column scan + CreateEngagement accepts platformType
- `platform/migration/db/engagement_test.go` — Updated mock column list and row data
- `platform/migration/api/engagement_handlers.go` — Pass SourcePlatformType to CreateEngagement
- `platform/migration/api/engagement_handlers_test.go` — Updated mock rows for 10-column schema
- `platform/migration/api/mapping_handlers_test.go` — Updated mock rows for 10-column schema
- `frontend/src/types/Migration.ts` — CoverageReport, MappingSpecReport, DetectedPattern types
- `frontend/src/lib/migrationApi.ts` — getCoverageReport, getMappingSpec methods
- `tests/e2e/migration_e2e.sh` — Phase 10: coverage + mapping spec tests
- `docs/plans/2026-03-20-migration-engine-design.md` — Sections 16-18

## Test Results (Pre-Commit)
- Go build: clean
- Go tests: 11/11 packages passing
- New profiler tests: 11 (4 coverage + 7 pattern detection)
- Frontend: 0 errors in changed files
- Docker E2E: not yet run (requires `docker compose up`)
