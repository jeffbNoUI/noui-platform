# NoUI Migration Engine — Design Document

**Date:** 2026-03-20
**Status:** Approved
**Milestone:** Two-Source Proof (PRISM + PAS → NoUI Canonical)

---

## 1. Goal

Build a migration engine that accepts any pension source database, auto-maps it to the NoUI canonical schema using connector concept tags, transforms and loads the data, and validates correctness via reconciliation. Prove generalization by migrating two structurally different source systems (PRISM and PAS) to the same canonical target with >=95% weighted reconciliation match rate and zero unresolved P1 items.

The engine learns from every migration engagement and improves across clients while maintaining strict tenant data isolation.

---

## 2. Architecture

### Layer Placement

```
connector/                     # Layer 1: discovers schema, tags concepts
  tagger/                      #   18 concepts, signal-based (exists today)

platform/migration/            # Layer 2: NEW — Go migration pipeline service (port 8089)
  mapper/                      #   Dual mapping: template + signal scoring agreement
  transformer/                 #   Field transformations, type coercion, normalization
  loader/                      #   Canonical writer with lineage + confidence tagging
  reconciler/                  #   Three-tier benefit recalculation + weighted gate
  reviewer/                    #   Correction suggestion engine + analyst queue

migration-intelligence/        # NEW — Python learning service (port 8100)
  scorer/                      #   Multi-signal column scoring + profiling
  corpus/                      #   Tenant-isolated decisions + de-identified shared model
  reconciliation/              #   Mismatch analysis + correction suggestions

migration-simulation/          # Test oracle (Python, existing)
  generators/                  #   PRISM + PAS synthetic data
  reconciliation/              #   Independent recomputation (cross-language verify)
  tests/                       #   110 existing + new oracle comparison tests
```

### Hybrid Go + Python (MC Worker Precedent)

The migration engine follows the same architectural pattern as PRISM's Monte Carlo worker:

- **Go service** handles: connector API calls, template matching (deterministic, auditable), transformation execution, canonical loading, lineage writing, reconciliation orchestration, batch management
- **Python service** handles: signal scoring, column profiling, similarity matching against historical corpus, confidence computation, suggested corrections, learning from analyst decisions

The Go service asks the Python service: "Here's a source column with these characteristics — what's your best mapping and confidence?" The Python service answers with a scored ranking informed by every previous client engagement.

**Rationale:** The learning corpus is the competitive moat. Python has the right ecosystem for statistical profiling, similarity matching, and eventually ML-based column classification. Go handles the deterministic production pipeline reliably. Clean API boundary: Go doesn't know how confidence is computed, Python doesn't know how data is loaded.

### Data Flow

```
Source DB --> Connector Tagger --> Concept-Tagged Manifest
                                        |
                    +-------------------+
                    v
            +---------------+
            | Template Match |---> Proposed Mapping (deterministic)
            +---------------+          |
            +---------------+          |    +-----------+
            | Signal Scorer  |---> Independent Mapping --> | Agreement |---> Auto-approved
            +---------------+                             | Analysis  |---> Disagreements -> review queue
                                                          +-----------+
                                                                |
                    +-------------------------------------------+
                    v
            Approved Mapping --> Transformer --> Canonical DB
                                                      |
                                                      v
                                              Reconciliation Engine
                                              +-- MATCH (<=0.50)
                                              +-- MISMATCH -> Suggested Corrections
                                              +-- Results stored for future auto-correct
```

---

## 3. Dual Mapping Strategy

### Why Dual

Template matching (deterministic, auditable) and signal scoring (flexible, learning) serve different purposes that reinforce each other:

- **Template matching** is the production path. Fast, deterministic, auditable. When an analyst asks "why did column X map to canonical field Y?" you point to the template rule. But it only maps what the template expects to find.
- **Signal scoring** is the validation and discovery layer. Catches what templates miss: unexpected columns, wrong mappings whose value distributions don't match, unconventional column names.

### Agreement Analysis

| Template | Signal | Result |
|----------|--------|--------|
| Maps to X | Maps to X | Auto-approved (high confidence) |
| Maps to X | Maps to Y | Flagged for human review with both explanations |
| Maps to X | No match | Template-only: approved with lower confidence |
| No match | Maps to Y | Discovered column: surfaced for analyst triage |

