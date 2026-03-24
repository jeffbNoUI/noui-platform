# Two-Source Proof Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run the full migration pipeline end-to-end against isolated PRISM and PAS source databases in Docker, hitting all 12 success criteria from the design doc.

**Architecture:** Two new PostgreSQL containers (`prism-source`, `pas-source`) with pre-seeded legacy data. The migration service connects via Docker DNS using `SourceConnection` config. Code fixes in profile handler (use source DB) and batch handler (add execute endpoint + DB source provider).

**Tech Stack:** Go 1.22 (migration service), Python 3.11 (generators + intelligence), PostgreSQL 16 (source containers), Docker Compose, bash (orchestration script).

**Design Doc:** `docs/plans/2026-03-22-two-source-proof-design.md`

---

## Task 1: Copy Source Files Into Repo

Bring the external PRISM and PAS source files into the repository.

**Files:**
- Create: `migration-simulation/sources/prism/prism_legacy_schema.sql` (copy from `C:\Users\jeffb\docs\plans\prism_legacy_schema.sql`)
- Create: `migration-simulation/sources/prism/prism_data_generator.py` (copy from `C:\Users\jeffb\docs\plans\prism_data_generator.py`)
- Create: `migration-simulation/sources/pas/pas_simulation_source_model.sql` (copy from `C:\Users\jeffb\docs\plans\gpt\pas_simulation_source_model.sql`)
- Create: `migration-simulation/sources/pas/generate_pas_scenarios.py` (copy from `C:\Users\jeffb\docs\plans\gpt\generate_pas_scenarios.py`)
- Create: `migration-simulation/sources/pas/pas_load_from_csv.sql` (copy from `C:\Users\jeffb\docs\plans\gpt\pas_load_from_csv.sql`)
- Create: `migration-simulation/sources/pas/pas_reconciliation_scorecard.sql` (copy from `C:\Users\jeffb\docs\plans\gpt\pas_reconciliation_scorecard.sql`)
- Create: `migration-simulation/sources/pas/pas_scenarios.json` (copy from `C:\Users\jeffb\docs\plans\gpt\pas_scenarios.json`)

**Step 1: Create directory structure**

```bash
mkdir -p migration-simulation/sources/prism/init
mkdir -p migration-simulation/sources/pas/init
```

**Step 2: Copy files**

```bash
cp "C:\Users\jeffb\docs\plans\prism_legacy_schema.sql" migration-simulation/sources/prism/
cp "C:\Users\jeffb\docs\plans\prism_data_generator.py" migration-simulation/sources/prism/
cp "C:\Users\jeffb\docs\plans\gpt\pas_simulation_source_model.sql" migration-simulation/sources/pas/
cp "C:\Users\jeffb\docs\plans\gpt\generate_pas_scenarios.py" migration-simulation/sources/pas/
cp "C:\Users\jeffb\docs\plans\gpt\pas_load_from_csv.sql" migration-simulation/sources/pas/
cp "C:\Users\jeffb\docs\plans\gpt\pas_reconciliation_scorecard.sql" migration-simulation/sources/pas/
cp "C:\Users\jeffb\docs\plans\gpt\pas_scenarios.json" migration-simulation/sources/pas/
```

**Step 3: Commit**

```bash
git add migration-simulation/sources/
git commit -m "[migration] Import PRISM and PAS source schemas and generators"
```

---

## Task 2: Port PRISM DDL to PostgreSQL

The PRISM schema is SQL Server syntax. Port it to PostgreSQL for the Docker init script.

**Files:**
- Create: `migration-simulation/sources/prism/init/01_schema.sql`
- Reference: `migration-simulation/sources/prism/prism_legacy_schema.sql` (original)

**Step 1: Write the PostgreSQL DDL**

Port all 21 PRISM tables from SQL Server to PostgreSQL. Key conversions:

| SQL Server | PostgreSQL |
|------------|-----------|
| `USE PRISM_PROD; GO` | Remove — DB set by container env |
| `GO` after each statement | Remove — PostgreSQL uses `;` |
| `DATETIME` | `TIMESTAMP` |
| `DECIMAL(p,s)` | `NUMERIC(p,s)` |
| Schema-less tables | Prefix with `src_prism.` schema |
| `CONSTRAINT PK_...` | Same syntax, PostgreSQL compatible |

Wrap everything in:
```sql
CREATE SCHEMA IF NOT EXISTS src_prism;
SET search_path TO src_prism;
```

Tables to port (21 total):
`PRISM_MEMBER`, `PRISM_MEMBER_ADDR`, `PRISM_EMP_SPELL`, `PRISM_JOB_HIST`,
`PRISM_SAL_ANNUAL`, `PRISM_SAL_PERIOD`, `PRISM_SVC_CREDIT`, `PRISM_CONTRIB_LEGACY`,
`PRISM_CONTRIB_HIST`, `PRISM_BENEFIT_CALC`, `PRISM_PMT_SCHEDULE`, `PRISM_PMT_HIST`,
`PRISM_BENEFICIARY`, `PRISM_QDRO`, `PRISM_DISABILITY`, `PRISM_PLAN_PARAMS`,
`PRISM_EMPR_LIST`, `PRISM_MISC_CODES`, `PRISM_NOTES`, `PRISM_LIFE_EVENTS`,
`PRISM_COLA_HIST`

