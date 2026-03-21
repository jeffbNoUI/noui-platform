# Migration Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Go migration service + Python intelligence service that auto-maps two structurally different pension source databases (PRISM and PAS) to the NoUI canonical schema, achieving >=95% weighted reconciliation match rate with zero unresolved P1 items.

**Architecture:** Hybrid Go/Python following the MC worker precedent. Go service (`platform/migration/`, port 8100) handles the deterministic pipeline: template matching, transformation, loading, reconciliation orchestration. Python service (`migration-intelligence/`, port 8101) handles learning: signal scoring, column profiling, corpus management, mismatch analysis. Existing Python simulation (`migration-simulation/`) serves as the test oracle for cross-language verification.

**Tech Stack:** Go 1.22 (platform service), Python 3.11 + FastAPI (intelligence service), PostgreSQL (migration schema), Docker Compose (orchestration). Go uses `big.Rat` for monetary math, Python uses `Decimal` with ROUND_HALF_UP.

**Design Doc:** `docs/plans/2026-03-20-migration-engine-design.md`

**Port Note:** 8089 is taken by preferences. Migration = 8100, Intelligence = 8101.

---

## Phase 1: Foundation

### Task 1: Fix PAS Simulation Package Schema Mismatches

The GPT-generated PAS package has known schema name mismatches between DDL (`src_pas`), CSV loader (`src`), and scorecard queries (`src`/`audit`). Fix these so PAS can be loaded cleanly.

**Files:**
- Modify: `C:\Users\jeffb\docs\plans\gpt\pas_simulation_source_model.sql` (schema names)
- Modify: `C:\Users\jeffb\docs\plans\gpt\pas_load_from_csv.sql` (schema references)
- Modify: `C:\Users\jeffb\docs\plans\gpt\pas_reconciliation_scorecard.sql` (schema references)
- Modify: `C:\Users\jeffb\docs\plans\gpt\generate_pas_scenarios.py` (CSV header alignment)

**Step 1: Audit schema name usage across all PAS files**

The DDL creates schema `src_pas` but the loader and scorecard use `src`, `audit`, `recon`. Standardize on `src_pas`, `audit_pas`, `recon_pas` to avoid collisions with any existing schemas.

**Step 2: Update DDL schema names if needed**

Verify `pas_simulation_source_model.sql` uses consistent schema names. Check that all CREATE TABLE statements, FK references, and index definitions use the same schema prefix.

**Step 3: Update CSV loader schema references**

In `pas_load_from_csv.sql`, replace all `src.` references with the correct schema from the DDL. Ensure `\copy` column lists match DDL column order and names.

**Step 4: Update scorecard query schema references**

In `pas_reconciliation_scorecard.sql`, align all table references with the corrected DDL schema names.

**Step 5: Generate test data and validate load**

```bash
cd C:\Users\jeffb\docs\plans\gpt
python generate_pas_scenarios.py --members 50 --scenario baseline --output-dir ./pas_test_output
```

Verify CSVs have correct headers matching the DDL column names. Load into a test PostgreSQL instance and run the scorecard queries to confirm no errors.

**Step 6: Commit**

```bash
git add docs/plans/gpt/
git commit -m "fix(pas): Standardize schema names across DDL, loader, and scorecard"
```

---

### Task 2: Migration Schema DDL

Create the `migration.*` schema tables defined in the design doc Appendix A.

**Files:**
- Create: `db/migrations/030_migration_schema.sql`
- Create: `platform/migration/db/migration_schema_test.sql` (validation queries)

**Step 1: Write the migration DDL**

Create `db/migrations/030_migration_schema.sql` with:
- `CREATE SCHEMA IF NOT EXISTS migration;`
- All 10 tables from design doc Appendix A: `engagement`, `quality_profile`, `field_mapping`, `code_mapping`, `batch`, `lineage`, `exception`, `reconciliation`, `correction`, `analyst_decision`
- Indexes on: `lineage(batch_id, source_table, source_id)`, `lineage(canonical_table, canonical_id)`, `exception(batch_id, disposition)`, `reconciliation(batch_id, priority)`, `field_mapping(engagement_id, approval_status)`

**Step 2: Write validation queries**

Create a SQL file that verifies all tables exist and constraints work:
- INSERT + SELECT round-trip for each table
- Verify CHECK constraints reject invalid values
- Verify FK relationships work

**Step 3: Test against local PostgreSQL**

```bash
docker compose exec -T postgres psql -U noui -d noui -f /path/to/030_migration_schema.sql
```

Run validation queries, confirm all pass.

**Step 4: Commit**

```bash
git add db/migrations/030_migration_schema.sql
git commit -m "[platform/migration] Add migration schema DDL (10 tables)"
```

---

### Task 3: Go Migration Service Skeleton

Set up the Go service following existing platform service patterns (reference: `platform/dataaccess/`).

**Files:**
- Create: `platform/migration/go.mod`
- Create: `platform/migration/go.sum`
- Create: `platform/migration/main.go`
- Create: `platform/migration/Dockerfile`
- Create: `platform/migration/.dockerignore`
- Create: `platform/migration/api/handlers.go`
- Create: `platform/migration/api/handlers_test.go`
- Create: `platform/migration/db/postgres.go`

**Step 1: Create go.mod**

```
module github.com/noui/platform/migration

go 1.22.0

require (
    github.com/lib/pq v1.11.2
    github.com/google/uuid v1.6.0
    github.com/noui/platform/apiresponse v0.0.0
    github.com/noui/platform/auth v0.0.0
    github.com/noui/platform/dbcontext v0.0.0
    github.com/noui/platform/envutil v0.0.0
    github.com/noui/platform/healthutil v0.0.0
    github.com/noui/platform/logging v0.0.0
    github.com/noui/platform/ratelimit v0.0.0
    github.com/noui/platform/validation v0.0.0
)

replace (
    github.com/noui/platform/apiresponse => ../apiresponse
    github.com/noui/platform/auth => ../auth
    github.com/noui/platform/dbcontext => ../dbcontext
    github.com/noui/platform/envutil => ../envutil
    github.com/noui/platform/healthutil => ../healthutil
    github.com/noui/platform/logging => ../logging
    github.com/noui/platform/ratelimit => ../ratelimit
    github.com/noui/platform/validation => ../validation
)
```

**Step 2: Create main.go**

Follow the exact pattern from `platform/dataaccess/main.go`:
- Logger setup via `logging.Setup("migration", nil)`
- DB connection via `db.Connect(db.ConfigFromEnv())`
- Health endpoints: `/healthz`, `/health/detail`, `/ready`
- Middleware chain: CORS → Auth → RateLimit → DBContext → Counter → Logging → Handler
- Port: 8100 (from `PORT` env var, default "8100")
- Graceful shutdown with signal handling

**Step 3: Create api/handlers.go**

```go
package api

type Handler struct {
    DB *sql.DB
}

func NewHandler(db *sql.DB) *Handler {
    return &Handler{DB: db}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
    mux.HandleFunc("GET /healthz", h.HealthCheck)
    // Phase 1 endpoints (add as implemented):
    // mux.HandleFunc("POST /api/v1/migration/engagements", h.CreateEngagement)
    // mux.HandleFunc("GET /api/v1/migration/engagements/{id}", h.GetEngagement)
}
```

**Step 4: Create db/postgres.go**

Copy the connection pattern from `platform/dataaccess/db/postgres.go`:
- `Config` struct with env vars
- `ConfigFromEnv()` using `envutil.GetEnv`
- `Connect()` with 5-attempt retry + exponential backoff
- Connection pool settings: MaxOpen=8, MaxIdle=3, MaxLifetime=5m

**Step 5: Create Dockerfile**

Multi-stage build following `platform/dataaccess/Dockerfile`:
- Builder: `golang:1.22-alpine`
- Copy shared packages (apiresponse, auth, dbcontext, envutil, healthutil, logging, ratelimit, validation)
- Copy migration service
- Production: `gcr.io/distroless/static-debian12:nonroot`
- EXPOSE 8100

**Step 6: Write health check test**