### Two-Phase Template Matching

Phase 1: Concept tag (table-level) selects a mapping template. E.g., concept `salary-history` pulls the salary mapping template with ~8-12 expected canonical fields.

Phase 2: Source columns matched to template slots using column-name similarity, data type compatibility, and sample-value profiling within the narrowed search space.

### Signal Scoring

Every source column scored against canonical columns using multiple signals:
- Name similarity (edit distance, token overlap)
- Type compatibility (DECIMAL->DECIMAL high, VARCHAR->DATE low)
- Value distribution shape
- Null rate and cardinality
- FK relationship patterns
- Historical corpus matches (improves with each engagement)

---

## 4. Tenant Isolation for Learning Corpus

### The Requirement

The intelligence service accumulates mapping knowledge across clients. Client B benefits from Client A's analyst decisions. But Client A's schema names, column values, table structures, and mapping details must never be visible to Client B — even indirectly.

### Three Isolation Layers

**1. Feature Abstraction** — source column characteristics reduced to statistical features and structural patterns before entering the shared corpus. No raw names, no sample values, no identifiers.

What gets stored (shared corpus):
- Column data type: DECIMAL(10,2)
- Null rate bucket: 0.05 (quantized)
- Cardinality bucket: HIGH
- Value distribution shape: right-skewed
- FK relationship pattern: many-to-one
- Concept tag: salary-history
- Canonical target: salary.base_amount
- Outcome: APPROVED (confidence 0.94)

What NEVER enters the corpus:
- Source table/column names
- Client identifier or tenant_id
- Actual column values or samples
- Schema/database names
- Analyst names or notes
- Connection strings or credentials

**2. Client-Scoped Queries** — analysts see only outputs derived from the shared model applied to their source system. No provenance trail back to which clients contributed to the model's confidence.

**3. Tenant Isolation at the Service Level** — same pattern as platform RLS. The Python intelligence service receives a tenant_id with every request. Client-specific mapping decisions (pre-abstraction) are stored in tenant-isolated tables. Only abstracted features cross the tenant boundary.

### k-Anonymity on Shared Corpus

Statistical features are quantized to prevent fingerprinting:
- Null rates bucketed to nearest 0.05
- Cardinality ratios bucketed: LOW, MEDIUM, HIGH, UNIQUE
- Exact table/column counts replaced with size categories
- No features with high distinguishing power stored raw

---

## 5. Reconciliation Architecture

### Three-Tier Reconciliation

**Tier 1 — Stored Calculations (highest confidence)**
- Source system has persisted benefit calc results
- Recompute using stored inputs (FAS_USED, YOS_USED)
- Compare recomputed vs legacy stored result, then vs canonical migrated result
- Available: PRISM (PRISM_BENEFIT_CALC), PAS (legacy_calculation_snapshot)

**Tier 2 — Payment History (medium confidence)**
- No stored calcs, but payment records exist
- Reverse-engineer: monthly_gross_payment -> implied benefit amount
- Cross-check: does the migrated benefit_event produce this payment?
- Confidence discount: +/-2% tolerance (COLA timing, tax withholding variability)

**Tier 3 — Aggregate Validation (baseline confidence)**
- No stored calcs, no payments (active members)
- Statistical checks against plan-level benchmarks:
  - Average salary by employer/year vs actuarial valuation
  - Total contribution balance vs employer-reported totals
  - Service credit years vs employment segment span
  - Member count by status vs plan annual report
- Flags outliers, not individual pass/fail
- Safety net for the case where both mapping strategies are wrong together

### Weighted Reconciliation Gate

```
Category classification:
  MATCH:  variance <= $0.50
  MINOR:  variance > $0.50 AND < $25.00
  MAJOR:  variance >= $25.00
  ERROR:  computation failed

Priority rules:
  ANY retiree mismatch (even MINOR) -> P1
  ANY MAJOR -> P1 regardless of status
  MINOR on active member -> P2
  Tier 3 outlier -> P3 (investigate, don't block)

Gate formula:
  weighted_score = (MATCH * 1.0 + MINOR * 0.5) / total_tier1_and_tier2
  Gate passes when:
    weighted_score >= 0.95  AND
    unresolved_P1 == 0
```

### Correction Suggestion Flow

