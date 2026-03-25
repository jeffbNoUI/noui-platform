# Migration Service Overhaul — Target-Anchored Profiling & Mapping at Scale

## Context

The migration service needs a fundamental redesign, not just a scale fix. Two problems converge:

1. **Scale:** Current architecture collapses at 1000+ tables / 100M+ rows (synchronous HTTP, no pagination, full table scans)
2. **Model:** Current profiling produces generic quality scores. The spec requires **target-anchored profiling** where every output is expressed relative to the 9-entity canonical schema — "can source column X satisfy canonical field Y?"

The research documents (`NOUI-DATA-PROFILING-CONTEXT.md`, `CLAUDE-RECONCILIATION.md`) define the target architecture. This plan bridges from the current code to that vision.

**Design principles:**
- API server = control plane (state, UI, job dispatch). Conversion servers = data plane (source DB access, profiling, transformation)
- The primary profiling deliverable is a **canonical coverage report**, not a quality score
- **AI proposes, humans dispose** — AI handles 70-80% of cognitive load at every level; RE reviews and approves. AI outputs are always tagged with confidence and source. Nothing AI-generated auto-advances without human review.
- Every Rules Engineer decision feeds back into a **cross-engagement mapping library** that improves future proposals
- The job system must be generic enough for profiling, mapping, AND reconciliation workloads
- **Failure on conversion is not acceptable** — every AI-generated proposal must be reviewable, every transformation must be auditable, every mapping must be traceable back to its source. The system shows its work.

---

## Part 1: Job System (Unchanged from Prior Review — Proven Sound)

PostgreSQL `SKIP LOCKED` job queue. Workers run on conversion servers (standalone binary) or embedded in the API process (dev mode). Self-contained `input_json` with engagement reference (NOT credentials — worker looks up source connection from engagement record via migration DB access).

### Migration 042: `migration.job` table

```sql
CREATE TABLE migration.job (
    job_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id  UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    job_type       TEXT NOT NULL,       -- 'profile_l1', 'profile_l2', 'profile_l3', 'profile_l4',
                                        -- 'profile_l5', 'generate_mappings', 'discover_tables',
                                        -- 'reconciliation_run'
    scope          TEXT NOT NULL,       -- table name, canonical entity, run_id, etc.
    status         TEXT NOT NULL DEFAULT 'PENDING',
    priority       INT NOT NULL DEFAULT 0,
    progress       INT NOT NULL DEFAULT 0,
    input_json     JSONB NOT NULL,      -- job config (NO credentials — worker resolves from engagement)
    result_json    JSONB,
    error_message  TEXT,
    worker_id      TEXT,
    attempt        INT NOT NULL DEFAULT 0,
    max_attempts   INT NOT NULL DEFAULT 3,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at     TIMESTAMPTZ,
    heartbeat_at   TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ
);
CREATE INDEX idx_job_poll ON migration.job(status, priority DESC, created_at)
    WHERE status = 'PENDING';
CREATE INDEX idx_job_engagement ON migration.job(engagement_id, job_type);
CREATE INDEX idx_job_stale ON migration.job(heartbeat_at)
    WHERE status IN ('CLAIMED', 'RUNNING');
```

**Security fix:** `input_json` contains engagement_id + job-specific config (table name, level, canonical entity). The worker resolves the source connection by querying `migration.engagement.source_connection` directly — it already has migration DB access for job polling. No credential duplication.

### Worker Architecture (Dual-Mode)

- **Standalone:** `cmd/migration-worker/main.go` — deployed to conversion servers
- **Embedded:** `main.go --embedded-worker` — runs worker goroutines inside API process for dev
- Both poll SKIP LOCKED, heartbeat every 30s, stale recovery after 5 min

### Files

| New File | Purpose |
|----------|---------|
| `platform/migration/jobqueue/queue.go` | Enqueue, claim, heartbeat, complete, fail, cancel |
| `platform/migration/jobqueue/queue_test.go` | Tests |
| `platform/migration/cmd/migration-worker/main.go` | Standalone worker binary |
| `platform/migration/worker/worker.go` | Poll loop, dispatch, heartbeat |
| `platform/migration/worker/executors.go` | Job type → executor dispatch |
| `platform/migration/api/job_handlers.go` | Job CRUD API (list, get, cancel, worker health) |
| `db/migrations/042_job_table.sql` | DDL |

| Modified File | Changes |
|----------------|---------|
| `platform/migration/api/handlers.go` | Register job routes, add JobQueue to Handler |
| `platform/migration/main.go` | Init job queue, `--embedded-worker` flag, stale recovery goroutine |

---

## Part 2: 5-Level Profiling Model

Replace the current 6-dimension ISO 8000 quality profiler with a 5-level progressive system where the canonical coverage report (Level 4) is the primary deliverable.

### Profiling Run Model

Each engagement has profiling RUNS. Each run progresses through levels. Levels gate each other.

```
INITIATED → RUNNING_L1 → RUNNING_L2 → RUNNING_L3 → RUNNING_L4 → RUNNING_L5
                                                                        ↓
                                                              COVERAGE_REPORT_READY
                                                                        ↓
                                                            MAPPER_PRE_POPULATED
                                                                        ↓
                                                               RULES_ENGINEER_REVIEW
```

### Migration 043: Profiling Run & Source Inventory (Level 1)