```go
func TestHealthCheck(t *testing.T) {
    h := &Handler{}
    req := httptest.NewRequest("GET", "/healthz", nil)
    w := httptest.NewRecorder()
    h.HealthCheck(w, req)
    if w.Code != http.StatusOK {
        t.Fatalf("expected 200, got %d", w.Code)
    }
}
```

**Step 7: Build and verify**

```bash
cd platform/migration && go build ./... && go test ./... -short -v
```

**Step 8: Commit**

```bash
git add platform/migration/
git commit -m "[platform/migration] Add Go service skeleton with health endpoints"
```

---

### Task 4: Engagement CRUD API

Implement the engagement lifecycle: create, get, update status.

**Files:**
- Create: `platform/migration/models/types.go`
- Create: `platform/migration/db/engagement.go`
- Create: `platform/migration/db/engagement_test.go`
- Modify: `platform/migration/api/handlers.go` (add routes)
- Create: `platform/migration/api/engagement_handlers.go`
- Create: `platform/migration/api/engagement_handlers_test.go`

**Step 1: Define types**

```go
// models/types.go
package models

type EngagementStatus string
const (
    StatusProfiling     EngagementStatus = "PROFILING"
    StatusMapping       EngagementStatus = "MAPPING"
    StatusTransforming  EngagementStatus = "TRANSFORMING"
    StatusReconciling   EngagementStatus = "RECONCILING"
    StatusParallelRun   EngagementStatus = "PARALLEL_RUN"
    StatusComplete      EngagementStatus = "COMPLETE"
)

type Engagement struct {
    EngagementID             string           `json:"engagement_id"`
    TenantID                 string           `json:"tenant_id"`
    SourceSystemName         string           `json:"source_system_name"`
    CanonicalSchemaVersion   string           `json:"canonical_schema_version"`
    Status                   EngagementStatus `json:"status"`
    QualityBaselineApprovedAt *time.Time      `json:"quality_baseline_approved_at"`
    CreatedAt                time.Time        `json:"created_at"`
    UpdatedAt                time.Time        `json:"updated_at"`
}
```

**Step 2: Write failing DB test**

```go
// db/engagement_test.go
func TestCreateEngagement(t *testing.T) {
    // Use sqlmock
    db, mock, _ := sqlmock.New()
    mock.ExpectQuery("INSERT INTO migration.engagement").
        WithArgs("tenant-1", "PRISM", "v1.0").
        WillReturnRows(sqlmock.NewRows([]string{"engagement_id"}).AddRow("eng-1"))
    eng, err := CreateEngagement(db, "tenant-1", "PRISM")
    // assert no error, eng.EngagementID == "eng-1"
}
```

**Step 3: Implement DB functions**

```go
// db/engagement.go
func CreateEngagement(db *sql.DB, tenantID, sourceName string) (*models.Engagement, error)
func GetEngagement(db *sql.DB, engagementID string) (*models.Engagement, error)
func UpdateEngagementStatus(db *sql.DB, engagementID string, status models.EngagementStatus) error
```

**Step 4: Write handler tests and implement handlers**

- `POST /api/v1/migration/engagements` — CreateEngagement
- `GET /api/v1/migration/engagements/{id}` — GetEngagement
- `PATCH /api/v1/migration/engagements/{id}` — UpdateEngagement (status transitions)

Validate: `source_system_name` required, status transitions follow PROFILING→MAPPING→TRANSFORMING→RECONCILING→...

**Step 5: Run tests**

```bash
cd platform/migration && go test ./... -short -v
```

**Step 6: Commit**

```bash
git commit -m "[platform/migration] Add engagement CRUD API"
```

---

### Task 5: Template Registry

Define mapping templates for each connector concept tag. This is the deterministic mapping path.

**Files:**
- Create: `platform/migration/mapper/template.go`
- Create: `platform/migration/mapper/template_test.go`
- Create: `platform/migration/mapper/registry.go`

**Step 1: Define template types**

```go
// mapper/template.go
package mapper

type MappingTemplate struct {
    ConceptTag     string          `json:"concept_tag"`
    CanonicalTable string          `json:"canonical_table"`
    Slots          []TemplateSlot  `json:"slots"`
}

type TemplateSlot struct {
    CanonicalColumn string   `json:"canonical_column"`
    ExpectedNames   []string `json:"expected_names"`   // column name patterns to match
    ExpectedType    string   `json:"expected_type"`     // "DECIMAL", "VARCHAR", "DATE", etc.
    Required        bool     `json:"required"`
}
```

**Step 2: Write test for template lookup**

```go
func TestRegistryLookup(t *testing.T) {
    reg := NewRegistry()
    tmpl, ok := reg.Get("employee-master")
    if !ok { t.Fatal("expected employee-master template") }
    if tmpl.CanonicalTable != "member" { t.Fatal("wrong table") }
    // Verify it has slots for: member_id, national_id, birth_date, etc.
}
```

**Step 3: Build the registry with templates for all 18 concepts**

Map each of the connector's 18 concept tags to its canonical table and expected columns. Reference the canonical schema from `migration-simulation/db/canonical_init.sql`:

| Concept Tag | Canonical Table | Key Slots |
|---|---|---|
| employee-master | member | member_id, national_id, birth_date, first_name, last_name, original_hire_date, plan_code, plan_tier, status |
| salary-history | earnings | member_id, period_start, period_end, gross_amount, pensionable_amount, granularity |
| payroll-run | (reference only) | employer_id, period_start, period_end, pay_frequency |
| employment-timeline | employment | member_id, employer_code, spell_start_date, spell_end_date |
| service-credit | service_credit | member_id, as_of_date, credited_years_total, service_type |
| beneficiary-designation | (new canonical table or nested) | member_id, beneficiary_name, relationship, allocation_pct |
| domestic-relations-order | (new canonical table or nested) | member_id, alternate_payee, order_type, effective_date |
| benefit-payment | payment | member_id, pay_period_date, gross_amount, net_amount |
| case-management | (future canonical table) | member_id, case_type, opened_date, status |
| audit-trail | (lineage table) | source_table, source_id, action |
| benefit-deduction | contribution | member_id, contribution_period, ee_amount, er_amount |
| leave-balance | (not in current canonical — flag as unmapped) | |
| attendance | (not in current canonical) | |
| training-record | (not in pension domain) | |
| expense-claim | (not in pension domain) | |
| performance-review | (not in pension domain) | |
| shift-schedule | (not in pension domain) | |
| loan-advance | (not in pension domain) | |

Each slot has `ExpectedNames` — multiple patterns the source column might use. E.g., for member birth_date: `["birth_date", "birth_dt", "dob", "date_of_birth", "birthdate"]`.

**Step 4: Run tests**

```bash
cd platform/migration && go test ./mapper/... -v
```

**Step 5: Commit**

```bash
git commit -m "[platform/migration] Add template registry for 18 concept tags"
```

---

### Task 6: Template Matcher

Given a concept-tagged table from the connector, match its columns to template slots.

**Files:**
- Create: `platform/migration/mapper/matcher.go`
- Create: `platform/migration/mapper/matcher_test.go`
- Create: `platform/migration/mapper/similarity.go`
- Create: `platform/migration/mapper/similarity_test.go`

**Step 1: Write similarity functions**

```go
// mapper/similarity.go

// NormalizedEditDistance returns 0.0 (identical) to 1.0 (completely different)
func NormalizedEditDistance(a, b string) float64

// TokenOverlap splits on _ and compares token sets, returns 0.0 to 1.0
func TokenOverlap(a, b string) float64

// ColumnNameSimilarity combines edit distance and token overlap
func ColumnNameSimilarity(source, target string) float64
```

**Step 2: Write tests for similarity**

```go
func TestColumnNameSimilarity(t *testing.T) {
    tests := []struct{ source, target string; minScore float64 }{
        {"birth_date", "birth_date", 1.0},       // exact
        {"BIRTH_DT", "birth_date", 0.6},         // abbreviated
        {"dob", "birth_date", 0.3},               // different name, same concept
        {"salary_amount", "gross_amount", 0.4},   // partial overlap
        {"xyz_abc", "birth_date", 0.0},           // unrelated
    }
    // ... run and assert
}
```

**Step 3: Write the matcher**