1. Reconciliation detects systematic pattern (same direction, same magnitude across member cohort)
2. Python intelligence service correlates with specific mapping
3. Generates correction proposal with confidence, evidence, and affected member count
4. Analyst reviews and approves/rejects
5. If approved: Go service re-transforms affected rows via lineage (surgical, not full reload)
6. Re-runs reconciliation on affected members
7. Decision stored tenant-isolated; abstract features extracted to shared corpus

### Deferred: Auto-Correct with Guardrails

Approved correction patterns automatically applied to similar mappings in future runs. Deferred until trust is established through multiple client engagements. The system is designed to support this — analyst decisions are stored with enough context to train the auto-corrector when activated.

---

## 6. Exception Handling

### Design Principle

**Canonical schema constraints are immutable during migration.** Source defects produce exceptions, not schema changes. The target schema is the authority, the source data is the supplicant.

### Exception Flow

```
Source Row
    |
    v
Transform --> Validates against canonical constraints
    |
    +-- PASS -> Load to canonical + write lineage
    |
    +-- FAIL -> Exception record
                +-- exception_type: MISSING_REQUIRED / INVALID_FORMAT / etc.
                +-- source_table, source_id, field_name
                +-- attempted_value (or NULL)
                +-- constraint_violated
                +-- suggested_resolution (derive? default? manual?)
```

### Resolution Paths

For each constraint violation, the transformation layer must determine:

1. **Can we derive it?** (e.g., missing as_of_date from employment segment dates) -> Derive and populate, flag lineage as DERIVED
2. **Is this a known legacy defect?** -> Route to exception queue, quarantine row
3. **Is this genuinely optional in the business domain?** -> Then the canonical schema was wrong to require it, and we change the schema with justification (this is the ONLY path that justifies schema changes)

### Configurable Error Thresholds

```
Per migration engagement:
  hard_error_halt_pct:     5%    # >5% hard errors in a batch -> halt batch
  soft_warning_max_pct:    15%   # >15% warnings -> flag for review, don't halt
  retiree_error_tolerance: 0     # ANY retiree hard error -> halt immediately
  financial_balance_tolerance: $0.01  # contribution/payment totals must match
```

Threshold breach -> batch halted -> analyst notified -> root cause analysis required before restart.

---

## 7. Batch Architecture

### Idempotent, Restartable Batches

- Each batch has a unique batch_id and covers a defined member set (by employer or member range)
- Batch states: PENDING -> RUNNING -> LOADED -> RECONCILED -> APPROVED
- Batches are idempotent: re-running a batch replaces its output (old lineage marked superseded)
- Checkpoint: if batch fails at row N, restart resumes from row N
- Transaction boundary: one batch = one DB transaction for related tables
- Lineage entries tagged with batch_id for surgical rollback or re-transformation

### Re-Transformation

When a mapping correction is approved mid-migration:
1. Query lineage to find all canonical rows produced by the corrected mapping
2. Re-transform only those rows using the updated mapping version
3. Write new canonical values + new lineage entries
4. Old lineage entries marked superseded (not deleted — audit trail)
5. Re-run reconciliation on affected members

---

## 8. Data Quality Profiling

### ISO 8000 Quality Baseline

Before any mapping begins, the source database is profiled across six dimensions:

| Dimension | What It Measures | How |
|-----------|-----------------|-----|
| Accuracy | Value format conformance rate | Regex patterns, type checks |
| Completeness | 1 - null_rate for required fields | Column-level null analysis |
| Consistency | Cross-table referential integrity rate | FK validation, orphan detection |
| Timeliness | Data currency (most recent update date) | Temporal analysis |
| Validity | Business rule pass rate | Domain-specific rules (hire < term, salary > 0) |
| Uniqueness | Duplicate detection rate | Key uniqueness, fuzzy dedup |

**Gate: quality report must be reviewed and signed off before mapping proceeds.** This is the first deliverable of any engagement — sets expectations and scopes remediation.

### Confidence Tagging

Every canonical record carries a confidence level:
- `ACTUAL` — directly mapped from source with no transformation loss
- `DERIVED` — computed from related source data (e.g., FAS from salary records)
- `ESTIMATED` — inferred from patterns or defaults (e.g., missing hire date estimated)
- `ROLLED_UP` — source data was summarized from a prior migration (detected via boundary inference)

---

## 9. Data Model

### Migration Schema (platform database)