```sql
-- Profiling run record
CREATE TABLE migration.profiling_run (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id          UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    source_platform        TEXT NOT NULL,    -- 'postgres', 'mssql', 'ibm_i_db2'
    initiated_by           TEXT NOT NULL,    -- user ID from JWT sub claim
    status                 TEXT NOT NULL DEFAULT 'INITIATED',
    level_reached          INT,             -- highest completed level (1-5)
    -- Summary metrics (populated after Level 4)
    total_source_columns   INT,
    total_canonical_fields INT,
    auto_mapped_count      INT,             -- confidence >= 0.85
    review_required_count  INT,             -- 0.50-0.84
    unmapped_count         INT,             -- < 0.50
    overall_coverage_pct   NUMERIC(5,2),
    rule_signals_found     INT,
    readiness_assessment   TEXT,            -- PROCEED_AUTO | PROCEED_WITH_REVIEW | MAPPER_EFFORT_REQUIRED | BLOCKER_ASSESSMENT
    error_message          TEXT,
    initiated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at           TIMESTAMPTZ
);

-- Level 1: Source table inventory
CREATE TABLE migration.source_table (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profiling_run_id  UUID NOT NULL REFERENCES migration.profiling_run(id),
    schema_name       TEXT,
    table_name        TEXT NOT NULL,
    row_count         BIGINT,
    row_count_exact   BOOLEAN DEFAULT false,  -- true = COUNT(*), false = catalog estimate
    entity_class      TEXT,                   -- concept tag: 'employee-master', 'salary-history', etc.
    class_confidence  NUMERIC(4,3),
    is_likely_lookup  BOOLEAN DEFAULT false,
    is_likely_archive BOOLEAN DEFAULT false,
    profile_status    TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | L1_DONE | L2_DONE | L3_DONE | L4_DONE | L5_DONE | SKIPPED | FAILED
    notes             TEXT,
    UNIQUE(profiling_run_id, schema_name, table_name)
);

-- Level 1-2: Source column inventory + statistics
CREATE TABLE migration.source_column (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table_id   UUID NOT NULL REFERENCES migration.source_table(id),
    column_name       TEXT NOT NULL,
    ordinal_position  INT,
    data_type         TEXT NOT NULL,
    max_length        INT,
    is_nullable       BOOLEAN NOT NULL,
    is_primary_key    BOOLEAN DEFAULT false,
    is_unique         BOOLEAN DEFAULT false,
    -- Level 2 stats
    row_count         BIGINT,
    null_count        BIGINT,
    null_pct          NUMERIC(5,2),
    distinct_count    BIGINT,
    distinct_pct      NUMERIC(5,2),
    min_value         TEXT,
    max_value         TEXT,
    mean_value        NUMERIC,
    stddev_value      NUMERIC,
    top_values        JSONB,             -- [{value, count, pct}] top 20
    pattern_frequencies JSONB,           -- [{pattern, count, pct}] pension-specific patterns
    sample_values     JSONB,             -- 10 random non-null values
    sample_size       BIGINT,            -- how many rows were sampled (null = exact/full scan)
    is_sampled        BOOLEAN DEFAULT false,  -- true if stats from TABLESAMPLE, false if full scan
    UNIQUE(source_table_id, column_name)
);
CREATE INDEX idx_src_col_table ON migration.source_column(source_table_id);
```

### Migration 044: Dependency Findings (Level 3)

```sql
CREATE TABLE migration.dependency_finding (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profiling_run_id  UUID NOT NULL REFERENCES migration.profiling_run(id),
    finding_type      TEXT NOT NULL,      -- FUNCTIONAL_DEPENDENCY | FK_CANDIDATE | CONDITIONAL_NULL | COMPOSITE_KEY
    source_table_id   UUID REFERENCES migration.source_table(id),
    source_column_ids UUID[],
    target_table_id   UUID REFERENCES migration.source_table(id),
    target_column_ids UUID[],
    confidence        NUMERIC(4,3),
    description       TEXT NOT NULL,
    rule_signal       BOOLEAN DEFAULT false
);
```

### Migration 045: Canonical Coverage Report (Level 4 — PRIMARY DELIVERABLE)

```sql
-- Canonical schema definition — authoritative list of every field in the 9-entity model.
-- Level 4 iterates this table to ensure EVERY canonical field gets a coverage entry.
-- Seeded from domains/pension/schema/ definitions. One row per field.
CREATE TABLE migration.canonical_schema_field (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity            TEXT NOT NULL,        -- 'member', 'employment_record', etc.
    field_name        TEXT NOT NULL,
    data_type         TEXT NOT NULL,        -- expected canonical data type
    is_required       BOOLEAN NOT NULL,
    description       TEXT,
    schema_version    TEXT NOT NULL DEFAULT 'v1.0',
    UNIQUE(entity, field_name, schema_version)
);

CREATE TABLE migration.canonical_coverage_entry (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profiling_run_id         UUID NOT NULL REFERENCES migration.profiling_run(id),
    -- Canonical target (references canonical_schema_field)
    canonical_entity         TEXT NOT NULL,
    canonical_field          TEXT NOT NULL,
    canonical_type           TEXT NOT NULL,
    canonical_required       BOOLEAN NOT NULL,
    -- Coverage result
    coverage_status          TEXT NOT NULL,    -- AUTO_MAPPED | REVIEW_REQUIRED | MULTI_CANDIDATE | DERIVATION_REQUIRED | LEGACY_OPAQUE | MISSING_REQUIRED
    best_candidate_column_id UUID REFERENCES migration.source_column(id),
    confidence               NUMERIC(4,3),
    -- Mapping type uses the 7-type enum from transformation spec:
    -- DIRECT | TRANSFORM | SPLIT | MERGE | DERIVE | DISCARD | LEGACY_OPAQUE
    mapping_type             TEXT,
    hard_case_type           TEXT,             -- HC-1 through HC-5, nullable
    transformation_notes     TEXT,
    all_candidates           JSONB,            -- [{column_id, table_name, column_name, confidence, reason}]
    library_source           BOOLEAN DEFAULT false,
    library_validation_count INT,
    -- Rules Engineer review
    review_status            TEXT DEFAULT 'PENDING', -- PENDING | ACCEPTED | REJECTED | OVERRIDDEN
    review_notes             TEXT,
    reviewed_by              TEXT,
    reviewed_at              TIMESTAMPTZ,
    -- Link to mapper
    mapper_entry_id          UUID,             -- FK to field_mapping once pre-populated
    UNIQUE(profiling_run_id, canonical_entity, canonical_field)
);
CREATE INDEX idx_coverage_run ON migration.canonical_coverage_entry(profiling_run_id, coverage_status);
```

**INVARIANT:** Level 4 must produce exactly one `canonical_coverage_entry` per row in `canonical_schema_field` for the engagement's schema version. If no source candidate exists, the entry is created with `coverage_status = 'MISSING_REQUIRED'` (if required) or `coverage_status = 'UNMAPPED'` (if optional). No canonical field may be skipped.