**Preserve all comments** from the original DDL — they document data quality issues
that the profiler should detect.

**Step 2: Validate DDL syntax**

```bash
# Quick check: load into a temporary PostgreSQL
docker run --rm -e POSTGRES_DB=test -e POSTGRES_PASSWORD=test \
  -v $(pwd)/migration-simulation/sources/prism/init:/docker-entrypoint-initdb.d \
  postgres:16 postgres -c 'max_connections=5'
```

Expected: container starts without SQL errors.

**Step 3: Commit**

```bash
git add migration-simulation/sources/prism/init/01_schema.sql
git commit -m "[migration] Port PRISM DDL from SQL Server to PostgreSQL"
```

---

## Task 3: Adapt PRISM Data Generator

The existing generator outputs JSON. Adapt it to output SQL INSERT statements for
Docker init.

**Files:**
- Create: `migration-simulation/sources/prism/init/02_seed.sql` (generated output)
- Modify: `migration-simulation/sources/prism/prism_data_generator.py`

**Step 1: Adapt the generator**

Key changes to `prism_data_generator.py`:
- Output SQL INSERT statements instead of JSON
- Target `src_prism.` schema-qualified table names
- Escape single quotes in string values
- Use `NULL` (not Python `None`) for nullable fields
- Match column names and order from `01_schema.sql`
- Generate reference data first (PRISM_EMPR_LIST, PRISM_MISC_CODES, PRISM_PLAN_PARAMS)
- Then member data, then salary/contrib/benefit data
- **Reduce to 100 members** initially (faster Docker init, easier debugging)
- Write output to `migration-simulation/sources/prism/init/02_seed.sql`
- Maintain deterministic seed (`random.seed(42)`)

The generator already computes benefit calculations with the same formula the
reconciler uses — this is critical for the proof to pass reconciliation.

**Step 2: Run the generator**

```bash
cd migration-simulation/sources/prism
python prism_data_generator.py
```

Expected output: `init/02_seed.sql` with INSERT statements.

**Step 3: Validate seed data loads**

```bash
docker run --rm -e POSTGRES_DB=prism_prod -e POSTGRES_PASSWORD=prism -e POSTGRES_USER=prism \
  -v $(pwd)/migration-simulation/sources/prism/init:/docker-entrypoint-initdb.d \
  postgres:16 postgres -c 'max_connections=5'
```

Expected: container starts, all INSERTs succeed.

**Step 4: Commit**

```bash
git add migration-simulation/sources/prism/
git commit -m "[migration] Adapt PRISM generator for PostgreSQL INSERT output"
```

---

## Task 4: Adapt PAS Schema and Generator

PAS DDL is already PostgreSQL but needs minor fixes (schema name consistency per
Task 1 of the original plan). The generator outputs CSV — adapt to SQL INSERTs.

**Files:**
- Create: `migration-simulation/sources/pas/init/01_schema.sql`
- Create: `migration-simulation/sources/pas/init/02_seed.sql` (generated output)
- Modify: `migration-simulation/sources/pas/generate_pas_scenarios.py`

**Step 1: Fix PAS schema consistency**

The original DDL uses `src_pas` for most tables but `recon` for reconciliation tables.
For the Docker init:
- Keep `src_pas` for all source data tables
- Keep `recon` for reconciliation tables (they're part of the source system's audit trail)
- Create both schemas in `01_schema.sql`

Copy `pas_simulation_source_model.sql` to `init/01_schema.sql`, verifying all
`CREATE TABLE` statements reference `src_pas.` or `recon.` consistently.

**Step 2: Adapt PAS generator**

Key changes to `generate_pas_scenarios.py`:
- Output SQL INSERT statements instead of CSV
- Target `src_pas.` and `recon.` schema-qualified tables
- **Reduce to 100 members** (matching PRISM for balanced proof)
- Write to `migration-simulation/sources/pas/init/02_seed.sql`
- Include `recon.legacy_calculation_snapshot` data (required for Tier 1 reconciliation)
- Maintain deterministic seed (`random.seed(42)`)

**Step 3: Run the generator**

```bash
cd migration-simulation/sources/pas
python generate_pas_scenarios.py
```

**Step 4: Validate**

```bash
docker run --rm -e POSTGRES_DB=pas_prod -e POSTGRES_PASSWORD=pas -e POSTGRES_USER=pas \
  -v $(pwd)/migration-simulation/sources/pas/init:/docker-entrypoint-initdb.d \
  postgres:16 postgres -c 'max_connections=5'
```

**Step 5: Commit**

```bash
git add migration-simulation/sources/pas/
git commit -m "[migration] Adapt PAS schema and generator for Docker init"
```

---