```sql
migration.engagement          -- engagement-level migration project (tenant-scoped)
migration.quality_profile     -- ISO 8000 scores per source table
migration.field_mapping       -- approved field mappings (versioned)
migration.code_mapping        -- code table value mappings
migration.batch               -- idempotent migration batches with checkpoint
migration.lineage             -- row-level provenance (source -> canonical)
migration.exception           -- quarantined rows that failed constraints
migration.reconciliation      -- three-tier reconciliation results
migration.correction          -- suggested mapping corrections from intelligence
migration.analyst_decision    -- tenant-isolated analyst decisions (pre-abstraction)
```

### Shared Corpus (intelligence service database)

```sql
intelligence.shared_corpus    -- abstract feature vectors (de-identified, cross-tenant)
                              -- NO tenant_id, NO source column names, NO sample values
                              -- Quantized features for k-anonymity
```

See full DDL in Appendix A.

---

## 10. API Contract

### Go Migration Service (port 8089)

```
Engagement:     POST/GET/PATCH  /api/v1/migration/engagements
Discovery:      POST            /api/v1/migration/engagements/:id/discover
Quality:        POST/GET        /api/v1/migration/engagements/:id/profile
                GET             /api/v1/migration/engagements/:id/quality-report
Mappings:       POST            /api/v1/migration/engagements/:id/generate-mappings
                GET/PUT         /api/v1/migration/engagements/:id/mappings
                GET/PUT         /api/v1/migration/engagements/:id/code-mappings
Batches:        POST            /api/v1/migration/engagements/:id/batches
                POST            /api/v1/migration/batches/:id/execute
                GET             /api/v1/migration/batches/:id/status
                POST            /api/v1/migration/batches/:id/retransform
Exceptions:     GET             /api/v1/migration/batches/:id/exceptions
                PUT             /api/v1/migration/exceptions/:id
Reconciliation: POST            /api/v1/migration/batches/:id/reconcile
                GET             /api/v1/migration/engagements/:id/reconciliation
                GET             /api/v1/migration/engagements/:id/reconciliation/p1
                PUT             /api/v1/migration/reconciliation/:recon_id
Corrections:    GET/PUT         /api/v1/migration/engagements/:id/corrections
Reports:        GET             /api/v1/migration/engagements/:id/reports/{type}
```

### Python Intelligence Service (port 8100) — Internal Only

```
POST  /intelligence/score-columns         -- column profiles -> scored mappings
POST  /intelligence/record-decision       -- analyst decision -> corpus update
POST  /intelligence/analyze-mismatches    -- recon results -> correction suggestions
GET   /intelligence/corpus-stats          -- corpus health (no tenant data)
```

---

## 11. Phased Rollout

### Phase 1: Foundation
- Validate PAS simulation package (fix schema mismatches)
- Build platform/migration/ Go service skeleton
- Build migration-intelligence/ Python service skeleton
- Implement template mapper (concept tag -> mapping templates)
- Implement signal scorer (column profiling + confidence)
- Implement agreement analysis (template vs signal, flag disagreements)
- ISO 8000 quality profiler (6-dimension report)
- **Entry:** connector tagger working, both source DBs available
- **Exit:** both PRISM and PAS produce quality reports + proposed mappings

### Phase 2: Transform + Load
- Go transformation pipeline (ordered handlers, type coercion)
- Batch processor (idempotent, restartable, checkpoint/resume)
- Canonical loader with lineage + confidence tagging
- Exception handling (quarantine, thresholds, halt rules)
- Code table discovery and mapping workflow
- Re-transformation capability via lineage
- **Entry:** approved mappings for both sources
- **Exit:** both sources loaded to canonical, zero hard errors

### Phase 3: Reconciliation + Feedback
- Three-tier reconciliation engine in Go
- Weighted scoring gate (P1/P2/P3, zero unresolved P1s)
- Python mismatch analysis (systematic vs random detection)
- Correction suggestion engine
- Analyst decision recording + corpus abstraction
- Cross-language verification (Go vs Python oracle)
- **Entry:** canonical data loaded for both sources
- **Exit:** both sources >=95% weighted gate, zero P1s
- ***** TWO-SOURCE PROOF MILESTONE *****