### Migration 046: Rule Signal Findings (Level 5)

```sql
CREATE TABLE migration.rule_signal_finding (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profiling_run_id  UUID NOT NULL REFERENCES migration.profiling_run(id),
    source_column_id  UUID NOT NULL REFERENCES migration.source_column(id),
    signal_type       TEXT NOT NULL,    -- TEMPORAL_BOUNDARY | CALCULATION_ENCODING | ELIGIBILITY_GATE | CODE_EMBEDDED_MEANING | REFERENCE_TABLE
    description       TEXT NOT NULL,
    supporting_evidence JSONB,
    extraction_priority TEXT NOT NULL DEFAULT 'NORMAL',
    ai_extraction_queued BOOLEAN DEFAULT false
);
```

### Migration 047: Cross-Engagement Mapping Library

```sql
CREATE TABLE migration.mapping_library_entry (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_platform           TEXT NOT NULL,
    source_column_pattern     TEXT NOT NULL,    -- normalized pattern: 'EMPLOYMENT_STATUS'
    source_type_pattern       TEXT NOT NULL,    -- 'CHAR(1)', 'VARCHAR', etc.
    canonical_entity          TEXT NOT NULL,
    canonical_field           TEXT NOT NULL,
    mapping_type              TEXT NOT NULL,
    transformation_template   TEXT,             -- parameterized transformation
    -- Confidence accumulation
    confidence                NUMERIC(4,3) NOT NULL DEFAULT 0,
    validation_count          INT NOT NULL DEFAULT 0,
    acceptance_count          INT NOT NULL DEFAULT 0,
    rejection_count           INT NOT NULL DEFAULT 0,
    -- Lifecycle
    status                    TEXT NOT NULL DEFAULT 'CANDIDATE',  -- CANDIDATE | ACTIVE | DEPRECATED
    tenant_contribution_count INT NOT NULL DEFAULT 0,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_validated_at         TIMESTAMPTZ,
    UNIQUE(source_platform, source_column_pattern, source_type_pattern, canonical_entity, canonical_field)
);
CREATE INDEX idx_mapping_lib_platform ON migration.mapping_library_entry(source_platform, status);
CREATE INDEX idx_mapping_lib_canonical ON migration.mapping_library_entry(canonical_entity, canonical_field, status);
```

**Library lifecycle:**
- `CANDIDATE`: < 3 validations or confidence < 0.85
- `ACTIVE`: confidence ≥ 0.85 AND validation_count ≥ 3 — used to boost Level 4 scoring
- `DEPRECATED`: rejection_count / validation_count > 0.30

**Library-boosted scoring (Level 4):**
```
final_confidence = structural_confidence × 0.6 + library_confidence × 0.4
```
(Only when library entry is ACTIVE. Otherwise, pure structural scoring.)

### Pension-Specific Pattern Detectors

Implement as named regex detectors in the Level 2 profiling pass:

```go
var PensionPatterns = map[string]*regexp.Regexp{
    "CYYMMDD":       regexp.MustCompile(`^\d{7}$`),          // AS400 date
    "YYYYMMDD":      regexp.MustCompile(`^\d{8}$`),          // ISO date as integer
    "IMPLICIT_2DEC": regexp.MustCompile(`^\d{5,12}$`),       // Amounts stored as integer cents
    "PCT_WHOLE":     regexp.MustCompile(`^\d{1,3}$`),        // Percentage as whole number
    "TIER_CODE":     regexp.MustCompile(`^[A-Z0-9]{1,4}$`),  // Plan tier designation
    "STATUS_CODE":   regexp.MustCompile(`^[A-Z]{1,2}$`),     // Status codes
    "MEMBER_NUM":    regexp.MustCompile(`^[A-Z]?\d{6,10}$`), // Member number
    "SSN":           regexp.MustCompile(`^\d{9}$`),           // SSN without dashes
    "FISCAL_YEAR":   regexp.MustCompile(`^(19|20)\d{2}$`),   // 4-digit fiscal year
}
```

### Sampling Strategy (Scale Fix)

- Level 1 (inventory): catalog-based row estimates (`pg_class.reltuples` / `sys.dm_db_partition_stats`). Exact COUNT only for tables < 1M estimated rows.
- Level 2 (column stats): `TABLESAMPLE BERNOULLI(1) REPEATABLE(42)` for PostgreSQL tables > 1M rows. For MSSQL: `TABLESAMPLE SYSTEM(1 PERCENT)` with fallback to `TOP(N)` if sample returns too few rows.
- Level 3 (dependencies): operates on Level 2 stats, not raw data — fast regardless of table size.
- Level 4 (coverage): operates on Level 1-2 results + template matching + library lookup — no source DB queries.
- Level 5 (rule signals): operates on Level 2 stats — no additional source queries.

### Worker Job Types for Profiling

Each level dispatches jobs at the appropriate granularity:

| Job Type | Scope | Source DB Access? | Dependencies |
|----------|-------|-------------------|--------------|
| `profile_l1` | Per source table | Yes (schema + row count) | None |
| `profile_l2` | Per source table | Yes (column stats, patterns, samples) | L1 complete for that table |
| `profile_l3` | Per profiling run | No (reads L2 results from DB) | All L2 complete |
| `profile_l4` | Per canonical entity | No (reads L1-L2 + templates + library) | L3 complete |
| `profile_l5` | Per profiling run | No (reads L2 stats) | L4 complete |

**Level 1 and Level 2 are the heavy jobs** (source DB access, potentially slow). Levels 3-5 are computation on stored results — fast, no source access needed, can run on the API server.

### Job Orchestration Model

**Worker chaining:** When a job completes, the worker enqueues the next-level jobs for the same scope. This avoids a separate orchestrator:

```
1. API enqueues: 1 "profile_orchestrate" job for the run
2. Orchestrate job:
   a. Discovers all source tables (L1 work)
   b. Creates source_table rows
   c. Enqueues N "profile_l1" jobs (one per table)
   d. Enqueues 1 "profile_gate_l1" job (depends on all L1 jobs)
3. Each profile_l1 job:
   - Discovers columns, estimates row count
   - On completion: enqueues 1 "profile_l2" job for same table
4. profile_gate_l1 job:
   - Polls until all L1 jobs for this run are COMPLETE
   - Updates profiling_run.status = RUNNING_L2
5. Each profile_l2 job:
   - Computes column stats, patterns, samples
   - On completion: marks source_table.profile_status = L2_DONE
6. After all L2 complete → gate job triggers L3, L4, L5 in sequence
   (L3-L5 are fast, single-job-per-run, no parallelism needed)
```