```go
// mapper/matcher.go

type ColumnMatch struct {
    SourceColumn    string  `json:"source_column"`
    CanonicalColumn string  `json:"canonical_column"`
    Confidence      float64 `json:"confidence"`
    MatchMethod     string  `json:"match_method"` // "exact", "pattern", "similarity"
}

// MatchColumns takes a concept-tagged table's columns and a template,
// returns proposed column matches with confidence scores.
func MatchColumns(sourceColumns []schema.ColumnInfo, template MappingTemplate) []ColumnMatch
```

Matching priority:
1. Exact name match (confidence 1.0)
2. Pattern match against `ExpectedNames` (confidence 0.9)
3. Similarity score > 0.7 + compatible type (confidence = similarity * 0.85)
4. Type-only match for required slots with no name match (confidence 0.3, flagged for review)

**Step 4: Write matcher tests using PRISM and PAS column names**

```go
func TestMatchColumns_PRISM_Member(t *testing.T) {
    // PRISM_MEMBER columns: MBR_NBR, NATL_ID, BIRTH_DT, FIRST_NM, LAST_NM, ...
    // Should match to canonical member template slots
    sourceColumns := []schema.ColumnInfo{
        {Name: "MBR_NBR", DataType: "integer"},
        {Name: "NATL_ID", DataType: "varchar"},
        {Name: "BIRTH_DT", DataType: "varchar"},
        // ...
    }
    tmpl, _ := NewRegistry().Get("employee-master")
    matches := MatchColumns(sourceColumns, tmpl)
    // Assert MBR_NBR -> member_id, NATL_ID -> national_id, BIRTH_DT -> birth_date
}

func TestMatchColumns_PAS_Member(t *testing.T) {
    // PAS member columns: member_id (UUID), ssn, first_name, last_name, birth_date, ...
    // Should also match to the same canonical member template
    sourceColumns := []schema.ColumnInfo{
        {Name: "member_id", DataType: "uuid"},
        {Name: "ssn", DataType: "varchar"},
        {Name: "birth_date", DataType: "date"},
        // ...
    }
    tmpl, _ := NewRegistry().Get("employee-master")
    matches := MatchColumns(sourceColumns, tmpl)
    // Assert member_id -> member_id, ssn -> national_id, birth_date -> birth_date
}
```

**Step 5: Run tests**

```bash
cd platform/migration && go test ./mapper/... -v
```

**Step 6: Commit**

```bash
git commit -m "[platform/migration] Add template matcher with column similarity scoring"
```

---

### Task 7: Python Intelligence Service Skeleton

Set up the FastAPI service for signal scoring and corpus management.

**Files:**
- Create: `migration-intelligence/pyproject.toml`
- Create: `migration-intelligence/service.py`
- Create: `migration-intelligence/Dockerfile`
- Create: `migration-intelligence/scorer/__init__.py`
- Create: `migration-intelligence/scorer/signal.py`
- Create: `migration-intelligence/scorer/profiler.py`
- Create: `migration-intelligence/corpus/__init__.py`
- Create: `migration-intelligence/corpus/store.py`
- Create: `migration-intelligence/corpus/abstractor.py`
- Create: `migration-intelligence/tests/__init__.py`
- Create: `migration-intelligence/tests/test_service.py`

**Step 1: Create pyproject.toml**

```toml
[project]
name = "migration-intelligence"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110.0",
    "uvicorn>=0.27.0",
    "psycopg2-binary>=2.9.9",
    "numpy>=1.26.0",
    "rapidfuzz>=3.6.0",
    "pydantic>=2.6.0",
    "httpx>=0.27.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0.0", "pytest-asyncio>=0.23.0", "httpx>=0.27.0"]
```

**Step 2: Create FastAPI app**

```python
# service.py
from fastapi import FastAPI
app = FastAPI(title="Migration Intelligence Service", version="0.1.0")

@app.get("/healthz")
async def health():
    return {"status": "ok", "service": "migration-intelligence", "version": "0.1.0"}

@app.post("/intelligence/score-columns")
async def score_columns(request: ScoreColumnsRequest) -> ScoreColumnsResponse:
    # Phase 1 implementation
    pass

@app.post("/intelligence/record-decision")
async def record_decision(request: RecordDecisionRequest):
    pass

@app.post("/intelligence/analyze-mismatches")
async def analyze_mismatches(request: AnalyzeMismatchesRequest):
    pass

@app.get("/intelligence/corpus-stats")
async def corpus_stats():
    pass
```

**Step 3: Define Pydantic models**

```python
class ColumnProfile(BaseModel):
    column_name: str
    data_type: str
    null_rate: float
    cardinality: int
    sample_values: list[str] = []  # NOT stored in corpus, used only for scoring

class ScoreColumnsRequest(BaseModel):
    columns: list[ColumnProfile]
    concept_tag: str
    tenant_id: str

class ScoredMapping(BaseModel):
    source_column: str
    canonical_column: str
    confidence: float
    signals: dict[str, float]  # signal_name -> score

class ScoreColumnsResponse(BaseModel):
    mappings: list[ScoredMapping]
```

**Step 4: Write health check test**

```python
# tests/test_service.py
from httpx import AsyncClient
from service import app

async def test_health():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/healthz")
        assert resp.status_code == 200
        assert resp.json()["service"] == "migration-intelligence"
```

**Step 5: Create Dockerfile**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install .
COPY . .
EXPOSE 8101
CMD ["uvicorn", "service:app", "--host", "0.0.0.0", "--port", "8101"]
```

**Step 6: Run tests**

```bash
cd migration-intelligence && pip install -e ".[dev]" && pytest tests/ -v
```

**Step 7: Commit**

```bash
git commit -m "[migration-intelligence] Add Python FastAPI service skeleton"
```

---

### Task 8: Signal Scorer

Implement multi-signal column scoring in the Python intelligence service.

**Files:**
- Modify: `migration-intelligence/scorer/signal.py`
- Create: `migration-intelligence/scorer/similarity.py`
- Create: `migration-intelligence/tests/test_scorer.py`

**Step 1: Write failing tests for signal scoring**

```python
def test_score_exact_name_match():
    """Column named 'birth_date' should score high against canonical 'birth_date'"""
    score = name_similarity("birth_date", "birth_date")
    assert score >= 0.95

def test_score_abbreviated_name():
    """BIRTH_DT should still score reasonably against birth_date"""
    score = name_similarity("BIRTH_DT", "birth_date")
    assert score >= 0.5

def test_type_compatibility():
    """DECIMAL source to DECIMAL target should score 1.0"""
    score = type_compatibility("DECIMAL(10,2)", "DECIMAL(12,2)")
    assert score >= 0.9

def test_type_incompatibility():
    """VARCHAR source to DATE target should score low"""
    score = type_compatibility("VARCHAR(50)", "DATE")
    assert score <= 0.3
```

**Step 2: Implement signal functions**

```python
# scorer/signal.py
def name_similarity(source: str, target: str) -> float:
    """Combine edit distance + token overlap, case-insensitive"""

def type_compatibility(source_type: str, target_type: str) -> float:
    """Score 0-1 based on type family compatibility"""

def null_rate_signal(null_rate: float, is_required: bool) -> float:
    """High null rate on required field = low confidence"""

def cardinality_signal(cardinality: int, row_count: int, expected_pattern: str) -> float:
    """FK-like cardinality vs unique-key cardinality"""

def composite_score(signals: dict[str, float], weights: dict[str, float]) -> float:
    """Weighted combination of all signals"""
```

Default weights:
- name_similarity: 0.40
- type_compatibility: 0.25
- null_rate: 0.10
- cardinality: 0.10
- corpus_match: 0.15 (starts at 0 until corpus has data, redistributed)

**Step 3: Implement the score-columns endpoint**

Wire the signal functions into the `/intelligence/score-columns` handler:
1. For each source column, score against every canonical column in the concept's template
2. Return top-3 candidates per source column, sorted by composite score
3. Include individual signal scores for transparency

**Step 4: Write integration test with PRISM-like and PAS-like inputs**

```python
def test_score_prism_member_columns():
    """PRISM-style abbreviated names should map correctly"""
    request = ScoreColumnsRequest(
        columns=[
            ColumnProfile(column_name="MBR_NBR", data_type="INTEGER", null_rate=0.0, cardinality=500),
            ColumnProfile(column_name="NATL_ID", data_type="VARCHAR(11)", null_rate=0.02, cardinality=498),
            ColumnProfile(column_name="BIRTH_DT", data_type="VARCHAR(10)", null_rate=0.0, cardinality=450),
        ],
        concept_tag="employee-master",
        tenant_id="test-tenant",
    )
    response = score_columns_sync(request)
    # Assert top match for MBR_NBR is member_id
    # Assert top match for BIRTH_DT is birth_date