### Phase 4: Production Hardening
- API authentication + tenant isolation
- Migration engagement management (multi-client)
- Parallel run infrastructure (CDC/sync, comparison reports)
- Auditor-readable lineage reports (PDF/HTML)
- k-anonymity on shared corpus
- Schema versioning for canonical evolution
- **Entry:** two-source proof passed
- **Exit:** ready for first client engagement

### Phase 5: Learning + Scale
- Corpus grows with each client engagement
- Confidence improves, human review decreases
- Auto-correct with guardrails (deferred capability)
- Performance optimization for 250K+ member datasets
- Template governance as client base grows
- **Entry:** 2+ client engagements completed
- **Exit:** continuous improvement, no fixed endpoint

---

## 12. Success Criteria — Two-Source Proof

| Criterion | Measure | Gate |
|-----------|---------|------|
| PRISM source profiled | ISO 8000 quality report, all 6 dimensions | Report exists |
| PAS source profiled | ISO 8000 quality report, all 6 dimensions | Report exists |
| PRISM auto-mapped | Template + signal produce proposed mappings | >=80% columns auto-agreed |
| PAS auto-mapped | Template + signal produce proposed mappings | >=80% columns auto-agreed |
| PRISM loaded to canonical | All batches LOADED, zero threshold breaches | Error rate <5% per batch |
| PAS loaded to canonical | All batches LOADED, zero threshold breaches | Error rate <5% per batch |
| PRISM reconciled | Three-tier reconciliation complete | Weighted >=95%, zero P1 |
| PAS reconciled | Three-tier reconciliation complete | Weighted >=95%, zero P1 |
| Cross-language verify | Go reconciliation matches Python oracle | Delta <= $0.00 on shared fixtures |
| Schema integrity | No NOT NULL relaxations, no type widenings | Schema diff = zero |
| Corpus seeded | Both sources contributed abstract features | Corpus entries >0 per concept |
| Exception handling | Constraint violations quarantined, not swallowed | 100% in exception table |

---

## 13. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | PAS schema name mismatches (src_pas vs src) | High | Low | Fix in Phase 1 — known issue |
| R2 | Cross-language rounding disagreement | Medium | High | Rounding spec + shared fixture set |
| R3 | Template coverage gap — unmapped table | Medium | Medium | Signal scorer independent of templates |
| R4 | Connector tagger mis-tags a table | Low | High | Dual mapping catches disagreement |
| R5 | No stored calcs for some scenarios | Medium | Medium | Tier 2/3 reconciliation degrades gracefully |
| R6 | Shared corpus features insufficient | Medium | Medium | Measure accuracy, expand features if <70% |
| R7 | Performance bottleneck on signal scoring | Low | Medium | Sampling for tables >100K rows |
| R8 | Scope creep into UI before core proven | Medium | High | No UI in Phase 1-3. Hard boundary |

---

## 14. Rounding Specification

Both Go and Python implementations follow this spec:

1. All intermediate calculations: full precision (no rounding)
2. FAS computation: round to 2 decimal places AFTER averaging
3. Benefit computation: round to 2 decimal places as FINAL step
4. Rounding mode: HALF_UP (0.005 -> 0.01, not banker's rounding)
5. Contribution balances: round to 2dp per transaction
6. Service credit: round to 4 decimal places

Verification: shared fixture file (YAML) with inputs, expected intermediate values, and expected final values. Both implementations must produce exact match on all expected values.

---

## 15. Design Principles

1. **Canonical schema constraints are immutable during migration.** Source defects produce exceptions, not schema changes.
2. **No migration starts without a signed-off ISO 8000 quality baseline.** Quality profiling is the first deliverable.
3. **Batches are idempotent and restartable.** Any batch can fail and resume without corrupting other batches.
4. **Error thresholds stop the line.** Configurable per-engagement, with zero tolerance for retiree errors.
5. **Every canonical record carries a confidence tag.** Downstream consumers know whether data is actual, derived, estimated, or rolled-up.
6. **Target-schema-driven mapping.** Start from what canonical needs, find it in the source.
7. **Lineage serves auditors, not just engineers.** Reports readable by pension fund actuaries and trustees.
8. **Never adjust expected values to match migration output.** Mismatches are investigated, not explained away.

---

## 16. References

- [Industry Best Practices Research](./2026-03-20-migration-best-practices-research.md)
- [Migration Simulation Design](./2026-03-20-migration-simulation-design.md)
- [PRISM Legacy Schema](../../migration-simulation/db/prism_init.sql)
- [NoUI Canonical Schema](../../migration-simulation/db/canonical_init.sql)
- [GPT PAS Source Model](C:\Users\jeffb\docs\plans\gpt\pas_simulation_source_model.sql)
- [Connector Tagger](../../connector/tagger/concepts.go)

---

## Appendix A: Full Data Model DDL

### migration.engagement
```sql
CREATE TABLE migration.engagement (
    engagement_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL,
    source_system_name          VARCHAR(100) NOT NULL,
    canonical_schema_version    VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    status                      VARCHAR(20) NOT NULL DEFAULT 'PROFILING'
                                CHECK (status IN ('PROFILING','MAPPING','TRANSFORMING','RECONCILING','PARALLEL_RUN','COMPLETE')),
    quality_baseline_approved_at TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### migration.quality_profile
```sql
CREATE TABLE migration.quality_profile (
    profile_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id       UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    source_table        VARCHAR(100) NOT NULL,
    accuracy_score      DECIMAL(5,4) NOT NULL,
    completeness_score  DECIMAL(5,4) NOT NULL,
    consistency_score   DECIMAL(5,4) NOT NULL,
    timeliness_score    DECIMAL(5,4) NOT NULL,
    validity_score      DECIMAL(5,4) NOT NULL,
    uniqueness_score    DECIMAL(5,4) NOT NULL,
    row_count           INTEGER NOT NULL,
    profiled_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### migration.field_mapping
```sql
CREATE TABLE migration.field_mapping (
    mapping_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id       UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    mapping_version     VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    source_table        VARCHAR(100) NOT NULL,
    source_column       VARCHAR(100) NOT NULL,
    canonical_table     VARCHAR(100) NOT NULL,
    canonical_column    VARCHAR(100) NOT NULL,
    template_confidence DECIMAL(5,4),
    signal_confidence   DECIMAL(5,4),
    agreement_status    VARCHAR(20) NOT NULL
                        CHECK (agreement_status IN ('AGREED','DISAGREED','TEMPLATE_ONLY','SIGNAL_ONLY')),
    approval_status     VARCHAR(20) NOT NULL DEFAULT 'PROPOSED'
                        CHECK (approval_status IN ('PROPOSED','APPROVED','REJECTED','SUPERSEDED')),
    approved_by         VARCHAR(100),
    approved_at         TIMESTAMPTZ
);
```

### migration.code_mapping
```sql
CREATE TABLE migration.code_mapping (
    code_mapping_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id       UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    source_table        VARCHAR(100) NOT NULL,
    source_column       VARCHAR(100) NOT NULL,
    source_value        VARCHAR(100) NOT NULL,
    canonical_value     VARCHAR(100) NOT NULL,
    approved_by         VARCHAR(100),
    approved_at         TIMESTAMPTZ
);
```

### migration.batch
```sql
CREATE TABLE migration.batch (
    batch_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id       UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    batch_scope         VARCHAR(200) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','RUNNING','LOADED','RECONCILED','APPROVED','FAILED')),
    mapping_version     VARCHAR(20) NOT NULL,
    row_count_source    INTEGER,
    row_count_loaded    INTEGER,
    row_count_exception INTEGER,
    error_rate          DECIMAL(5,4),
    halted_reason       TEXT,
    checkpoint_key      VARCHAR(200),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ
);
```

### migration.lineage
```sql
CREATE TABLE migration.lineage (
    lineage_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id            UUID NOT NULL REFERENCES migration.batch(batch_id),
    source_table        VARCHAR(100) NOT NULL,
    source_id           VARCHAR(100) NOT NULL,
    canonical_table     VARCHAR(100) NOT NULL,
    canonical_id        UUID NOT NULL,
    mapping_version     VARCHAR(20) NOT NULL,
    confidence_level    VARCHAR(20) NOT NULL
                        CHECK (confidence_level IN ('ACTUAL','DERIVED','ESTIMATED','ROLLED_UP')),
    transformations     JSONB,
    superseded_by       UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### migration.exception
```sql
CREATE TABLE migration.exception (
    exception_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id            UUID NOT NULL REFERENCES migration.batch(batch_id),
    source_table        VARCHAR(100) NOT NULL,
    source_id           VARCHAR(100) NOT NULL,
    canonical_table     VARCHAR(100),
    field_name          VARCHAR(100) NOT NULL,
    exception_type      VARCHAR(30) NOT NULL
                        CHECK (exception_type IN ('MISSING_REQUIRED','INVALID_FORMAT','REFERENTIAL_INTEGRITY',
                                                  'BUSINESS_RULE','CROSS_TABLE_MISMATCH','THRESHOLD_BREACH')),
    attempted_value     TEXT,
    constraint_violated VARCHAR(200) NOT NULL,
    disposition         VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (disposition IN ('PENDING','AUTO_FIXED','MANUAL_FIXED','EXCLUDED','DEFERRED')),
    resolution_note     TEXT,
    resolved_by         VARCHAR(100),
    resolved_at         TIMESTAMPTZ
);
```

### migration.reconciliation
```sql
CREATE TABLE migration.reconciliation (
    recon_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id            UUID NOT NULL REFERENCES migration.batch(batch_id),
    member_id           UUID NOT NULL,
    tier                INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
    calc_name           VARCHAR(50) NOT NULL,
    legacy_value        DECIMAL(12,2),
    recomputed_value    DECIMAL(12,2),
    variance_amount     DECIMAL(12,4),
    category            VARCHAR(10) NOT NULL
                        CHECK (category IN ('MATCH','MINOR','MAJOR','ERROR')),
    is_retiree          BOOLEAN NOT NULL DEFAULT FALSE,
    priority            VARCHAR(5) NOT NULL CHECK (priority IN ('P1','P2','P3')),
    suspected_domain    VARCHAR(50),
    systematic_flag     BOOLEAN NOT NULL DEFAULT FALSE,
    resolved            BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by         VARCHAR(100),
    resolution_note     TEXT
);
```

### migration.correction
```sql
CREATE TABLE migration.correction (
    correction_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id           UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    correction_type         VARCHAR(50) NOT NULL,
    affected_mapping_id     UUID REFERENCES migration.field_mapping(mapping_id),
    current_mapping         JSONB NOT NULL,
    proposed_mapping        JSONB NOT NULL,
    confidence              DECIMAL(5,4) NOT NULL,
    evidence                TEXT NOT NULL,
    affected_member_count   INTEGER NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'PROPOSED'
                            CHECK (status IN ('PROPOSED','APPROVED','REJECTED')),
    decided_by              VARCHAR(100),
    decided_at              TIMESTAMPTZ
);
```

### migration.analyst_decision
```sql
CREATE TABLE migration.analyst_decision (
    decision_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    engagement_id       UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    decision_type       VARCHAR(30) NOT NULL
                        CHECK (decision_type IN ('MAPPING_APPROVED','MAPPING_REJECTED',
                                                 'CORRECTION_APPROVED','CORRECTION_REJECTED',
                                                 'EXCEPTION_RESOLVED')),
    context             JSONB NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### intelligence.shared_corpus (separate database)
```sql
CREATE TABLE intelligence.shared_corpus (
    corpus_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_table     VARCHAR(100) NOT NULL,
    canonical_column    VARCHAR(100) NOT NULL,
    source_data_type    VARCHAR(50) NOT NULL,
    null_rate_bucket    DECIMAL(3,2) NOT NULL,
    cardinality_bucket  VARCHAR(20) NOT NULL
                        CHECK (cardinality_bucket IN ('LOW','MEDIUM','HIGH','UNIQUE')),
    distribution_shape  VARCHAR(20) NOT NULL
                        CHECK (distribution_shape IN ('NORMAL','RIGHT_SKEW','LEFT_SKEW','UNIFORM','BINARY','SPARSE')),
    fk_pattern          VARCHAR(20) NOT NULL
                        CHECK (fk_pattern IN ('NONE','MANY_TO_ONE','ONE_TO_ONE','MANY_TO_MANY')),
    concept_tag         VARCHAR(50) NOT NULL,
    outcome             VARCHAR(10) NOT NULL CHECK (outcome IN ('APPROVED','REJECTED')),
    times_seen          INTEGER NOT NULL DEFAULT 1,
    avg_confidence      DECIMAL(5,4) NOT NULL,
    last_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- NO tenant_id column. NO source column names. NO sample values.
```