**Throttling:** L1/L2 jobs use `priority` to process smaller tables first (higher priority = lower row estimate). This gives quick visual progress. With `--concurrency=4`, at most 4 source DB queries run simultaneously.

**Cancellation:** Workers check `job.status` in the migration DB every 30s (alongside heartbeat). If status has been changed to `CANCELLED` by the API, the worker aborts the current operation via Go context cancellation.

### Job Retention

Completed/failed jobs are retained for 30 days, then purged by a background cleanup goroutine. Failed jobs are preserved indefinitely until manually cleared (needed for debugging).

### Files

| New File | Purpose |
|----------|---------|
| `db/migrations/043_profiling_run.sql` | Profiling run + source inventory DDL |
| `db/migrations/044_dependency_findings.sql` | Level 3 DDL |
| `db/migrations/045_canonical_coverage.sql` | Level 4 DDL |
| `db/migrations/046_rule_signals.sql` | Level 5 DDL |
| `db/migrations/047_mapping_library.sql` | Cross-engagement library DDL |
| `platform/migration/profiler/levels.go` | Level dispatcher + gating logic |
| `platform/migration/profiler/level1_inventory.go` | Table + column discovery |
| `platform/migration/profiler/level2_statistics.go` | Column stats + pension patterns |
| `platform/migration/profiler/level3_dependencies.go` | FK candidates, functional deps |
| `platform/migration/profiler/level4_coverage.go` | Canonical coverage scoring |
| `platform/migration/profiler/level5_signals.go` | Rule signal detection |
| `platform/migration/profiler/pension_patterns.go` | Named regex pension detectors |
| `platform/migration/profiler/sampling.go` | Driver-aware sampling strategy |
| `platform/migration/mapper/library.go` | Mapping library CRUD + lookup + feedback |
| `platform/migration/mapper/library_test.go` | Library confidence accumulation tests |
| `platform/migration/mapper/column_normalizer.go` | Column name → pattern normalization |
| `platform/migration/worker/profile_l1_executor.go` | L1 job executor |
| `platform/migration/worker/profile_l2_executor.go` | L2 job executor |
| `platform/migration/worker/coverage_executor.go` | L4 job executor |
| `platform/migration/api/profiling_handlers.go` | Profiling run API (see endpoints below) |
| `platform/migration/api/coverage_handlers.go` | Coverage report + RE review (see endpoints below) |
| `platform/migration/api/library_handlers.go` | Mapping library API (see endpoints below) |

### Profiling API Endpoints

```
POST   /api/v1/migration/engagements/{id}/profiling-runs         -- initiate a profiling run
GET    /api/v1/migration/engagements/{id}/profiling-runs         -- list runs for engagement
GET    /api/v1/migration/profiling-runs/{run_id}                 -- run status + summary metrics
GET    /api/v1/migration/profiling-runs/{run_id}/inventory       -- L1+L2: tables + columns with stats
GET    /api/v1/migration/profiling-runs/{run_id}/dependencies    -- L3: dependency findings
GET    /api/v1/migration/profiling-runs/{run_id}/coverage        -- L4: coverage entries (paginated)
GET    /api/v1/migration/profiling-runs/{run_id}/coverage/summary -- L4: aggregate counts + readiness
GET    /api/v1/migration/profiling-runs/{run_id}/rule-signals    -- L5: rule signal findings
PATCH  /api/v1/migration/coverage/{entry_id}                     -- RE review: accept/reject/override
POST   /api/v1/migration/profiling-runs/{run_id}/prepopulate-mapper -- L4→field_mapping bridge
GET    /api/v1/migration/library                                 -- cross-engagement mapping library
GET    /api/v1/migration/library?platform=&entity=&status=       -- filtered library entries
```
| `platform/migration/db/profiling.go` | Profiling run + source table/column DB ops |
| `platform/migration/db/coverage.go` | Coverage entry DB ops |
| `platform/migration/db/library.go` | Library entry DB ops |

| Modified File | Changes |
|----------------|---------|
| `platform/migration/models/types.go` | Add all new types (ProfilingRun, SourceTable, SourceColumn, CoverageEntry, RuleSignal, LibraryEntry) |
| `platform/migration/api/handlers.go` | Register all new routes |
| `platform/migration/profiler/profiler.go` | Retained for backward compat; Level 2 subsumes current quality dimensions |
| `platform/migration/profiler/dimensions.go` | Refactored — becomes part of Level 2 |
| `platform/migration/profiler/patterns.go` | Replaced by `pension_patterns.go` with expanded pattern set |

---

## Part 2b: AI Integration at Every Level

The job queue and data model are plumbing. AI is what makes this a first-rate migration service. Every profiling level should leverage the intelligence service to reduce manual effort while maintaining auditability.

**Principle:** AI proposes, humans dispose. Every AI output is tagged with `ai_confidence` and `ai_source = 'INTELLIGENCE_SERVICE'`. Nothing AI-generated auto-advances past PROPOSED without RE review. But AI should handle 70-80% of the cognitive load, turning the RE's job from "author everything" to "review and approve."

### AI at Level 1: Table Classification

The current `conceptTagHeuristics` substring map classifies maybe 5-10% of tables. For the rest, the intelligence service classifies tables by analyzing the full schema manifest:

```
POST /intelligence/api/v1/classify-tables
Body: {
  tables: [{ name: "EMPL_MSTR", columns: ["MBR_NO", "HIRE_DT", "EMPL_STAT", ...], row_count: 150000 }, ...]
  canonical_entities: ["member", "employment_record", "contribution_record", ...]
}
Response: {
  classifications: [
    { table: "EMPL_MSTR", entity_class: "employee-master", confidence: 0.95 },
    { table: "SAL_HIST", entity_class: "salary-history", confidence: 0.88 },
    { table: "AUDIT_LOG_2019", entity_class: null, is_likely_archive: true, confidence: 0.82 },
    ...
  ]
}
```