## Task 5: Add Source Database Containers to Docker Compose

**Files:**
- Modify: `docker-compose.yml`
- Modify: `infrastructure/ports.env`

**Step 1: Add `prism-source` and `pas-source` services**

Add after the `pgbouncer` service in `docker-compose.yml`:

```yaml
  prism-source:
    image: postgres:16
    environment:
      POSTGRES_DB: prism_prod
      POSTGRES_USER: prism
      POSTGRES_PASSWORD: prism
    volumes:
      - ./migration-simulation/sources/prism/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U prism -d prism_prod"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - default

  pas-source:
    image: postgres:16
    environment:
      POSTGRES_DB: pas_prod
      POSTGRES_USER: pas
      POSTGRES_PASSWORD: pas
    volumes:
      - ./migration-simulation/sources/pas/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pas -d pas_prod"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - default
```

No host port mappings — access is via Docker DNS only.

**Step 2: Update ports.env**

Add to `infrastructure/ports.env`:
```
# Source databases (Docker-internal only, no host mapping)
PRISM_SOURCE_PORT=5432
PAS_SOURCE_PORT=5432
```

**Step 3: Verify containers start**

```bash
docker compose up -d prism-source pas-source
docker compose ps | grep source
```

Expected: both containers healthy.

**Step 4: Verify data is seeded**

```bash
docker compose exec prism-source psql -U prism -d prism_prod -c "SELECT COUNT(*) FROM src_prism.prism_member;"
docker compose exec pas-source psql -U pas -d pas_prod -c "SELECT COUNT(*) FROM src_pas.member;"
```

Expected: 100 rows each.

**Step 5: Commit**

```bash
git add docker-compose.yml infrastructure/ports.env
git commit -m "[infrastructure] Add PRISM and PAS source database containers"
```

---

## Task 6: Export `openSourceDB` and Fix Profile Handler

The profile handler currently passes `h.DB` (platform DB) instead of the source DB.
Fix it to use the engagement's `SourceConnection`.

**Files:**
- Modify: `platform/migration/db/source.go` (line 74: rename `openSourceDB` → `OpenSourceDB`)
- Modify: `platform/migration/api/profile_handler.go` (line 53: use source DB)
- Modify: `platform/migration/db/source.go` (update internal callers)

**Step 1: Export `openSourceDB`**

In `platform/migration/db/source.go`, rename `openSourceDB` → `OpenSourceDB` (line 74).
Update internal callers: `TestSourceConnection` (line 89) and `DiscoverSourceTables` (line 104).

**Step 2: Fix profile handler**

In `platform/migration/api/profile_handler.go`, after fetching the engagement (line 30),
open the source database:

```go
// Open source database connection
if engagement.SourceConnection == nil {
    apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
        "engagement has no source connection configured — configure source first")
    return
}
srcDB, err := migrationdb.OpenSourceDB(engagement.SourceConnection)
if err != nil {
    slog.Error("failed to open source database", "error", err, "engagement_id", id)
    apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "SOURCE_ERROR",
        "failed to connect to source database")
    return
}
defer srcDB.Close()
```

Then change line 53:
```go
// Before:
profile, err := profiler.ProfileTable(h.DB, cfg)
// After:
profile, err := profiler.ProfileTable(srcDB, cfg)
```

Note: `SaveProfile` on line 61 still uses `h.DB` — that's correct, profiles are
saved to the platform database, not the source.

**Step 3: Build and verify**

```bash
cd platform/migration && go build ./...
```

Expected: clean build.

**Step 4: Run existing tests**

```bash
cd platform/migration && go test ./... -short -count=1
```

Expected: all pass (existing tests use mock DB, not affected by the handler change).

**Step 5: Commit**

```bash
git add platform/migration/db/source.go platform/migration/api/profile_handler.go
git commit -m "[platform/migration] Fix profile handler to use source database connection"
```

---

## Task 7: Implement DB Source Row Provider

The batch executor needs a concrete `SourceRowProvider` that reads from the source database.

**Files:**
- Create: `platform/migration/batch/db_provider.go`
- Create: `platform/migration/batch/db_provider_test.go`

**Step 1: Write the test**

```go
// db_provider_test.go
package batch

import (
    "testing"
)

func TestDBSourceRowProvider_FetchRows(t *testing.T) {
    // Test that FetchRows returns rows with correct structure.
    // This is a unit test using the provider interface contract.
    provider := &DBSourceRowProvider{
        DSN:       "postgres://test:test@localhost:5432/test?sslmode=disable",
        TableName: "src_prism.prism_member",
        KeyColumn: "mbr_nbr",
    }
    // The real integration test runs in the two-source proof.
    // Here we just verify the struct satisfies the interface.
    var _ SourceRowProvider = provider
}
```

**Step 2: Implement the provider**