```

**Step 5: Run tests**

```bash
cd migration-intelligence && pytest tests/test_scorer.py -v
```

**Step 6: Commit**

```bash
git commit -m "[migration-intelligence] Add multi-signal column scorer"
```

---

### Task 9: Agreement Analysis

Build the agreement analyzer in the Go service that compares template matches vs signal scores.

**Files:**
- Create: `platform/migration/mapper/agreement.go`
- Create: `platform/migration/mapper/agreement_test.go`

**Step 1: Define agreement types**

```go
type AgreementStatus string
const (
    Agreed       AgreementStatus = "AGREED"
    Disagreed    AgreementStatus = "DISAGREED"
    TemplateOnly AgreementStatus = "TEMPLATE_ONLY"
    SignalOnly   AgreementStatus = "SIGNAL_ONLY"
)

type AgreementResult struct {
    SourceColumn       string          `json:"source_column"`
    CanonicalColumn    string          `json:"canonical_column"`
    TemplateConfidence float64         `json:"template_confidence"`
    SignalConfidence   float64         `json:"signal_confidence"`
    AgreementStatus    AgreementStatus `json:"agreement_status"`
    AutoApproved       bool            `json:"auto_approved"`
}
```

**Step 2: Write tests**

```go
func TestAgreement_BothAgree(t *testing.T) {
    tmpl := ColumnMatch{SourceColumn: "BIRTH_DT", CanonicalColumn: "birth_date", Confidence: 0.85}
    signal := ScoredMapping{SourceColumn: "BIRTH_DT", CanonicalColumn: "birth_date", Confidence: 0.78}
    result := AnalyzeAgreement(tmpl, signal)
    assert(result.AgreementStatus == Agreed)
    assert(result.AutoApproved == true)
}

func TestAgreement_Disagree(t *testing.T) {
    tmpl := ColumnMatch{SourceColumn: "AMT_01", CanonicalColumn: "gross_amount", Confidence: 0.6}
    signal := ScoredMapping{SourceColumn: "AMT_01", CanonicalColumn: "net_amount", Confidence: 0.7}
    result := AnalyzeAgreement(tmpl, signal)
    assert(result.AgreementStatus == Disagreed)
    assert(result.AutoApproved == false)
}
```

**Step 3: Implement**

```go
func AnalyzeAgreement(templateMatch ColumnMatch, signalMatch ScoredMapping) AgreementResult

// AnalyzeTableMappings compares full template and signal results for a table
func AnalyzeTableMappings(templateMatches []ColumnMatch, signalMatches []ScoredMapping) []AgreementResult
```

Rules:
- AGREED: both map to same canonical column → auto-approved if both confidence > 0.5
- DISAGREED: both map but to different canonical columns → review queue
- TEMPLATE_ONLY: template matched but signal found no match → approved with lower confidence
- SIGNAL_ONLY: signal matched but no template slot → "discovered column" for analyst

**Step 4: Run tests**

```bash
cd platform/migration && go test ./mapper/... -v
```

**Step 5: Commit**

```bash
git commit -m "[platform/migration] Add agreement analysis for dual mapping strategy"
```

---

### Task 10: ISO 8000 Quality Profiler

Implement the six-dimension quality profiler in the Go service.

**Files:**
- Create: `platform/migration/profiler/profiler.go`
- Create: `platform/migration/profiler/profiler_test.go`
- Create: `platform/migration/profiler/dimensions.go`

**Step 1: Define profiler types**

```go
type QualityDimension struct {
    Name  string  `json:"name"`
    Score float64 `json:"score"` // 0.0 to 1.0
    Details string `json:"details"`
}

type TableProfile struct {
    TableName   string             `json:"table_name"`
    RowCount    int                `json:"row_count"`
    Dimensions  []QualityDimension `json:"dimensions"`
    OverallScore float64           `json:"overall_score"`
}
```

**Step 2: Implement each dimension**

Each dimension runs SQL queries against the source database:

```go
// Completeness: 1 - (null_count / total_count) averaged across required columns
func ProfileCompleteness(db *sql.DB, table string, requiredColumns []string) QualityDimension

// Accuracy: regex pattern match rate for known-format columns (SSN, dates, etc.)
func ProfileAccuracy(db *sql.DB, table string, patternChecks []PatternCheck) QualityDimension

// Consistency: FK reference validity rate (non-orphan percentage)
func ProfileConsistency(db *sql.DB, table string, fkRefs []FKReference) QualityDimension

// Timeliness: how recent is the most recent record
func ProfileTimeliness(db *sql.DB, table string, dateColumns []string) QualityDimension

// Validity: business rule pass rate
func ProfileValidity(db *sql.DB, table string, rules []BusinessRule) QualityDimension

// Uniqueness: duplicate rate on key columns
func ProfileUniqueness(db *sql.DB, table string, keyColumns []string) QualityDimension
```

**Step 3: Write tests using sqlmock**

Test each dimension function with mocked query results. Verify score calculations are correct.

**Step 4: Wire to API endpoint**

`POST /api/v1/migration/engagements/:id/profile` triggers profiling and stores results in `migration.quality_profile`.

**Step 5: Run tests**

```bash
cd platform/migration && go test ./profiler/... -v
```

**Step 6: Commit**

```bash
git commit -m "[platform/migration] Add ISO 8000 six-dimension quality profiler"
```

---

### Task 11: Generate Mappings API Endpoint

Wire together template matcher + signal scorer + agreement analysis into the generate-mappings endpoint.

**Files:**
- Create: `platform/migration/api/mapping_handlers.go`
- Create: `platform/migration/api/mapping_handlers_test.go`
- Create: `platform/migration/intelligence/client.go` (HTTP client for Python service)
- Create: `platform/migration/intelligence/client_test.go`

**Step 1: Build the intelligence service HTTP client**

```go
// intelligence/client.go
type Client struct {
    BaseURL    string
    HTTPClient *http.Client
}

func NewClient(baseURL string) *Client

func (c *Client) ScoreColumns(ctx context.Context, req ScoreColumnsRequest) (*ScoreColumnsResponse, error)
```

**Step 2: Implement generate-mappings handler**

`POST /api/v1/migration/engagements/:id/generate-mappings`:

1. Fetch the connector manifest for this engagement's source DB (call connector `/api/v1/tags`)
2. For each concept-tagged table in the manifest:
   a. Look up the template from the registry
   b. Run template matching (Go, local)
   c. Call intelligence service `/intelligence/score-columns` (Python, remote)
   d. Run agreement analysis
3. Store all proposed mappings in `migration.field_mapping`
4. Return: `{ total_columns, agreed, disagreed, template_only, signal_only, auto_approved }`

**Step 3: Gate check**

Verify quality baseline is approved (`quality_baseline_approved_at IS NOT NULL`) before allowing mapping generation. Return 409 if not.

**Step 4: Implement GET/PUT mapping endpoints**

- `GET /api/v1/migration/engagements/:id/mappings` — list all, filterable by status
- `PUT /api/v1/migration/engagements/:id/mappings/:mapping_id` — approve/reject

**Step 5: Write tests with mocked connector + intelligence service**

**Step 6: Run tests**

```bash
cd platform/migration && go test ./... -short -v
```

**Step 7: Commit**

```bash
git commit -m "[platform/migration] Add generate-mappings endpoint with dual strategy"
```

---

### Task 12: Docker Integration — Phase 1

Add both new services to docker-compose.yml and verify end-to-end.

**Files:**
- Modify: `docker-compose.yml` (add migration + intelligence services)
- Create: `migration-intelligence/docker-compose.test.yml` (standalone test compose)

**Step 1: Add Go migration service to docker-compose.yml**

```yaml
migration:
  build:
    context: ./platform
    dockerfile: migration/Dockerfile
  ports:
    - "8100:8100"
  environment:
    PORT: "8100"
    DB_HOST: pgbouncer
    DB_PORT: "6432"
    DB_USER: noui
    DB_PASSWORD: noui
    DB_NAME: noui
    DB_SSLMODE: disable
    CORS_ORIGIN: "http://localhost:3000"
    INTELLIGENCE_URL: "http://migration-intelligence:8101"
  depends_on:
    pgbouncer:
      condition: service_healthy