Heuristic matching runs first (fast, free). AI runs second for unclassified tables (batch call, ~seconds for 1000 tables). Results merge — heuristic wins on ties.

### AI at Level 2: Semantic Pattern Classification

For columns where regex detects ambiguous patterns (e.g., 8-digit integers could be dates, SSNs, or member numbers), send sample values to the intelligence service:

```
POST /intelligence/api/v1/classify-columns
Body: {
  columns: [
    { name: "HIRE_DT", table: "EMPL_MSTR", data_type: "DECIMAL(8,0)",
      sample_values: ["19650315", "19780822", "20010301", "20150615"],
      null_pct: 0.02, distinct_count: 45000 }
  ]
}
Response: {
  classifications: [
    { column: "HIRE_DT", semantic_type: "date_yyyymmdd", confidence: 0.97,
      suggested_pattern: "YYYYMMDD", suggested_transform: "date_yyyymmdd_to_iso" }
  ]
}
```

This disambiguates patterns and pre-assigns transformation library functions. Stored in `source_column.pattern_frequencies` JSONB with `ai_classified: true`.

### AI at Level 4: Coverage Scoring Boost

For canonical fields where structural scoring produces low confidence (< 0.70), send the field spec + top 3 source candidates with sample values to AI:

```
POST /intelligence/api/v1/score-coverage
Body: {
  canonical_field: { entity: "contribution_record", field: "accumulated_balance", type: "DECIMAL(14,2)", required: true },
  candidates: [
    { column: "EE_BAL", table: "CONTRIB", sample_values: ["18450", "32100", "0", "95600"], null_pct: 0.05 },
    { column: "TOT_CONTRIB", table: "CONTRIB", sample_values: ["184.50", "321.00", "0.00"], null_pct: 0.01 }
  ]
}
Response: {
  best_match: "EE_BAL",
  confidence: 0.85,
  reasoning: "Values suggest integer cents representation of accumulated balance. Recommend TRANSFORM with amount_cents_to_decimal.",
  mapping_type: "TRANSFORM",
  transformation_notes: "Divide by 100 — values are stored as integer cents"
}
```

AI-boosted confidence is blended: `final = max(structural × 0.4 + ai × 0.6, structural)`. AI can only INCREASE confidence, never decrease it (structural scoring is the floor).

### AI for Codebook Generation (HC-3)

When Level 2 detects a code column, AI proposes canonical value mappings:

```
POST /intelligence/api/v1/propose-codebook
Body: {
  column: "EMPL_STAT", table: "EMPL_MSTR",
  canonical_field: "member.employment_status",
  top_values: [{"value": "A", "count": 45000}, {"value": "T", "count": 12000}, {"value": "R", "count": 8500}, {"value": "D", "count": 200}]
}
Response: {
  entries: [
    { legacy_code: "A", canonical_value: "ACTIVE", confidence: "HIGH" },
    { legacy_code: "T", canonical_value: "TERMINATED", confidence: "HIGH" },
    { legacy_code: "R", canonical_value: "RETIRED", confidence: "HIGH" },
    { legacy_code: "D", canonical_value: "DECEASED", confidence: "MEDIUM" }
  ]
}
```

Proposals are stored as `codebook_entry` rows with `source = 'AI_INFERRED'`. RE reviews and confirms.

### AI Batch Review Grouping

After Level 4 produces coverage entries, group similar REVIEW_REQUIRED entries for batch approval:

```
POST /intelligence/api/v1/group-for-review
Body: {
  entries: [... all REVIEW_REQUIRED coverage entries with sample data ...]
}
Response: {
  groups: [
    {
      description: "15 date columns across 8 tables — all YYYYMMDD format mapped to canonical date fields",
      entry_ids: ["id1", "id2", ...],
      suggested_action: "APPROVE_ALL",
      confidence: 0.92
    },
    {
      description: "3 amount columns with implicit 2-decimal encoding",
      entry_ids: ["id3", "id4", "id5"],
      suggested_action: "APPROVE_ALL",
      confidence: 0.88
    }
  ]
}
```

RE sees review groups instead of individual entries. "Approve group" applies to all entries in the group.

### AI Consistency Validation (Post-Mapping)

After mapper pre-population, validate the full mapping set:

```
POST /intelligence/api/v1/validate-mapping-set
Body: {
  mappings: [... all field_mapping records for this engagement ...]
  canonical_schema: [... canonical_schema_field definitions ...]
}
Response: {
  issues: [
    { severity: "ERROR", description: "member.employer_id maps to EMPL_CD (table A) but employer.employer_id maps to EMPLOYER_NUM (table B) — FK incompatibility" },
    { severity: "WARNING", description: "3 source columns mapped to member.middle_name — possible duplication" }
  ]
}
```

Issues surface in the Attention Queue as P1/P2 items.

### Files for AI Integration

| New File | Purpose |
|----------|---------|
| `platform/migration/intelligence/classifier.go` | Table + column classification client |
| `platform/migration/intelligence/coverage_scorer.go` | AI-boosted coverage scoring client |
| `platform/migration/intelligence/codebook_proposer.go` | Codebook auto-generation client |
| `platform/migration/intelligence/review_grouper.go` | Batch review grouping client |
| `platform/migration/intelligence/mapping_validator.go` | Post-mapping consistency validation |

All AI calls are **non-blocking and gracefully degraded**. If the intelligence service is unavailable, each level falls back to pure structural/algorithmic methods. AI is an accelerator, not a gate.

---

### What Happens to Existing Code

| Current | Fate |
|---------|------|
| `quality_profile` table | Retained. Level 2 populates it for backward compat. New profiling runs use `source_column` for granular data. |
| `ProfileTable()` in `profiler.go` | Becomes a Level 2 executor — called by worker, results stored in `source_column` |
| `ProfileCompleteness/Accuracy/...` in `dimensions.go` | Refactored into Level 2 as column-level metrics (null_pct, pattern_frequencies, etc.) |
| `field_mapping` table | Retained. Level 4 coverage entries pre-populate it (AUTO_MAPPED → APPROVED, REVIEW_REQUIRED → PROPOSED) |
| `MatchColumns()` in `mapper/matcher.go` | Becomes part of Level 4 scoring — template matching feeds into coverage confidence |
| `CorpusRecorder` in intelligence service | Superseded by mapping library. Library is authoritative; corpus provides supplementary signal scores. |