```go
// db_provider.go
package batch

import (
    "database/sql"
    "fmt"

    _ "github.com/lib/pq"
    _ "github.com/microsoft/go-mssqldb"
)

// DBSourceRowProvider reads source rows from a database table.
type DBSourceRowProvider struct {
    DSN       string // full DSN for the source database
    TableName string // schema-qualified table name (e.g. "src_prism.prism_member")
    KeyColumn string // column to use as SourceRow.Key (for checkpoint)
}

// FetchRows connects to the source DB, reads all rows from the table,
// and returns them as []SourceRow. When checkpointKey is non-empty, only
// rows with Key > checkpointKey are returned.
func (p *DBSourceRowProvider) FetchRows(scope string, checkpointKey string) ([]SourceRow, error) {
    db, err := sql.Open(driverFromDSN(p.DSN), p.DSN)
    if err != nil {
        return nil, fmt.Errorf("open source DB: %w", err)
    }
    defer db.Close()

    query := fmt.Sprintf("SELECT * FROM %s", p.TableName)
    if checkpointKey != "" {
        query += fmt.Sprintf(" WHERE %s > '%s'", p.KeyColumn, checkpointKey)
    }
    query += fmt.Sprintf(" ORDER BY %s", p.KeyColumn)

    rows, err := db.Query(query)
    if err != nil {
        return nil, fmt.Errorf("query source table %s: %w", p.TableName, err)
    }
    defer rows.Close()

    cols, err := rows.Columns()
    if err != nil {
        return nil, fmt.Errorf("get columns: %w", err)
    }

    var result []SourceRow
    for rows.Next() {
        values := make([]interface{}, len(cols))
        ptrs := make([]interface{}, len(cols))
        for i := range values {
            ptrs[i] = &values[i]
        }
        if err := rows.Scan(ptrs...); err != nil {
            return nil, fmt.Errorf("scan row: %w", err)
        }

        data := make(map[string]interface{})
        var key string
        for i, col := range cols {
            data[col] = values[i]
            if col == p.KeyColumn {
                key = fmt.Sprintf("%v", values[i])
            }
        }

        result = append(result, SourceRow{
            Key:  key,
            Data: data,
        })
    }

    return result, rows.Err()
}

// driverFromDSN infers the database driver from the DSN string.
func driverFromDSN(dsn string) string {
    if len(dsn) > 10 && dsn[:10] == "sqlserver:" {
        return "sqlserver"
    }
    return "postgres"
}
```

**Step 3: Build and test**

```bash
cd platform/migration && go build ./... && go test ./batch/... -short -count=1
```

**Step 4: Commit**

```bash
git add platform/migration/batch/db_provider.go platform/migration/batch/db_provider_test.go
git commit -m "[platform/migration] Add DBSourceRowProvider for real source database reads"
```

---

## Task 8: Add Batch Execute Endpoint

The batch execute endpoint is missing from the API. The E2E tests call
`POST /api/v1/migration/batches/{id}/execute` — add it.

**Files:**
- Modify: `platform/migration/api/batch_handlers.go` (add `ExecuteBatchHandler`)
- Modify: `platform/migration/api/handlers.go` (register route)

**Step 1: Add the handler**

Append to `platform/migration/api/batch_handlers.go`:

```go
// ExecuteBatchHandler handles POST /api/v1/migration/batches/{id}/execute.
// It fetches source rows via DBSourceRowProvider, runs the transformation
// pipeline, and loads results to canonical tables.
func (h *Handler) ExecuteBatchHandler(w http.ResponseWriter, r *http.Request) {
    batchID := r.PathValue("id")
    if batchID == "" {
        apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id is required")
        return
    }

    // Get batch
    b, err := migrationdb.GetBatch(h.DB, batchID)
    if err != nil {
        slog.Error("failed to get batch", "error", err, "batch_id", batchID)
        apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get batch")
        return
    }
    if b == nil {
        apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("batch %s not found", batchID))
        return
    }

    // Get engagement for source connection
    engagement, err := migrationdb.GetEngagement(h.DB, b.EngagementID)
    if err != nil || engagement == nil {
        slog.Error("failed to get engagement for batch execute", "error", err)
        apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get engagement")
        return
    }
    if engagement.SourceConnection == nil {
        apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
            "engagement has no source connection — configure source first")
        return
    }

    // Build source DSN
    dsn := migrationdb.BuildSourceDSN(engagement.SourceConnection)

    // Get field mappings for this engagement
    mappings, err := migrationdb.ListFieldMappings(h.DB, engagement.EngagementID)
    if err != nil {
        slog.Error("failed to get field mappings", "error", err)
        apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get mappings")
        return
    }

    // Build source row provider — one table per batch scope
    // For "full" scope, use the primary member table
    tableName := resolveSourceTable(engagement.SourceSystemName, b.BatchScope)
    provider := &batch.DBSourceRowProvider{
        DSN:       dsn,
        TableName: tableName,
        KeyColumn: resolvePrimaryKey(engagement.SourceSystemName),
    }

    // Build transformation pipeline
    pipeline := transformer.NewPipeline()
    tmappings := toTransformerMappings(mappings)

    // Execute
    go func() {
        err := batch.ExecuteBatch(h.DB, &batch.Batch{
            BatchID:        b.BatchID,
            EngagementID:   b.EngagementID,
            BatchScope:     b.BatchScope,
            MappingVersion: b.MappingVersion,
        }, provider, pipeline, tmappings, batch.DefaultThresholds(), nil)
        if err != nil {
            slog.Error("batch execution failed", "error", err, "batch_id", batchID)
        }
    }()

    // Return immediately — batch runs async
    apiresponse.WriteSuccess(w, http.StatusAccepted, "migration", map[string]string{
        "batch_id": batchID,
        "status":   "RUNNING",
    })
}
```