```

**Step 2: Add Python intelligence service**

```yaml
migration-intelligence:
  build:
    context: ./migration-intelligence
  ports:
    - "8101:8101"
  environment:
    PORT: "8101"
    DB_HOST: postgres
    DB_PORT: "5432"
    DB_USER: noui
    DB_PASSWORD: noui
    DB_NAME: noui_intelligence
```

**Step 3: Add to healthagg HEALTH_SERVICES**

**Step 4: Verify both services start**

```bash
docker compose up --build migration migration-intelligence
# Check health endpoints
curl http://localhost:8100/healthz
curl http://localhost:8101/healthz
```

**Step 5: Commit**

```bash
git commit -m "[infrastructure] Add migration + intelligence services to Docker Compose"
```

---

## Phase 2: Transform + Load

### Task 13: Transformation Pipeline

Build the ordered transformation handler chain in Go.

**Files:**
- Create: `platform/migration/transformer/pipeline.go`
- Create: `platform/migration/transformer/pipeline_test.go`
- Create: `platform/migration/transformer/handlers.go`
- Create: `platform/migration/transformer/handlers_test.go`

**Step 1: Define pipeline types**

```go
type TransformHandler struct {
    Name     string
    Priority int // execution order
    Apply    func(sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error)
}

type TransformContext struct {
    EngagementID   string
    MappingVersion string
    CodeMappings   map[string]map[string]string // table.column -> source_value -> canonical_value
    Lineage        []LineageEntry
    Exceptions     []ExceptionEntry
}

type TransformResult struct {
    CanonicalRow   map[string]interface{}
    Lineage        []LineageEntry
    Exceptions     []ExceptionEntry
    Confidence     string // ACTUAL, DERIVED, ESTIMATED, ROLLED_UP
}
```

**Step 2: Implement core handlers**

Port the 12 problem handlers from the Python simulation to Go, generalized:

| Handler | Purpose | From Python |
|---|---|---|
| TypeCoerce | Convert source types to canonical types | General |
| NormalizeSSN | Strip dashes/spaces from SSN-pattern columns | P-03 |
| ParseDate | Parse multiple date formats (YYYYMMDD, MM/DD/YYYY, ISO) | P-02 |
| ResolveCode | Look up code table mappings | P-12 |
| ResolveMemberKey | Handle multiple ID aliases | P-01 |
| ResolveStatus | Map status codes across semantic epochs | P-04 |
| DetectGranularity | Flag annual vs detailed salary/contribution records | P-06 |
| DeduplicateQDRO | Remove QDRO records that duplicate beneficiary data | P-08 |
| ResolveAddress | Pick authoritative address from conflicting sources | P-10 |
| MapHireDates | Distinguish career hire vs spell start | P-11 |
| ValidateConstraints | Check NOT NULL, type, range before load | NEW |
| DeriveDefaults | Compute derivable values for missing fields | NEW |

**Step 3: Write tests for each handler**

Reference the 75 existing Python tests in `migration-simulation/tests/test_transformations.py` as the specification. The Go implementations must produce identical outputs.

**Step 4: Build the pipeline executor**

```go
func (p *Pipeline) Transform(sourceRows []map[string]interface{}, mappings []FieldMapping) []TransformResult
```

Handlers execute in priority order. Each handler can:
- Transform the value (normal path)
- Add a lineage entry (audit trail)
- Add an exception entry (constraint violation → quarantine)
- Set confidence level

**Step 5: Run tests**

```bash
cd platform/migration && go test ./transformer/... -v
```

**Step 6: Commit**

```bash
git commit -m "[platform/migration] Add transformation pipeline with 12 handlers"
```

---

### Task 14: Batch Processor

Implement idempotent, restartable batch processing.

**Files:**
- Create: `platform/migration/loader/batch.go`
- Create: `platform/migration/loader/batch_test.go`
- Create: `platform/migration/db/batch.go`

**Step 1: Define batch operations**

```go
// CreateBatch creates a new PENDING batch
func CreateBatch(db *sql.DB, engagementID, scope, mappingVersion string) (*Batch, error)

// ExecuteBatch runs transformation + load for a batch
func ExecuteBatch(db *sql.DB, batch *Batch, sourceDB *sql.DB, pipeline *Pipeline, mappings []FieldMapping, thresholds ErrorThresholds) error

// ResumeBatch restarts from checkpoint
func ResumeBatch(db *sql.DB, batch *Batch, sourceDB *sql.DB, pipeline *Pipeline, mappings []FieldMapping, thresholds ErrorThresholds) error
```

**Step 2: Implement ExecuteBatch**

```
1. Update batch status: PENDING -> RUNNING
2. Begin transaction
3. If re-run: DELETE existing lineage + canonical rows for this batch
4. For each source row in batch scope:
   a. Run transformation pipeline
   b. If exceptions exceed threshold -> HALT, set batch.halted_reason
   c. Write canonical row
   d. Write lineage entry
   e. Update checkpoint_key
5. Commit transaction
6. Update batch: row_count_loaded, row_count_exception, error_rate
7. Update status: RUNNING -> LOADED
```

**Step 3: Implement error thresholds**

```go
type ErrorThresholds struct {
    HardErrorHaltPct       float64 // default 0.05
    SoftWarningMaxPct      float64 // default 0.15
    RetireeErrorTolerance  int     // default 0
    FinancialBalanceTol    string  // default "0.01" (Decimal)
}

func CheckThresholds(stats BatchStats, thresholds ErrorThresholds) (halt bool, reason string)
```

**Step 4: Write tests**

Test idempotency: run batch twice, verify same canonical output. Test checkpoint: simulate failure at row N, resume, verify complete.

**Step 5: Run tests**

```bash
cd platform/migration && go test ./loader/... -v
```

**Step 6: Commit**

```bash
git commit -m "[platform/migration] Add idempotent batch processor with thresholds"
```

---

### Task 15: Canonical Loader with Lineage

Write transformed rows to canonical schema with full lineage tracking.

**Files:**
- Create: `platform/migration/loader/canonical.go`
- Create: `platform/migration/loader/canonical_test.go`
- Create: `platform/migration/loader/lineage.go`
- Create: `platform/migration/loader/lineage_test.go`

**Step 1: Implement canonical writer**

```go
// WriteCanonicalRow inserts a single row into the canonical table
// Returns the generated canonical_id (UUID)
func WriteCanonicalRow(tx *sql.Tx, table string, row map[string]interface{}) (string, error)

// WriteBatchToCanonical writes all transformed rows for a batch
func WriteBatchToCanonical(tx *sql.Tx, results []TransformResult) (int, error)
```

Dynamic INSERT generation: build SQL from the mapping's canonical_table and canonical_column names. Use parameterized queries only.

**Step 2: Implement lineage writer**

```go
func WriteLineage(tx *sql.Tx, entry LineageEntry) error