---

## Part 3: Mapping at Scale (UI + API)

The mapping panel and API need pagination, table-level navigation, and bulk operations. This is independent of the profiling model change.

### Server-Side Pagination

**Modified `ListMappings`:**
```
GET /api/v1/migration/engagements/{id}/mappings
  ?limit=50&cursor=<base64>&table=<name>&search=<substr>&status=AGREED&approval=PROPOSED

Response: { data: [...], next_cursor, total_count }
```

Keyset pagination on `(source_table, source_column)`.

### Table Summary Endpoint

```
GET /api/v1/migration/engagements/{id}/mapping-summary
Response: [{ source_table, total, agreed, disagreed, template_only, signal_only, approved, proposed, rejected }]
```

Single GROUP BY query — fast.

### Bulk Operations

```
POST /api/v1/migration/engagements/{id}/mappings/bulk-approve
Body: { filter: { table, status }, mapping_ids: [...] }
```

Single UPDATE statement.

### Pre-Computed Warnings

```sql
ALTER TABLE migration.field_mapping ADD COLUMN warnings_json JSONB;
```

Stored at generation time. No recomputation on read.

### Frontend MappingPanel Refactor

**Layout: Table sidebar + paginated list**

```
┌─────────────────────────────────────────────────────────────────┐
│ [Search: ____________] [AGREED ●28] [DISAGREED ●3] [Approve All]│
├──────────────┬──────────────────────────────────────────────────┤
│ Source Tables │  Source Column    → Canonical Column    Status  │
│              │                                                  │
│ ● members    │  members.ssn       → member.ssn         AGREED  │
│   45 cols    │  members.hire_dt   → member.hire_date   AGREED  │
│   40 agreed  │  members.sal_type  → member.tier    ⚠  DISAGR  │
│              │  ...                (infinite scroll)            │
│ ○ salary     │                                                  │
│ ○ contrib    │                                                  │
│              │                                                  │
│ ─ SKIPPED ─  │                                                  │
│ ○ audit_log  │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

### Coverage Report vs. Mapping Panel — How They Relate

These are TWO VIEWS of the migration data, anchored differently:

| View | Anchor | Table | Primary question |
|------|--------|-------|-----------------|
| **Coverage Report** | Canonical schema (target) | `canonical_coverage_entry` | "For each canonical field, which source column satisfies it?" |
| **Mapping Panel** | Source tables (source) | `field_mapping` | "For each source column, where does it go in the canonical model?" |

**Data flow:** Level 4 coverage scoring produces `canonical_coverage_entry` rows. When the analyst triggers "Pre-populate Mapper", coverage entries with AUTO_MAPPED status create `field_mapping` records (approval_status = APPROVED). REVIEW_REQUIRED entries create field_mapping with approval_status = PROPOSED. This bridges the two views.

The Coverage Report is the **analyst's primary workspace** during the PROFILING/MAPPING phases. The Mapping Panel remains useful as a source-anchored view for checking "did we map everything from table X?"

### Coverage Report UI (New — Primary View)

The Coverage tab replaces the radar chart as the primary profiling output. Per-canonical-entity grid:

```
┌───────────────────────────────────────────────────────────────┐
│ Coverage Report — Run #3 (2026-03-25)                        │
│ Overall: 68.5% auto-mapped │ Assessment: PROCEED_WITH_REVIEW │
├────────────────┬─────────────────────────────────────────────┤
│ Entities       │  Field                Source Candidate  Conf │
│                │                                              │
│ ■ member       │  member_id            MBR_NO           0.98 │
│   16/18 mapped │  employment_status    EMPL_STAT ⓘ     0.91 │
│                │  hire_date            HIRE_DT          0.94 │
│                │  date_of_birth        ???         ⚠ MISSING │
│ □ employment   │                                              │
│   8/12 mapped  │                                              │
│                │                                              │
│ □ contribution │                                              │
│                │                                              │
│ ⓘ = library-sourced  ⚠ = requires review  ✓ = RE approved  │
└────────────────┴─────────────────────────────────────────────┘
```

### Files (Mapping + Coverage UI)

| New File | Purpose |
|----------|---------|
| `db/migrations/048_mapping_warnings.sql` | Add warnings_json to field_mapping |
| `platform/migration/api/mapping_summary_handlers.go` | Table summary + bulk approve |
| `frontend/src/components/migration/engagement/MappingTableNav.tsx` | Table sidebar |
| `frontend/src/components/migration/engagement/MappingToolbar.tsx` | Search + filters |
| `frontend/src/components/migration/engagement/CoverageReport.tsx` | Level 4 coverage grid |
| `frontend/src/components/migration/engagement/CoverageEntityNav.tsx` | Entity sidebar for coverage |
| `frontend/src/hooks/usePaginatedMappings.ts` | Cursor-based pagination hook |
| `frontend/src/hooks/useProfilingRun.ts` | Profiling run status + level progress |
| `frontend/src/hooks/useCoverage.ts` | Coverage report data |

| Modified File | Changes |
|----------------|---------|
| `platform/migration/api/mapping_handlers.go` | Cursor pagination, read warnings from column |
| `frontend/src/components/migration/engagement/MappingPanel.tsx` | Refactor: table nav + paginated table |
| `frontend/src/components/migration/engagement/QualityProfilePanel.tsx` | Replace radar chart with profiling run progress + coverage summary |
| `frontend/src/hooks/useMigrationApi.ts` | Add paginated, summary, bulk approve, profiling hooks |
| `frontend/src/types/Migration.ts` | Add all new types |

---

## Part 4: Mapping Library Feedback Loop

When a Rules Engineer accepts or rejects a coverage entry (Level 4 review), the decision feeds back into the mapping library:

### Flow

```
1. RE reviews canonical_coverage_entry (ACCEPTED / REJECTED / OVERRIDDEN)
2. API handler calls library.RecordFeedback()
3. RecordFeedback:
   a. Normalize source column name to pattern (EMPL_STAT → EMPLOYMENT_STATUS)
   b. Upsert mapping_library_entry (ON CONFLICT update counts)
   c. Recompute confidence = acceptance_count / validation_count
   d. Promote to ACTIVE if confidence ≥ 0.85 AND validation_count ≥ 3
   e. Deprecate if rejection_count / validation_count > 0.30