Helper functions to add in the same file:

```go
// resolveSourceTable maps engagement source system + batch scope to source table name.
func resolveSourceTable(sourceSystem, scope string) string {
    switch sourceSystem {
    case "PRISM":
        return "src_prism.prism_member"
    case "PAS":
        return "src_pas.member"
    default:
        return scope // fallback to scope as table name
    }
}

// resolvePrimaryKey returns the primary key column for the given source system.
func resolvePrimaryKey(sourceSystem string) string {
    switch sourceSystem {
    case "PRISM":
        return "mbr_nbr"
    case "PAS":
        return "member_id"
    default:
        return "id"
    }
}
```

**NOTE:** The `toTransformerMappings` and `BuildSourceDSN` functions may need to
be created or exported. `BuildSourceDSN` should be exported from `db/source.go`
(reuse `buildDSN` logic). `toTransformerMappings` converts `models.FieldMapping`
to `transformer.FieldMapping`.

**Step 2: Register the route**

In `platform/migration/api/handlers.go`, add after the batch create route:

```go
mux.HandleFunc("POST /api/v1/migration/batches/{id}/execute", h.ExecuteBatchHandler)
```

**Step 3: Export BuildSourceDSN**

In `platform/migration/db/source.go`, add a public wrapper:

```go
// BuildSourceDSN constructs a connection string for the given source connection.
func BuildSourceDSN(conn *models.SourceConnection) string {
    _, dsn, _ := buildDSN(conn)
    return dsn
}
```

**Step 4: Build and test**

```bash
cd platform/migration && go build ./... && go test ./... -short -count=1
```

**Step 5: Commit**

```bash
git add platform/migration/api/batch_handlers.go platform/migration/api/handlers.go \
       platform/migration/db/source.go
git commit -m "[platform/migration] Add batch execute endpoint with DB source provider"
```

---

## Task 9: Add Source Config to Migration E2E

The bash E2E suite needs to configure source connections pointing to the new containers.

**Files:**
- Modify: `tests/e2e/migration_e2e.sh` (add source config + execute steps)

**Step 1: Add PRISM source config after engagement creation**

In `migration_e2e.sh`, after the engagement is created (Phase 2), add:

```bash
# Configure source connection (PRISM)
SOURCE_PAYLOAD=$(cat <<EOF
{
  "driver": "postgres",
  "host": "prism-source",
  "port": "5432",
  "dbname": "prism_prod",
  "user": "prism",
  "password": "prism"
}
EOF
)
RESPONSE=$(do_post "/api/v1/migration/engagements/${ENGAGEMENT_ID}/source" "$SOURCE_PAYLOAD")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
assert_status "POST /migration/source (configure)" "200" "$HTTP_CODE"
```

**Step 2: Add batch execute after batch create**

After the batch is created (Phase 6), add:

```bash
if [ -n "$BATCH_ID" ] && [ "$BATCH_ID" != "null" ]; then
  RESPONSE=$(do_post "/api/v1/migration/batches/${BATCH_ID}/execute" "{}")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  assert_status "POST /migration/batches/:id/execute" "202" "$HTTP_CODE"

  # Poll for completion (max 60s)
  for i in $(seq 1 30); do
    sleep 2
    RESPONSE=$(do_get "/api/v1/migration/batches/${BATCH_ID}")
    BODY=$(echo "$RESPONSE" | head -1)
    STATUS=$(echo "$BODY" | jq -r '.data.status // "UNKNOWN"')
    if [ "$STATUS" = "LOADED" ] || [ "$STATUS" = "FAILED" ]; then
      break
    fi
  done
  echo -e "  Batch status: $STATUS"
fi
```

**Step 3: Run the E2E suite**

```bash
docker compose up -d --build
./tests/e2e/migration_e2e.sh
```

Expected: new source config + execute tests pass alongside existing 26 tests.

**Step 4: Commit**

```bash
git add tests/e2e/migration_e2e.sh
git commit -m "[tests/e2e] Add source config and batch execute to migration E2E"
```

---

## Task 10: Update Python E2E for Docker DNS

The Python `test_phase2_e2e.py` uses `localhost:8100` for the migration service.
When run from inside Docker or via the proof script, it needs to use Docker DNS
or nginx proxy.

**Files:**
- Modify: `migration-simulation/tests/test_phase2_e2e.py`

**Step 1: Update service URLs**