type LineageEntry struct {
    BatchID         string
    SourceTable     string
    SourceID        string
    CanonicalTable  string
    CanonicalID     string
    MappingVersion  string
    ConfidenceLevel string // ACTUAL, DERIVED, ESTIMATED, ROLLED_UP
    Transformations []TransformAction // [{handler, input, output}]
}
```

**Step 3: Implement exception writer**

```go
func WriteException(tx *sql.Tx, entry ExceptionEntry) error
```

**Step 4: Write tests**

Use sqlmock to verify correct INSERT statements are generated for different canonical tables.

**Step 5: Commit**

```bash
git commit -m "[platform/migration] Add canonical loader with lineage and exception tracking"
```

---

### Task 16: Re-transformation via Lineage

When a mapping correction is approved, re-transform affected rows surgically.

**Files:**
- Create: `platform/migration/loader/retransform.go`
- Create: `platform/migration/loader/retransform_test.go`

**Step 1: Implement retransform**

```go
// Retransform identifies rows affected by a mapping change and re-processes them
func Retransform(db *sql.DB, sourceDB *sql.DB, correctionID string, pipeline *Pipeline, newMappings []FieldMapping) (*RetransformResult, error)
```

Steps:
1. Find the correction → get affected_mapping_id and mapping_version
2. Query lineage for all rows produced by the old mapping version + field
3. For each affected row: fetch source data, re-run transformation pipeline
4. Update canonical row with new values
5. Mark old lineage as superseded, write new lineage
6. Return count of rows re-transformed

**Step 2: Write tests**

Verify: after retransform, canonical row has new value, old lineage has superseded_by set, new lineage exists.

**Step 3: Wire to API**

`POST /api/v1/migration/batches/:id/retransform` triggers retransformation.

**Step 4: Commit**

```bash
git commit -m "[platform/migration] Add re-transformation via lineage for mapping corrections"
```

---

### Task 17: Code Table Discovery

Identify and manage code table value mappings.

**Files:**
- Create: `platform/migration/mapper/codetable.go`
- Create: `platform/migration/mapper/codetable_test.go`
- Create: `platform/migration/api/codetable_handlers.go`

**Step 1: Implement code table discovery**

```go
// DiscoverCodeColumns identifies columns with low cardinality that likely need value mapping
func DiscoverCodeColumns(db *sql.DB, table string, rowCount int) []CodeColumnCandidate

type CodeColumnCandidate struct {
    ColumnName    string   `json:"column_name"`
    Cardinality   int      `json:"cardinality"`
    DistinctValues []string `json:"distinct_values"` // up to 50
    LikelyDomain  string   `json:"likely_domain"`    // "status", "gender", "plan_type", etc.
}
```

Heuristic: columns with cardinality < 50 AND cardinality < (row_count * 0.01) are likely code columns.

**Step 2: Implement API endpoints**

- `GET /api/v1/migration/engagements/:id/code-mappings` — discovered code columns + existing mappings
- `PUT /api/v1/migration/engagements/:id/code-mappings/:id` — analyst maps source value → canonical value

**Step 3: Wire into transformation pipeline**

The `ResolveCode` handler uses code_mapping table to translate values during transformation. Unmapped code values → exception (INVALID_FORMAT).

**Step 4: Commit**

```bash
git commit -m "[platform/migration] Add code table discovery and mapping workflow"
```

---

### Task 18: Phase 2 End-to-End Verification

Load both PRISM and PAS source databases into canonical via the migration service.

**Files:**
- Create: `migration-simulation/tests/test_phase2_e2e.py` (oracle comparison)

**Step 1: Set up both source databases in Docker**

Ensure docker-compose includes PRISM source (existing) and PAS source (new container).

**Step 2: Run PRISM migration**

```bash
# Create engagement
curl -X POST http://localhost:8100/api/v1/migration/engagements \
  -d '{"source_system_name": "PRISM"}'

# Profile
curl -X POST http://localhost:8100/api/v1/migration/engagements/{id}/profile

# Generate mappings
curl -X POST http://localhost:8100/api/v1/migration/engagements/{id}/generate-mappings

# Create and execute batch
curl -X POST http://localhost:8100/api/v1/migration/engagements/{id}/batches \
  -d '{"scope": "full", "mapping_version": "v1.0"}'
curl -X POST http://localhost:8100/api/v1/migration/batches/{id}/execute
```

**Step 3: Run PAS migration (same steps)**

**Step 4: Compare Go-loaded canonical output vs Python oracle output**

The Python simulation loads PRISM data independently. Compare the canonical tables row-by-row:
- Row counts must match
- Key fields must match exactly
- Monetary fields must match to the penny

**Step 5: Verify zero canonical schema changes**

```bash
# Diff canonical schema before and after migration
pg_dump --schema-only canonical_schema > after.sql
diff before.sql after.sql  # must be empty
```

**Step 6: Verify exception handling**

All constraint violations should be in `migration.exception`, NOT silently dropped or schema-relaxed.

**Step 7: Commit**

```bash
git commit -m "[migration] Phase 2 E2E verification: both sources loaded to canonical"
```

---

## Phase 3: Reconciliation + Feedback

### Task 19: Tier 1 Reconciliation — Stored Calculations

Recompute benefits from stored legacy inputs and compare.

**Files:**
- Create: `platform/migration/reconciler/engine.go`
- Create: `platform/migration/reconciler/engine_test.go`
- Create: `platform/migration/reconciler/tier1.go`
- Create: `platform/migration/reconciler/tier1_test.go`
- Create: `platform/migration/reconciler/formula.go`
- Create: `platform/migration/reconciler/formula_test.go`

**Step 1: Implement benefit formula in Go**

Port `migration-simulation/reconciliation/formula.py` to Go using `math/big`:

```go
// formula.go
func CalcRetirementBenefit(yos, fas *big.Rat, ageAtRetirement int, params PlanParams) *big.Rat
func RecomputeFromStoredInputs(yosUsed, fasUsed *big.Rat, ageAtCalc int, planCode string) *big.Rat
```

**CRITICAL:** Follow the rounding specification exactly:
- All intermediate: full precision (big.Rat)
- Final benefit: round to 2 decimal places with HALF_UP
- Must match Python Decimal implementation to $0.00

**Step 2: Write formula tests using shared fixtures**

Create `platform/migration/reconciler/testdata/reconciliation_fixtures.yaml`:

```yaml
- name: "standard_retirement_65"
  inputs:
    yos: "25.0000"
    fas: "5500.00"
    age: 65
    plan_code: "DB_MAIN"
  expected:
    gross_benefit: "2291.67"  # 0.02 * 25 * 5500 / 12
    penalty: "0.00"
    final_benefit: "2291.67"

- name: "early_retirement_60"
  inputs:
    yos: "20.0000"
    fas: "4800.00"
    age: 60
    plan_code: "DB_MAIN"
  expected:
    gross_benefit: "1600.00"
    penalty: "0.30"           # min(5 * 0.06, 0.30) = 0.30
    final_benefit: "1120.00"  # 1600 * 0.70
```

Both Go and Python must produce exact matches on these fixtures.

**Step 3: Implement Tier 1 reconciler**

```go
// tier1.go
func ReconcileTier1(db *sql.DB, batchID string) ([]ReconciliationResult, error)
```

Steps:
1. Fetch stored legacy calculations (PRISM: PRISM_BENEFIT_CALC, PAS: legacy_calculation_snapshot)
2. For each stored calc, recompute using stored inputs
3. Compare recomputed vs legacy stored value
4. Compare recomputed vs canonical migrated value
5. Classify: MATCH (<=0.50), MINOR (<25.00), MAJOR (>=25.00), ERROR

**Step 4: Write tests**

**Step 5: Commit**

```bash
git commit -m "[platform/migration] Add Tier 1 reconciliation with benefit formula"
```

---

### Task 20: Tier 2 Reconciliation — Payment History

Reverse-engineer benefit from payment records when no stored calcs exist.

**Files:**
- Create: `platform/migration/reconciler/tier2.go`
- Create: `platform/migration/reconciler/tier2_test.go`

**Step 1: Implement payment-based reconciliation**

```go
func ReconcileTier2(db *sql.DB, batchID string) ([]ReconciliationResult, error)
```

Steps:
1. Find members with payment records but no stored benefit calculations
2. Extract gross_amount from most recent regular payment
3. Compare against canonical benefit_event.monthly_amount
4. Apply +/-2% tolerance (COLA timing, tax withholding variability)

**Step 2: Write tests**

**Step 3: Commit**

```bash
git commit -m "[platform/migration] Add Tier 2 reconciliation from payment history"
```

---

### Task 21: Tier 3 Reconciliation — Aggregate Validation

Statistical checks against plan-level benchmarks for active members.

**Files:**
- Create: `platform/migration/reconciler/tier3.go`
- Create: `platform/migration/reconciler/tier3_test.go`

**Step 1: Implement aggregate checks**

```go
func ReconcileTier3(db *sql.DB, batchID string, benchmarks PlanBenchmarks) ([]ReconciliationResult, error)