4. Next engagement on same platform: Level 4 scoring checks library FIRST
   - ACTIVE hit: boost confidence by 40% (blended with structural score)
```

### Column Name Normalization

Port the pension-specific normalization patterns from the spec:

```go
var NormalizationPatterns = []struct {
    Pattern    *regexp.Regexp
    Normalized string
}{
    {regexp.MustCompile(`(?i)(EMPL|EMP|MEMBER|MBR|ACCT)_(STAT|STATUS|STS|ST)`), "EMPLOYMENT_STATUS"},
    {regexp.MustCompile(`(?i)(HIRE|EMPL|EMP)_(DT|DATE|DAT)`), "HIRE_DATE"},
    {regexp.MustCompile(`(?i)(TERM|SEPARATION|SEP)_(DT|DATE|DAT)`), "TERMINATION_DATE"},
    {regexp.MustCompile(`(?i)(RETIRE|RET|RETMT)_(DT|DATE|DAT)`), "RETIREMENT_DATE"},
    {regexp.MustCompile(`(?i)(DOB|BIRTH|BIRT)_(DT|DATE|DAT)?`), "DATE_OF_BIRTH"},
    {regexp.MustCompile(`(?i)(BEN|BENEFIT|BNFT)_(AMT|AMOUNT|AMN|AM)`), "BENEFIT_AMOUNT"},
    {regexp.MustCompile(`(?i)(CONTRIB|CONTR|CTR)_(AMT|AMOUNT|AMN|AM)`), "CONTRIBUTION_AMOUNT"},
    {regexp.MustCompile(`(?i)(SALARY|SAL|PAY)_(AMT|AMOUNT|AMN|AM)`), "SALARY_AMOUNT"},
    {regexp.MustCompile(`(?i)(SVC|SERVICE|SERV)_(YRS|YEARS|YR|CRD|CREDIT)`), "SERVICE_YEARS"},
    {regexp.MustCompile(`(?i)(MBR|MEMBER|EMPL|EMP)_(NO|NUM|NUMBER|NBR|ID)`), "MEMBER_NUMBER"},
    {regexp.MustCompile(`(?i)(SSN|SOC|SOC_SEC)`), "SSN"},
    {regexp.MustCompile(`(?i)(PLAN|PLN|TIER)_(CD|CODE|TYP|TYPE)`), "PLAN_CODE"},
}
```

---

## Part 5: Transformation Integration Points

The transformation engine (separate sprint) is a downstream consumer of profiling + mapping. But profiling must produce the right inputs:

### Hard Case Detection During Profiling

Level 2 column stats and Level 3 dependency findings feed automatic hard case detection. Each `canonical_coverage_entry` may gain a `hard_case_type`:

| HC Code | Detection Source | Signal (from profiling Level) |
|---------|-----------------|-------------------------------|
| HC-1 Semantic Ghost | L2 column stats | `null_pct >= 99.9` AND `total_count >= 100` |
| HC-2 Overloaded Column | L3 dependency findings | Multiple type patterns in same column |
| HC-3 Implicit Codebook | L2 column stats | `distinct_count <= 50`, no FK detected, short alpha/numeric values |
| HC-4 Temporal Landmine | L5 rule signals | `TEMPORAL_BOUNDARY` signal — value distribution changes at a date |
| HC-5 Calculated Redundancy | L3 dependency findings | High mutual information (>0.95) with derivable peer columns |

Hard case flags are stored on `canonical_coverage_entry` and propagated to `field_mapping` when mapper entries are pre-populated from coverage.

### Seven Mapping Types (Authoritative Enum)

Uses the transformation spec's 7-type enum everywhere: `DIRECT | TRANSFORM | SPLIT | MERGE | DERIVE | DISCARD | LEGACY_OPAQUE`. The `TRANSFORM` type subsumes type coercion, code translation, and format conversion — the specific transformation is in `transformation_notes`.

| Type | When Level 4 proposes it | Typical confidence |
|------|--------------------------|-------------------|
| DIRECT | Name + type match, no transformation needed | ≥ 0.90 |
| TRANSFORM | Type coercion, format conversion, codebook lookup needed | 0.60-0.89 |
| SPLIT | One source → multiple canonical (multi-target scoring) | 0.50-0.75 |
| MERGE | Multiple source → one canonical (incomplete single-column match) | 0.50-0.75 |
| DERIVE | Computed from rules engine (benefit-adjacent fields) | 0.40-0.60 |
| DISCARD | HC-1 semantic ghost, or analyst marks irrelevant | N/A |
| LEGACY_OPAQUE | No mapping possible, LEGACY_OPAQUE protocol | N/A |

### Codebook Registry

The current `codetable_mapping` table handles code-level value mapping. The transformation spec promotes codebooks to first-class objects with their own lifecycle (DRAFT → VALIDATED → LOCKED). During this plan's implementation:

- Level 2 profiling identifies code columns (low cardinality + short alpha/numeric)
- Level 4 coverage proposes CODE_TRANSLATION mapping type
- The codebook table from the transformation spec should be created alongside the coverage tables (migration 045b) as a stub ready for the transformation sprint

```sql
CREATE TABLE migration.codebook (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id   UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    codebook_name   TEXT NOT NULL,
    source_table    TEXT,
    source_column   TEXT,
    canonical_entity TEXT,
    canonical_field TEXT,
    status          TEXT DEFAULT 'DRAFT',  -- DRAFT | VALIDATED | LOCKED
    version         INT NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE migration.codebook_entry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codebook_id     UUID NOT NULL REFERENCES migration.codebook(id),
    legacy_code     TEXT NOT NULL,
    legacy_description TEXT,
    canonical_value TEXT NOT NULL,
    confidence      TEXT DEFAULT 'LOW',    -- HIGH | MEDIUM | LOW
    source          TEXT DEFAULT 'PROFILER', -- PROFILER | HUMAN | AI_INFERRED
    frequency       BIGINT DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Level 2 profiling auto-creates DRAFT codebooks when it detects code columns, seeding entries from the `top_values` distribution.

---

## Implementation Sequence

### Sprint A: Job System Foundation (~1 session)
1. Migration 042: `migration.job` table
2. `jobqueue` package: enqueue, claim, heartbeat, complete, fail
3. Job API handlers
4. Worker binary skeleton (standalone + embedded mode)
5. Stale-job recovery goroutine
6. Tests: job lifecycle, SKIP LOCKED, stale recovery

### Sprint B: Profiling Data Model + Levels 1-2 + AI Classification (~2 sessions)
7. Migrations 043: profiling_run, source_table, source_column
8. Level 1 executor: table/column discovery with catalog-based row estimates
9. AI table classification client (POST /classify-tables) — fallback to heuristics
10. Level 2 executor: column stats, pension patterns, sampling for large tables
11. AI semantic column classification (POST /classify-columns) — fallback to regex-only
12. Profiling run API: initiate, status, inventory
13. Refactor existing `ProfileTable` → Level 2 executor (backward compat)
14. Frontend: profiling run progress view
15. Tests: L1 discovery, L2 stats, sampling, AI fallback paths

### Sprint C: Coverage Scoring + Mapping Library + AI Boost (~2 sessions)
16. Migrations 044-047: dependencies, coverage, rule signals, library
17. Migration for canonical_schema_field + seed from domains/pension/
18. Level 3 executor: dependency analysis (operates on L2 results)
19. Level 4 executor: canonical coverage scoring with structural + library + AI boost
20. AI coverage scoring client (POST /score-coverage) — fallback to structural-only
21. AI codebook proposer (POST /propose-codebook) — auto-seed DRAFT codebooks
22. Mapping library CRUD + feedback loop + column normalizer
23. Coverage report API + RE review actions
24. Coverage entry → field_mapping pre-population (AUTO_MAPPED → APPROVED)
25. Frontend: Coverage Report tab (entity nav + coverage grid)
26. Tests: coverage scoring, library accumulation, AI boost, pre-population

### Sprint C2: AI Review Acceleration (~1 session)
27. AI batch review grouper (POST /group-for-review)
28. AI mapping-set consistency validator (POST /validate-mapping-set)
29. Frontend: batch review UI (group approve/reject)
30. Frontend: validation issues in Attention Queue
31. Tests: review grouping, validation issue detection

### Sprint D: Mapping UI at Scale (~1 session)
22. Migration 048: warnings_json on field_mapping
23. Cursor-based ListMappings with server-side pagination
24. `/mapping-summary` + `/mappings/bulk-approve` endpoints
25. Pre-compute warnings at generation time
26. Frontend: MappingTableNav sidebar + MappingToolbar + paginated table
27. Tests: pagination, bulk approve, search

### Sprint E: Level 5 + Polish (~1 session)
28. Level 5 executor: rule signal detection
29. Rule signals API + frontend tab
30. Profiling run summary + readiness assessment computation
31. Wire coverage into phase gate metrics
32. End-to-end test: initiate run → L1-L5 → coverage → mapper pre-pop → RE review → library feedback

---

## Verification

**Unit tests (Tier 1, no DB):**
- Job queue: lifecycle, SKIP LOCKED mock, stale recovery
- Pension patterns: all 10 regex patterns with positive + negative cases
- Column normalizer: all normalization patterns
- Coverage scoring: structural confidence computation, library boost
- Library lifecycle: CANDIDATE → ACTIVE promotion, DEPRECATED demotion
- Sampling: threshold decisions (when to use catalog vs exact)

**Integration tests (Tier 2, with DB):**
- Job lifecycle: enqueue → claim → heartbeat → complete
- Profiling run: L1 → L2 → L4 coverage report (using test fixture source)
- Library feedback: accept → recompute confidence → promote to ACTIVE
- Cursor pagination: ordering, boundary conditions, filters

**Frontend tests:**
- CoverageReport: renders entity grid, status colors, RE review actions
- MappingPanel: paginated data, table nav, search, bulk approve
- ProfilingRunProgress: shows level progression, job counts

**Expected Throughput Impact (per engagement):**

| Activity | Current (manual) | With this plan | Reduction |
|----------|-----------------|----------------|-----------|
| Table classification (1000 tables) | RE manually reviews each table | AI classifies 70%+, RE reviews remainder | ~5 days → ~1 day |
| Coverage scoring (89 canonical fields) | Template matching + manual review of all | AI-boosted scoring, batch review groups | ~3 days → ~0.5 days |
| Codebook creation (est. 20 code columns) | RE researches each code set manually | AI proposes canonical values, RE confirms | ~2 days → ~0.5 days |
| Mapping review (est. 500 REVIEW_REQUIRED) | One-by-one review | Batch groups of 10-20, approve per group | ~4 days → ~1 day |
| Post-mapping validation | Manual FK/consistency checks | AI consistency validation, auto-flagged issues | ~1 day → ~0.25 days |
| **Total profiling + mapping phase** | **~15 days RE effort** | **~3 days RE effort** | **~80%** |

These are estimates. Actual improvement depends on source system complexity and AI accuracy. The mapping library further improves throughput for subsequent engagements on the same platform.

**Integrity gates (non-negotiable):**
- Every AUTO_MAPPED entry still has a confidence score visible to the RE
- Every AI-proposed codebook entry shows its confidence level
- The mapping set consistency validator runs BEFORE transformation begins
- Coverage report shows MISSING_REQUIRED as blockers — cannot proceed without resolution
- Full lineage from source → coverage → mapping → transformation is preserved

**Manual verification:**
- Start API + embedded worker
- Create engagement, configure source with 100+ tables
- Initiate profiling run → observe L1-L2 jobs completing progressively
- Verify coverage report shows canonical field scoring
- Accept/reject coverage entries → verify library accumulates
- Verify mapping panel loads with pagination + table sidebar