The test already reads `MIGRATION_URL` from env. Ensure the proof script passes
correct values. Update source connection payloads in the Python tests to use
Docker DNS hostnames:

- PRISM: `{"host": "prism-source", "port": "5432", "dbname": "prism_prod", "user": "prism", "password": "prism"}`
- PAS: `{"host": "pas-source", "port": "5432", "dbname": "pas_prod", "user": "pas", "password": "pas"}`

Add source configuration step in `TestPRISMMigration.test_01_create_engagement` (or
add a new `test_01b_configure_source` method):

```python
def test_01b_configure_source(self, prism_engagement):
    """Configure PRISM source connection."""
    api("post", f"/api/v1/migration/engagements/{prism_engagement}/source", json={
        "driver": "postgres",
        "host": os.getenv("PRISM_SOURCE_HOST", "prism-source"),
        "port": "5432",
        "dbname": "prism_prod",
        "user": "prism",
        "password": "prism",
    })
```

Same for PAS class.

**Step 2: Add profile request payloads**

The profile endpoint needs table names. Add profile configs for the actual source tables:

```python
def test_02_profile(self, prism_engagement):
    """Profiling PRISM source tables."""
    data = api("post", f"/api/v1/migration/engagements/{prism_engagement}/profile", json={
        "tables": [
            {"table_name": "src_prism.prism_member", "required_columns": ["mbr_nbr", "last_nm", "first_nm"],
             "key_columns": ["mbr_nbr"]},
            {"table_name": "src_prism.prism_sal_period", "required_columns": ["sal_prd_id", "emp_id"],
             "key_columns": ["sal_prd_id"]},
        ]
    })
    profiles = data["data"]
    assert len(profiles) > 0
```

**Step 3: Commit**

```bash
git add migration-simulation/tests/test_phase2_e2e.py
git commit -m "[migration] Update Python E2E for Docker DNS source connections"
```

---

## Task 11: Write Two-Source Proof Script

The orchestration script that runs the full proof.

**Files:**
- Create: `scripts/run_two_source_proof.sh`

**Step 1: Write the script**