type PlanBenchmarks struct {
    AvgSalaryByYear    map[int]float64 // year -> expected avg salary
    TotalContributions float64
    MemberCountByStatus map[string]int
}
```

Checks:
- Average salary by employer/year: flag members >2 std deviations from mean
- Total contribution balance: source total vs canonical total (must match within $0.01)
- Service credit years vs employment segment span: flag >10% discrepancy
- Member count by status: source counts vs canonical counts

**Step 2: Write tests**

**Step 3: Commit**

```bash
git commit -m "[platform/migration] Add Tier 3 aggregate validation reconciliation"
```

---

### Task 22: Weighted Scoring Gate

Combine all three tiers into the weighted gate with P1/P2/P3 priority system.

**Files:**
- Create: `platform/migration/reconciler/scoring.go`
- Create: `platform/migration/reconciler/scoring_test.go`
- Create: `platform/migration/api/reconciliation_handlers.go`

**Step 1: Implement weighted scoring**

```go
type GateResult struct {
    WeightedScore    float64 `json:"weighted_score"`
    TotalMembers     int     `json:"total_members"`
    MatchCount       int     `json:"match_count"`
    MinorCount       int     `json:"minor_count"`
    MajorCount       int     `json:"major_count"`
    ErrorCount       int     `json:"error_count"`
    P1Unresolved     int     `json:"p1_unresolved"`
    P2Unresolved     int     `json:"p2_unresolved"`
    P3Count          int     `json:"p3_count"`
    GatePassed       bool    `json:"gate_passed"`
    GateFailReasons  []string `json:"gate_fail_reasons,omitempty"`
}

func ComputeGate(results []ReconciliationResult) GateResult
```

Gate formula:
```
weighted_score = (match_count * 1.0 + minor_count * 0.5) / (total_tier1 + total_tier2)
gate_passed = weighted_score >= 0.95 AND p1_unresolved == 0
```

Priority assignment:
- Retiree + any mismatch (even MINOR) → P1
- Any MAJOR → P1
- MINOR on active member → P2
- Tier 3 outlier → P3

**Step 2: Write thorough tests**

```go
func TestGate_PassesClean(t *testing.T) {
    // 100 MATCH, 0 mismatches -> gate passes
}
func TestGate_FailsOnP1(t *testing.T) {
    // 99 MATCH, 1 retiree MINOR -> gate fails (P1 unresolved)
}
func TestGate_FailsOnScore(t *testing.T) {
    // 90 MATCH, 10 MINOR -> weighted = 95/100 = 0.95 -> passes
    // 89 MATCH, 11 MINOR -> weighted = 94.5/100 = 0.945 -> fails
}
```

**Step 3: Wire to API**

- `POST /api/v1/migration/batches/:id/reconcile` — run all tiers, compute gate
- `GET /api/v1/migration/engagements/:id/reconciliation` — engagement-wide dashboard
- `GET /api/v1/migration/engagements/:id/reconciliation/p1` — P1 items only

**Step 4: Commit**

```bash
git commit -m "[platform/migration] Add weighted reconciliation gate with P1/P2/P3 priority"
```

---

### Task 23: Python Mismatch Analysis + Correction Suggestions

Build the intelligence service's ability to detect systematic patterns and suggest corrections.

**Files:**
- Create: `migration-intelligence/reconciliation/__init__.py`
- Create: `migration-intelligence/reconciliation/analysis.py`
- Create: `migration-intelligence/reconciliation/corrections.py`
- Create: `migration-intelligence/tests/test_analysis.py`

**Step 1: Implement systematic pattern detection**

```python
def detect_systematic_patterns(results: list[ReconciliationResult]) -> list[Pattern]:
    """
    Group mismatches by suspected_domain and direction.
    A pattern is 'systematic' if:
    - >= 5 members affected
    - All variances in same direction (all positive or all negative)
    - Coefficient of variation < 0.3 (tight cluster)
    """
```

**Step 2: Implement correction suggestion**

```python
def suggest_corrections(patterns: list[Pattern], mappings: list[FieldMapping]) -> list[Correction]:
    """
    For each systematic pattern, identify the likely mapping error.
    Correlate pattern's suspected_domain with mapping fields in that domain.
    """
```

**Step 3: Wire to /intelligence/analyze-mismatches endpoint**

**Step 4: Write tests with known systematic patterns**

```python
def test_detects_salary_mapping_error():
    """All DB_T2 members have +1.8% FAS variance -> suggests salary mapping fix"""
    results = [ReconciliationResult(
        member_id=f"m{i}", variance_amount=Decimal("86.40"),
        suspected_domain="salary", systematic_flag=True,
    ) for i in range(20)]
    patterns = detect_systematic_patterns(results)
    assert len(patterns) == 1
    assert patterns[0].direction == "positive"
```

**Step 5: Commit**

```bash
git commit -m "[migration-intelligence] Add mismatch pattern detection and correction suggestions"
```

---

### Task 24: Corpus Abstraction + Shared Model

Implement the de-identification layer and shared corpus for cross-client learning.

**Files:**
- Modify: `migration-intelligence/corpus/store.py`
- Modify: `migration-intelligence/corpus/abstractor.py`
- Create: `migration-intelligence/corpus/anonymizer.py`
- Create: `migration-intelligence/tests/test_corpus.py`
- Create: `migration-intelligence/tests/test_anonymizer.py`

**Step 1: Implement tenant-isolated decision storage**

```python
# corpus/store.py
class DecisionStore:
    def record_decision(self, tenant_id: str, decision: AnalystDecision) -> None:
        """Store full decision context in tenant-isolated table"""

    def get_decisions(self, tenant_id: str) -> list[AnalystDecision]:
        """Query only this tenant's decisions"""
```

**Step 2: Implement feature abstraction**

```python
# corpus/abstractor.py
class FeatureAbstractor:
    def abstract(self, decision: AnalystDecision) -> CorpusEntry:
        """
        Extract statistical features, discard all identifying information.
        Returns a CorpusEntry with NO tenant_id, NO column names, NO sample values.
        """
```

**Step 3: Implement k-anonymity quantization**

```python
# corpus/anonymizer.py
def quantize_null_rate(rate: float) -> float:
    """Round to nearest 0.05"""
    return round(rate * 20) / 20

def quantize_cardinality(cardinality: int, row_count: int) -> str:
    """Bucket into LOW/MEDIUM/HIGH/UNIQUE"""
    ratio = cardinality / max(row_count, 1)
    if ratio > 0.95: return "UNIQUE"
    if ratio > 0.5: return "HIGH"
    if ratio > 0.1: return "MEDIUM"
    return "LOW"
```

**Step 4: Write tests verifying no identifying information leaks**

```python
def test_abstraction_removes_identifiers():
    decision = AnalystDecision(
        tenant_id="client-abc",
        source_table="PRISM_SAL_HIST",
        source_column="SAL_AMT",
        # ...
    )
    entry = FeatureAbstractor().abstract(decision)
    # Assert NO field contains "client-abc", "PRISM", "SAL_AMT"
    assert "client-abc" not in str(entry)
    assert "PRISM" not in str(entry)
    assert "SAL_AMT" not in str(entry)