```bash
#!/bin/bash
set -euo pipefail

# Two-Source Proof — Phase 3 Exit Gate
# Runs PRISM and PAS migration pipelines end-to-end against isolated source DBs.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
RESULTS_FILE="$ROOT_DIR/docs/plans/2026-03-22-two-source-proof-results.md"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS_COUNT=0
FAIL_COUNT=0

log() { echo -e "${GREEN}[PROOF]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
pass() { echo -e "${GREEN}[PASS]${NC} $*"; PASS_COUNT=$((PASS_COUNT + 1)); }

api_post() { curl -sf -X POST "$BASE_URL$1" -H "Content-Type: application/json" -d "$2" 2>/dev/null; }
api_get() { curl -sf "$BASE_URL$1" 2>/dev/null; }

# ─── Phase 1: Infrastructure ──────────────────────────────
log "Phase 1: Starting services..."
cd "$ROOT_DIR"
docker compose up -d --build

log "Waiting for services..."
for i in $(seq 1 60); do
  HEALTH=$(curl -sf "$BASE_URL/api/v1/health/aggregate" 2>/dev/null | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
  [ "$HEALTH" = "ok" ] && break
  sleep 2
done

# Verify source DBs are ready
docker compose exec -T prism-source pg_isready -U prism -d prism_prod > /dev/null && pass "PRISM source DB ready" || fail "PRISM source DB not ready"
docker compose exec -T pas-source pg_isready -U pas -d pas_prod > /dev/null && pass "PAS source DB ready" || fail "PAS source DB not ready"

# ─── Phase 2: PRISM Migration ─────────────────────────────
log "Phase 2: PRISM migration pipeline..."

PRISM_ENG=$(api_post "/api/v1/migration/engagements" '{"source_system_name":"PRISM"}' | jq -r '.data.engagement_id')
log "  Created engagement: $PRISM_ENG"

# Configure source
api_post "/api/v1/migration/engagements/$PRISM_ENG/source" \
  '{"driver":"postgres","host":"prism-source","port":"5432","dbname":"prism_prod","user":"prism","password":"prism"}' > /dev/null \
  && pass "PRISM source configured" || fail "PRISM source config failed"

# Profile
PROFILE_RESULT=$(api_post "/api/v1/migration/engagements/$PRISM_ENG/profile" \
  '{"tables":[{"table_name":"src_prism.prism_member","required_columns":["mbr_nbr","last_nm"],"key_columns":["mbr_nbr"]}]}')
[ "$(echo "$PROFILE_RESULT" | jq '.data | length')" -gt 0 ] \
  && pass "PRISM profiled" || fail "PRISM profiling failed"

# Generate mappings
MAPPING_RESULT=$(api_post "/api/v1/migration/engagements/$PRISM_ENG/generate-mappings" '{}')
MAPPING_COUNT=$(echo "$MAPPING_RESULT" | jq '.data | length' 2>/dev/null || echo "0")
log "  Generated $MAPPING_COUNT mappings"
[ "$MAPPING_COUNT" -gt 0 ] && pass "PRISM mappings generated" || fail "PRISM mapping generation failed"

# Create and execute batch
BATCH_RESULT=$(api_post "/api/v1/migration/engagements/$PRISM_ENG/batches" '{"batch_scope":"full","mapping_version":"v1.0"}')
PRISM_BATCH=$(echo "$BATCH_RESULT" | jq -r '.data.batch_id')
api_post "/api/v1/migration/batches/$PRISM_BATCH/execute" '{}' > /dev/null

# Poll for completion
for i in $(seq 1 30); do
  sleep 2
  BATCH_STATUS=$(api_get "/api/v1/migration/batches/$PRISM_BATCH" | jq -r '.data.status')
  [ "$BATCH_STATUS" = "LOADED" ] || [ "$BATCH_STATUS" = "FAILED" ] && break
done
[ "$BATCH_STATUS" = "LOADED" ] && pass "PRISM batch loaded" || fail "PRISM batch status: $BATCH_STATUS"

# Reconcile
api_post "/api/v1/migration/batches/$PRISM_BATCH/reconcile" '{}' > /dev/null
PRISM_RECON=$(api_get "/api/v1/migration/engagements/$PRISM_ENG/reconciliation/summary")
PRISM_GATE=$(echo "$PRISM_RECON" | jq -r '.data.gate_passed // false')
PRISM_SCORE=$(echo "$PRISM_RECON" | jq -r '.data.weighted_score // 0')
PRISM_P1=$(echo "$PRISM_RECON" | jq -r '.data.p1_unresolved // -1')
[ "$PRISM_GATE" = "true" ] && pass "PRISM gate passed (score=$PRISM_SCORE, P1=$PRISM_P1)" \
  || fail "PRISM gate failed (score=$PRISM_SCORE, P1=$PRISM_P1)"

# ─── Phase 3: PAS Migration ───────────────────────────────
log "Phase 3: PAS migration pipeline..."

PAS_ENG=$(api_post "/api/v1/migration/engagements" '{"source_system_name":"PAS"}' | jq -r '.data.engagement_id')
log "  Created engagement: $PAS_ENG"

api_post "/api/v1/migration/engagements/$PAS_ENG/source" \
  '{"driver":"postgres","host":"pas-source","port":"5432","dbname":"pas_prod","user":"pas","password":"pas"}' > /dev/null \
  && pass "PAS source configured" || fail "PAS source config failed"

PROFILE_RESULT=$(api_post "/api/v1/migration/engagements/$PAS_ENG/profile" \
  '{"tables":[{"table_name":"src_pas.member","required_columns":["member_id","first_name"],"key_columns":["member_id"]}]}')
[ "$(echo "$PROFILE_RESULT" | jq '.data | length')" -gt 0 ] \
  && pass "PAS profiled" || fail "PAS profiling failed"

MAPPING_RESULT=$(api_post "/api/v1/migration/engagements/$PAS_ENG/generate-mappings" '{}')
MAPPING_COUNT=$(echo "$MAPPING_RESULT" | jq '.data | length' 2>/dev/null || echo "0")
[ "$MAPPING_COUNT" -gt 0 ] && pass "PAS mappings generated" || fail "PAS mapping generation failed"

BATCH_RESULT=$(api_post "/api/v1/migration/engagements/$PAS_ENG/batches" '{"batch_scope":"full","mapping_version":"v1.0"}')
PAS_BATCH=$(echo "$BATCH_RESULT" | jq -r '.data.batch_id')
api_post "/api/v1/migration/batches/$PAS_BATCH/execute" '{}' > /dev/null

for i in $(seq 1 30); do
  sleep 2
  BATCH_STATUS=$(api_get "/api/v1/migration/batches/$PAS_BATCH" | jq -r '.data.status')
  [ "$BATCH_STATUS" = "LOADED" ] || [ "$BATCH_STATUS" = "FAILED" ] && break
done
[ "$BATCH_STATUS" = "LOADED" ] && pass "PAS batch loaded" || fail "PAS batch status: $BATCH_STATUS"

api_post "/api/v1/migration/batches/$PAS_BATCH/reconcile" '{}' > /dev/null
PAS_RECON=$(api_get "/api/v1/migration/engagements/$PAS_ENG/reconciliation/summary")
PAS_GATE=$(echo "$PAS_RECON" | jq -r '.data.gate_passed // false')
PAS_SCORE=$(echo "$PAS_RECON" | jq -r '.data.weighted_score // 0')
PAS_P1=$(echo "$PAS_RECON" | jq -r '.data.p1_unresolved // -1')
[ "$PAS_GATE" = "true" ] && pass "PAS gate passed (score=$PAS_SCORE, P1=$PAS_P1)" \
  || fail "PAS gate failed (score=$PAS_SCORE, P1=$PAS_P1)"

# ─── Phase 4: Cross-Source Verification ────────────────────
log "Phase 4: Cross-source verification..."

# Both sources in canonical
SOURCES=$(docker compose exec -T postgres psql -U noui -d noui -t -c \
  "SELECT DISTINCT e.source_system_name FROM migration.lineage l
   JOIN migration.batch b ON b.batch_id = l.batch_id
   JOIN migration.engagement e ON e.engagement_id = b.engagement_id
   WHERE l.superseded_by IS NULL;")
echo "$SOURCES" | grep -q "PRISM" && pass "PRISM data in canonical" || fail "PRISM not in canonical"
echo "$SOURCES" | grep -q "PAS" && pass "PAS data in canonical" || fail "PAS not in canonical"

# ─── Phase 5: Cross-Language Verification ──────────────────
log "Phase 5: Cross-language verification..."

cd "$ROOT_DIR/platform/migration"
go test ./reconciler/... -run TestCrossLanguage -count=1 -v 2>&1 | tail -5
[ ${PIPESTATUS[0]} -eq 0 ] && pass "Go cross-language fixtures" || fail "Go cross-language fixtures"

cd "$ROOT_DIR/migration-simulation"
python -m pytest tests/test_cross_language.py -v 2>&1 | tail -5
[ ${PIPESTATUS[0]} -eq 0 ] && pass "Python cross-language fixtures" || fail "Python cross-language fixtures"

# ─── Results ───────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "  TWO-SOURCE PROOF RESULTS"
echo "═══════════════════════════════════════════════════"
echo "  PRISM: gate=$PRISM_GATE score=$PRISM_SCORE P1=$PRISM_P1"
echo "  PAS:   gate=$PAS_GATE score=$PAS_SCORE P1=$PAS_P1"
echo "  Tests: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "═══════════════════════════════════════════════════"

[ "$FAIL_COUNT" -eq 0 ] && echo -e "${GREEN}PROOF PASSED${NC}" || echo -e "${RED}PROOF FAILED${NC}"
exit $FAIL_COUNT
```

**Step 2: Make executable**

```bash
chmod +x scripts/run_two_source_proof.sh
```

**Step 3: Commit**

```bash
git add scripts/run_two_source_proof.sh
git commit -m "[migration] Add two-source proof orchestration script"
```

---

## Task 12: Run the Proof and Debug

This is the iterative task. Run the proof, fix failures, repeat.

**Files:**
- Various (depends on failures)

**Step 1: Run the proof**

```bash
./scripts/run_two_source_proof.sh
```

**Step 2: Debug failures**

Expected failure categories:
1. **Source connection failures** — Docker DNS resolution, credentials
2. **Profiler SQL errors** — queries assume specific schema structure
3. **Mapping quality** — template matcher may not recognize PRISM column names
4. **Transformation errors** — data quality issues in source (expected, should be quarantined)
5. **Reconciliation mismatches** — formula implementation vs. generator formula

For each failure:
- Read the error
- Trace to root cause
- Fix
- Re-run affected phase

**Step 3: Iterate until all 12 criteria pass**

**Step 4: Commit each fix**

```bash
git commit -m "[migration] Fix <specific issue> in two-source proof"
```

---

## Task 13: Document Results

Write the proof results document.

**Files:**
- Create: `docs/plans/2026-03-22-two-source-proof-results.md`

**Step 1: Write results**

```markdown
# Two-Source Proof Results — 2026-03-22

## Summary
- PRISM: X members, Y% weighted match, Z exceptions
- PAS: X members, Y% weighted match, Z exceptions
- Cross-language: $0.00 variance
- Schema: confirmed unchanged

## Detailed Results
[12 criteria table with PASS/FAIL for each]

## Issues Found and Fixed
[List of bugs found during the proof run]

## Corpus
[Number of entries seeded from each source]
```

**Step 2: Update BUILD_HISTORY.md**

Add a new entry documenting the two-source proof milestone.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-22-two-source-proof-results.md BUILD_HISTORY.md
git commit -m "[migration] Two-source proof milestone — Phase 3 complete"
```

---

## Task Summary

| # | Task | Estimated Size | Dependencies |
|---|------|---------------|--------------|
| 1 | Copy source files into repo | S | None |
| 2 | Port PRISM DDL to PostgreSQL | M | 1 |
| 3 | Adapt PRISM data generator | M | 2 |
| 4 | Adapt PAS schema and generator | M | 1 |
| 5 | Add source DB containers to Docker | S | 2, 4 |
| 6 | Fix profile handler (use source DB) | S | None |
| 7 | Implement DB source row provider | M | 6 |
| 8 | Add batch execute endpoint | M | 7 |
| 9 | Add source config to migration E2E | S | 5, 8 |
| 10 | Update Python E2E for Docker DNS | S | 5, 8 |
| 11 | Write proof orchestration script | M | 9, 10 |
| 12 | Run proof and debug | L | 11 |
| 13 | Document results | S | 12 |

**Critical path:** 1 → 2 → 3 → 5 → 9 → 11 → 12 → 13
**Parallel track:** 6 → 7 → 8 (can be done alongside 1-5)