```

**Step 5: Wire to /intelligence/record-decision endpoint**

**Step 6: Commit**

```bash
git commit -m "[migration-intelligence] Add corpus abstraction with k-anonymity"
```

---

### Task 25: Cross-Language Verification Fixtures

Create shared test fixtures that both Go and Python must match exactly.

**Files:**
- Create: `migration-simulation/fixtures/reconciliation_fixtures.yaml`
- Create: `migration-simulation/tests/test_cross_language.py`
- Modify: `platform/migration/reconciler/formula_test.go` (use shared fixtures)

**Step 1: Create shared YAML fixture file**

```yaml
# fixtures/reconciliation_fixtures.yaml
# Both Go (big.Rat) and Python (Decimal) must produce EXACT matches
test_cases:
  - name: standard_retirement_65_tier1
    inputs:
      yos: "25.0000"
      fas: "5500.00"
      age_at_retirement: 65
      plan_code: "DB_MAIN"
      multiplier: "0.02"
      fas_period_months: 60
      ery_penalty_rate: "0.06"
      max_penalty: "0.30"
      normal_retirement_age: 65
    expected:
      gross_monthly: "2291.67"
      penalty_pct: "0.00"
      final_monthly: "2291.67"

  - name: early_retirement_60_tier1
    inputs:
      yos: "20.0000"
      fas: "4800.00"
      age_at_retirement: 60
      plan_code: "DB_MAIN"
      multiplier: "0.02"
      fas_period_months: 60
      ery_penalty_rate: "0.06"
      max_penalty: "0.30"
      normal_retirement_age: 65
    expected:
      gross_monthly: "1600.00"
      penalty_pct: "0.30"
      final_monthly: "1120.00"

  - name: penalty_cap_at_30pct
    inputs:
      yos: "15.0000"
      fas: "4000.00"
      age_at_retirement: 55
      plan_code: "DB_MAIN"
      multiplier: "0.02"
      fas_period_months: 60
      ery_penalty_rate: "0.06"
      max_penalty: "0.30"
      normal_retirement_age: 65
    expected:
      gross_monthly: "1000.00"
      penalty_pct: "0.30"    # 10 * 0.06 = 0.60, capped at 0.30
      final_monthly: "700.00"

  - name: benefit_floor_800
    inputs:
      yos: "5.0000"
      fas: "2000.00"
      age_at_retirement: 65
      plan_code: "DB_MAIN"
      multiplier: "0.02"
      fas_period_months: 60
      ery_penalty_rate: "0.06"
      max_penalty: "0.30"
      normal_retirement_age: 65
    expected:
      gross_monthly: "166.67"
      penalty_pct: "0.00"
      final_monthly: "800.00"  # floor

  - name: tier2_lower_multiplier
    inputs:
      yos: "25.0000"
      fas: "5500.00"
      age_at_retirement: 65
      plan_code: "DB_T2"
      multiplier: "0.018"
      fas_period_months: 36
      ery_penalty_rate: "0.06"
      max_penalty: "0.30"
      normal_retirement_age: 65
    expected:
      gross_monthly: "2062.50"
      penalty_pct: "0.00"
      final_monthly: "2062.50"
```

**Step 2: Write Python test that loads fixtures**

```python
def test_go_python_agreement():
    fixtures = yaml.safe_load(open("fixtures/reconciliation_fixtures.yaml"))
    for case in fixtures["test_cases"]:
        result = calc_retirement_benefit(...)
        assert result == Decimal(case["expected"]["final_monthly"]), \
            f"Python disagrees on {case['name']}"
```

**Step 3: Write Go test that loads the same fixtures**

```go
func TestCrossLanguageFixtures(t *testing.T) {
    fixtures := loadYAMLFixtures("../../migration-simulation/fixtures/reconciliation_fixtures.yaml")
    for _, tc := range fixtures.TestCases {
        result := CalcRetirementBenefit(...)
        expected := parseDecimal(tc.Expected.FinalMonthly)
        if result.Cmp(expected) != 0 {
            t.Errorf("Go disagrees on %s: got %s, want %s", tc.Name, result, expected)
        }
    }
}
```

**Step 4: Both test suites must pass with $0.00 variance**

```bash
cd platform/migration && go test ./reconciler/... -v -run TestCrossLanguage
cd migration-simulation && pytest tests/test_cross_language.py -v
```

**Step 5: Commit**

```bash
git commit -m "[migration] Add shared cross-language reconciliation fixtures"
```

---

### Task 26: Two-Source Proof — End-to-End Verification

The milestone gate. Both PRISM and PAS migrated to canonical, reconciled, gate passed.

**Files:**
- Create: `migration-simulation/tests/test_two_source_proof.py`
- Create: `scripts/run_two_source_proof.sh`

**Step 1: Write the proof script**

```bash
#!/bin/bash
# scripts/run_two_source_proof.sh
set -e

echo "=== TWO-SOURCE PROOF ==="

# 1. Start all services
docker compose up -d --build

# 2. Wait for health
for svc in migration migration-intelligence; do
  until curl -sf http://localhost:${PORT}/healthz; do sleep 1; done
done

# 3. Run PRISM migration
PRISM_ENG=$(curl -s -X POST .../engagements -d '{"source_system_name":"PRISM"}' | jq -r .engagement_id)
curl -X POST .../engagements/$PRISM_ENG/profile
curl -X POST .../engagements/$PRISM_ENG/generate-mappings
# ... approve mappings, execute batch, reconcile

# 4. Run PAS migration (same flow)

# 5. Check gates
PRISM_GATE=$(curl -s .../engagements/$PRISM_ENG/reports/gate)
PAS_GATE=$(curl -s .../engagements/$PAS_ENG/reports/gate)

# 6. Run cross-language verification
cd platform/migration && go test ./reconciler/... -run TestCrossLanguage
cd migration-simulation && pytest tests/test_cross_language.py

# 7. Verify schema integrity
# ... diff canonical schema before/after

echo "=== RESULTS ==="
echo "PRISM gate: $(echo $PRISM_GATE | jq .gate_passed)"
echo "PAS gate: $(echo $PAS_GATE | jq .gate_passed)"
```

**Step 2: Run the proof**

Execute the script. Both gates must pass:
- PRISM: weighted_score >= 0.95, p1_unresolved == 0
- PAS: weighted_score >= 0.95, p1_unresolved == 0
- Cross-language: $0.00 variance on all fixtures
- Schema: zero changes to canonical DDL

**Step 3: Document results**

Write results to `docs/plans/2026-XX-XX-two-source-proof-results.md`:
- PRISM: X members, Y% weighted match, Z exceptions
- PAS: X members, Y% weighted match, Z exceptions
- Corpus: N entries seeded from both sources
- Schema: confirmed unchanged

**Step 4: Commit**

```bash
git commit -m "[migration] Two-source proof milestone achieved"
```

---

## Task Summary

| Phase | Task | Description | Dependencies |
|-------|------|-------------|--------------|
| 1 | 1 | Fix PAS schema mismatches | None |
| 1 | 2 | Migration schema DDL | None |
| 1 | 3 | Go service skeleton | None |
| 1 | 4 | Engagement CRUD API | Task 2, 3 |
| 1 | 5 | Template registry | Task 3 |
| 1 | 6 | Template matcher | Task 5 |
| 1 | 7 | Python intelligence skeleton | None |
| 1 | 8 | Signal scorer | Task 7 |
| 1 | 9 | Agreement analysis | Task 6, 8 |
| 1 | 10 | ISO 8000 quality profiler | Task 3 |
| 1 | 11 | Generate mappings endpoint | Task 4, 9, 10 |
| 1 | 12 | Docker integration | Task 3, 7 |
| 2 | 13 | Transformation pipeline | Task 11 |
| 2 | 14 | Batch processor | Task 13 |
| 2 | 15 | Canonical loader + lineage | Task 14 |
| 2 | 16 | Re-transformation | Task 15 |
| 2 | 17 | Code table discovery | Task 13 |
| 2 | 18 | Phase 2 E2E verification | Task 15, 16, 17 |
| 3 | 19 | Tier 1 reconciliation | Task 15 |
| 3 | 20 | Tier 2 reconciliation | Task 19 |
| 3 | 21 | Tier 3 reconciliation | Task 19 |
| 3 | 22 | Weighted scoring gate | Task 19, 20, 21 |
| 3 | 23 | Mismatch analysis + corrections | Task 22 |
| 3 | 24 | Corpus abstraction | Task 8 |
| 3 | 25 | Cross-language fixtures | Task 19 |
| 3 | 26 | Two-source proof E2E | All above |

**Parallelizable work:** Tasks 1-3 and 7 can run in parallel (no dependencies). Tasks 5+10 can parallel with 7+8. Task 24 can parallel with 19-22.

---

## Revert Checklist

Before starting Phase 2, revert the canonical schema changes made during simulation:
- [ ] `service_credit.as_of_date` back to NOT NULL
- [ ] `service_credit.credited_years_total` back to NOT NULL
- [ ] `contribution.ee_amount` back to NOT NULL
- [ ] `reconciliation_result.batch_id` back to NOT NULL

These should be handled by the exception system, not schema relaxation.
