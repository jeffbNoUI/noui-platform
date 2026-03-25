# Sprint B: 5-Level Profiling Data Model + Levels 1-2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the generic ISO 8000 quality profiler with a 5-level progressive profiling system, implementing Levels 1 (table/column inventory) and 2 (column statistics + pension patterns) backed by a PostgreSQL job queue.

**Architecture:** API enqueues a `profile_orchestrate` job → worker discovers tables (L1) → enqueues per-table L1 jobs → each L1 completion enqueues L2 → gate job waits for all L2 → marks run as `L2_COMPLETE`. All state stored in `profiling_run`, `source_table`, `source_column` tables.

**Tech Stack:** Go 1.22, PostgreSQL, `database/sql`, existing `jobqueue` + `worker` packages, `apiresponse` envelope pattern.

**Design doc:** `docs/plans/2026-03-25-profiling-sprint-b-design.md`
**Parent plan:** `docs/plans/MIGRATION_OVERHAUL.md` Part 2

---

## Task 1: Types — ProfilingRun, SourceTable, SourceColumn

**Files:**
- Modify: `platform/migration/models/types.go` (append after line 405)

**Step 1: Add profiling types to models/types.go**

Append these types after the existing `LineageSummary` struct:

```go
// --- Profiling Run Types (5-Level Progressive Profiling) ---

// ProfilingRunStatus represents the lifecycle state of a profiling run.
type ProfilingRunStatus string

const (
	ProfilingStatusInitiated      ProfilingRunStatus = "INITIATED"
	ProfilingStatusRunningL1      ProfilingRunStatus = "RUNNING_L1"
	ProfilingStatusRunningL2      ProfilingRunStatus = "RUNNING_L2"
	ProfilingStatusL2Complete     ProfilingRunStatus = "L2_COMPLETE"
	ProfilingStatusRunningL3      ProfilingRunStatus = "RUNNING_L3"
	ProfilingStatusRunningL4      ProfilingRunStatus = "RUNNING_L4"
	ProfilingStatusRunningL5      ProfilingRunStatus = "RUNNING_L5"
	ProfilingStatusComplete       ProfilingRunStatus = "COMPLETE"
	ProfilingStatusFailed         ProfilingRunStatus = "FAILED"
)

// SourceTableProfileStatus tracks per-table profiling progress.
type SourceTableProfileStatus string

const (
	TableProfilePending SourceTableProfileStatus = "PENDING"
	TableProfileL1Done  SourceTableProfileStatus = "L1_DONE"
	TableProfileL2Done  SourceTableProfileStatus = "L2_DONE"
	TableProfileSkipped SourceTableProfileStatus = "SKIPPED"
	TableProfileFailed  SourceTableProfileStatus = "FAILED"
)

// ProfilingRun represents a profiling run for an engagement.
type ProfilingRun struct {
	ID                  string             `json:"id"`
	EngagementID        string             `json:"engagement_id"`
	SourcePlatform      string             `json:"source_platform"`
	InitiatedBy         string             `json:"initiated_by"`
	Status              ProfilingRunStatus `json:"status"`
	LevelReached        *int               `json:"level_reached"`
	TotalSourceColumns  *int               `json:"total_source_columns"`
	TotalCanonicalFields *int              `json:"total_canonical_fields"`
	AutoMappedCount     *int               `json:"auto_mapped_count"`
	ReviewRequiredCount *int               `json:"review_required_count"`
	UnmappedCount       *int               `json:"unmapped_count"`
	OverallCoveragePct  *float64           `json:"overall_coverage_pct"`
	RuleSignalsFound    *int               `json:"rule_signals_found"`
	ReadinessAssessment *string            `json:"readiness_assessment"`
	ErrorMessage        *string            `json:"error_message"`
	InitiatedAt         time.Time          `json:"initiated_at"`
	CompletedAt         *time.Time         `json:"completed_at"`
}

// SourceTableRow represents a table discovered in the source database during profiling.
type SourceTableRow struct {
	ID              string                   `json:"id"`
	ProfilingRunID  string                   `json:"profiling_run_id"`
	SchemaName      *string                  `json:"schema_name"`
	TableName       string                   `json:"table_name"`
	RowCount        *int64                   `json:"row_count"`
	RowCountExact   bool                     `json:"row_count_exact"`
	EntityClass     *string                  `json:"entity_class"`
	ClassConfidence *float64                 `json:"class_confidence"`
	IsLikelyLookup  bool                     `json:"is_likely_lookup"`
	IsLikelyArchive bool                     `json:"is_likely_archive"`
	ProfileStatus   SourceTableProfileStatus `json:"profile_status"`
	Notes           *string                  `json:"notes"`
}

// TopValue represents a frequently occurring value in a column.
type TopValue struct {
	Value string  `json:"value"`
	Count int64   `json:"count"`
	Pct   float64 `json:"pct"`
}

// PatternFrequency represents a detected pattern in a column.
type PatternFrequency struct {
	Pattern string  `json:"pattern"`
	Label   string  `json:"label"`
	Count   int     `json:"count"`
	Pct     float64 `json:"pct"`
}

// SourceColumnRow represents a column discovered during L1, with stats populated during L2.
type SourceColumnRow struct {
	ID               string             `json:"id"`
	SourceTableID    string             `json:"source_table_id"`
	ColumnName       string             `json:"column_name"`
	OrdinalPosition  int                `json:"ordinal_position"`
	DataType         string             `json:"data_type"`
	MaxLength        *int               `json:"max_length"`
	IsNullable       bool               `json:"is_nullable"`
	IsPrimaryKey     bool               `json:"is_primary_key"`
	IsUnique         bool               `json:"is_unique"`
	// Level 2 stats (nil until L2 runs)
	RowCount         *int64             `json:"row_count"`
	NullCount        *int64             `json:"null_count"`
	NullPct          *float64           `json:"null_pct"`
	DistinctCount    *int64             `json:"distinct_count"`
	DistinctPct      *float64           `json:"distinct_pct"`
	MinValue         *string            `json:"min_value"`
	MaxValue         *string            `json:"max_value"`
	MeanValue        *float64           `json:"mean_value"`
	StddevValue      *float64           `json:"stddev_value"`
	TopValues        []TopValue         `json:"top_values"`
	PatternFreqs     []PatternFrequency `json:"pattern_frequencies"`
	SampleValues     []string           `json:"sample_values"`
	SampleSize       *int64             `json:"sample_size"`
	IsSampled        bool               `json:"is_sampled"`
}

// InitiateProfilingRequest is the JSON body for POST .../profiling-runs.
type InitiateProfilingRequest struct {
	SourcePlatform string `json:"source_platform"` // "postgres", "mssql", "ibm_i_db2"
}

// ProfilingInventoryResponse is returned by GET .../profiling-runs/{id}/inventory.
type ProfilingInventoryResponse struct {
	Tables []SourceTableWithColumns `json:"tables"`
}

// SourceTableWithColumns combines a source table with its columns.
type SourceTableWithColumns struct {
	SourceTableRow
	Columns []SourceColumnRow `json:"columns"`
}
```

**Step 2: Verify build**

Run: `cd platform/migration && go build ./...`
Expected: PASS (no compilation errors)

**Step 3: Commit**

```bash
git add platform/migration/models/types.go
git commit -m "[migration/models] Add profiling run, source table, source column types"
```

---

## Task 2: Migration 042 — profiling_run, source_table, source_column

**Files:**
- Create: `db/migrations/042_profiling_run.sql`

**Step 1: Write the migration**

```sql
-- Migration 042: Profiling run + source inventory tables (5-level progressive profiling)
-- Part of Migration Overhaul Part 2 — Sprint B

-- Profiling run record — one per engagement profiling session
CREATE TABLE IF NOT EXISTS migration.profiling_run (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id          UUID NOT NULL REFERENCES migration.engagement(engagement_id),
    source_platform        TEXT NOT NULL,
    initiated_by           TEXT NOT NULL,
    status                 TEXT NOT NULL DEFAULT 'INITIATED',
    level_reached          INT,
    total_source_columns   INT,
    total_canonical_fields INT,
    auto_mapped_count      INT,
    review_required_count  INT,
    unmapped_count         INT,
    overall_coverage_pct   NUMERIC(5,2),
    rule_signals_found     INT,
    readiness_assessment   TEXT,
    error_message          TEXT,
    initiated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_profiling_run_engagement ON migration.profiling_run(engagement_id);

-- Level 1: Source table inventory
CREATE TABLE IF NOT EXISTS migration.source_table (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profiling_run_id  UUID NOT NULL REFERENCES migration.profiling_run(id),
    schema_name       TEXT,
    table_name        TEXT NOT NULL,
    row_count         BIGINT,
    row_count_exact   BOOLEAN DEFAULT false,
    entity_class      TEXT,
    class_confidence  NUMERIC(4,3),
    is_likely_lookup  BOOLEAN DEFAULT false,
    is_likely_archive BOOLEAN DEFAULT false,
    profile_status    TEXT NOT NULL DEFAULT 'PENDING',
    notes             TEXT,
    UNIQUE(profiling_run_id, schema_name, table_name)
);
CREATE INDEX IF NOT EXISTS idx_source_table_run ON migration.source_table(profiling_run_id);

-- Level 1-2: Source column inventory + statistics
CREATE TABLE IF NOT EXISTS migration.source_column (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table_id   UUID NOT NULL REFERENCES migration.source_table(id),
    column_name       TEXT NOT NULL,
    ordinal_position  INT,
    data_type         TEXT NOT NULL,
    max_length        INT,
    is_nullable       BOOLEAN NOT NULL,
    is_primary_key    BOOLEAN DEFAULT false,
    is_unique         BOOLEAN DEFAULT false,
    -- Level 2 stats (populated by L2 executor)
    row_count         BIGINT,
    null_count        BIGINT,
    null_pct          NUMERIC(5,2),
    distinct_count    BIGINT,
    distinct_pct      NUMERIC(5,2),
    min_value         TEXT,
    max_value         TEXT,
    mean_value        NUMERIC,
    stddev_value      NUMERIC,
    top_values        JSONB,
    pattern_frequencies JSONB,
    sample_values     JSONB,
    sample_size       BIGINT,
    is_sampled        BOOLEAN DEFAULT false,
    UNIQUE(source_table_id, column_name)
);
CREATE INDEX IF NOT EXISTS idx_source_column_table ON migration.source_column(source_table_id);
```

**Step 2: Commit**

```bash
git add db/migrations/042_profiling_run.sql
git commit -m "[db/migrations] 042: profiling_run, source_table, source_column tables"
```

---

## Task 3: DB Layer — Profiling CRUD

**Files:**
- Create: `platform/migration/db/profiling.go`
- Test: `platform/migration/db/profiling_test.go`

**Step 1: Write the test file**

```go
package db

import (
	"testing"
)

func TestProfilingRunDBOperations(t *testing.T) {
	// These tests verify function signatures and nil handling.
	// Full integration tests require PostgreSQL (Tier 2).

	t.Run("CreateProfilingRun_NilDB_ReturnsError", func(t *testing.T) {
		_, err := CreateProfilingRun(nil, "eng-id", "postgres", "user-id")
		if err == nil {
			t.Fatal("expected error for nil db")
		}
	})

	t.Run("UpdateProfilingRunStatus_NilDB_ReturnsError", func(t *testing.T) {
		err := UpdateProfilingRunStatus(nil, "run-id", "RUNNING_L1", nil)
		if err == nil {
			t.Fatal("expected error for nil db")
		}
	})
}
```

**Step 2: Run test — verify it fails (functions don't exist yet)**

Run: `cd platform/migration && go test ./db/ -short -run TestProfilingRun -v`
Expected: FAIL — compilation errors

**Step 3: Write the implementation**

Create `platform/migration/db/profiling.go`:

```go
package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/noui/platform/migration/models"
)

// CreateProfilingRun inserts a new profiling run and returns it.
func CreateProfilingRun(db *sql.DB, engagementID, sourcePlatform, initiatedBy string) (*models.ProfilingRun, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	var run models.ProfilingRun
	err := db.QueryRow(
		`INSERT INTO migration.profiling_run (engagement_id, source_platform, initiated_by)
		 VALUES ($1, $2, $3)
		 RETURNING id, engagement_id, source_platform, initiated_by, status,
		           level_reached, initiated_at`,
		engagementID, sourcePlatform, initiatedBy,
	).Scan(&run.ID, &run.EngagementID, &run.SourcePlatform, &run.InitiatedBy,
		&run.Status, &run.LevelReached, &run.InitiatedAt)
	if err != nil {
		return nil, fmt.Errorf("create profiling run: %w", err)
	}
	return &run, nil
}

// GetProfilingRun returns a profiling run by ID.
func GetProfilingRun(db *sql.DB, runID string) (*models.ProfilingRun, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	var run models.ProfilingRun
	err := db.QueryRow(
		`SELECT id, engagement_id, source_platform, initiated_by, status,
		        level_reached, total_source_columns, total_canonical_fields,
		        auto_mapped_count, review_required_count, unmapped_count,
		        overall_coverage_pct, rule_signals_found, readiness_assessment,
		        error_message, initiated_at, completed_at
		 FROM migration.profiling_run WHERE id = $1`, runID,
	).Scan(&run.ID, &run.EngagementID, &run.SourcePlatform, &run.InitiatedBy,
		&run.Status, &run.LevelReached, &run.TotalSourceColumns, &run.TotalCanonicalFields,
		&run.AutoMappedCount, &run.ReviewRequiredCount, &run.UnmappedCount,
		&run.OverallCoveragePct, &run.RuleSignalsFound, &run.ReadinessAssessment,
		&run.ErrorMessage, &run.InitiatedAt, &run.CompletedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get profiling run: %w", err)
	}
	return &run, nil
}

// ListProfilingRuns returns all profiling runs for an engagement.
func ListProfilingRuns(db *sql.DB, engagementID string) ([]models.ProfilingRun, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	rows, err := db.Query(
		`SELECT id, engagement_id, source_platform, initiated_by, status,
		        level_reached, total_source_columns, overall_coverage_pct,
		        error_message, initiated_at, completed_at
		 FROM migration.profiling_run
		 WHERE engagement_id = $1
		 ORDER BY initiated_at DESC`, engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("list profiling runs: %w", err)
	}
	defer rows.Close()

	var runs []models.ProfilingRun
	for rows.Next() {
		var r models.ProfilingRun
		if err := rows.Scan(&r.ID, &r.EngagementID, &r.SourcePlatform, &r.InitiatedBy,
			&r.Status, &r.LevelReached, &r.TotalSourceColumns, &r.OverallCoveragePct,
			&r.ErrorMessage, &r.InitiatedAt, &r.CompletedAt); err != nil {
			return nil, fmt.Errorf("scan profiling run: %w", err)
		}
		runs = append(runs, r)
	}
	return runs, rows.Err()
}

// UpdateProfilingRunStatus updates the status and optionally the level_reached.
func UpdateProfilingRunStatus(db *sql.DB, runID string, status string, levelReached *int) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	var err error
	if levelReached != nil {
		_, err = db.Exec(
			`UPDATE migration.profiling_run SET status = $1, level_reached = $2 WHERE id = $3`,
			status, *levelReached, runID)
	} else {
		_, err = db.Exec(
			`UPDATE migration.profiling_run SET status = $1 WHERE id = $2`,
			status, runID)
	}
	if err != nil {
		return fmt.Errorf("update profiling run status: %w", err)
	}
	return nil
}

// CompleteProfilingRun marks a run as complete or failed.
func CompleteProfilingRun(db *sql.DB, runID, status string, errMsg *string) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	_, err := db.Exec(
		`UPDATE migration.profiling_run
		 SET status = $1, error_message = $2, completed_at = now()
		 WHERE id = $3`,
		status, errMsg, runID)
	if err != nil {
		return fmt.Errorf("complete profiling run: %w", err)
	}
	return nil
}

// InsertSourceTable inserts a source table discovered during L1.
func InsertSourceTable(db *sql.DB, t *models.SourceTableRow) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	return db.QueryRow(
		`INSERT INTO migration.source_table
		 (profiling_run_id, schema_name, table_name, row_count, row_count_exact,
		  entity_class, class_confidence, is_likely_lookup, is_likely_archive, profile_status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 RETURNING id`,
		t.ProfilingRunID, t.SchemaName, t.TableName, t.RowCount, t.RowCountExact,
		t.EntityClass, t.ClassConfidence, t.IsLikelyLookup, t.IsLikelyArchive, t.ProfileStatus,
	).Scan(&t.ID)
}

// UpdateSourceTableStatus updates the profile_status of a source table.
func UpdateSourceTableStatus(db *sql.DB, tableID string, status string) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	_, err := db.Exec(
		`UPDATE migration.source_table SET profile_status = $1 WHERE id = $2`,
		status, tableID)
	return err
}

// ListSourceTables returns all source tables for a profiling run.
func ListSourceTables(db *sql.DB, runID string) ([]models.SourceTableRow, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	rows, err := db.Query(
		`SELECT id, profiling_run_id, schema_name, table_name, row_count, row_count_exact,
		        entity_class, class_confidence, is_likely_lookup, is_likely_archive,
		        profile_status, notes
		 FROM migration.source_table
		 WHERE profiling_run_id = $1
		 ORDER BY table_name`, runID,
	)
	if err != nil {
		return nil, fmt.Errorf("list source tables: %w", err)
	}
	defer rows.Close()

	var tables []models.SourceTableRow
	for rows.Next() {
		var t models.SourceTableRow
		if err := rows.Scan(&t.ID, &t.ProfilingRunID, &t.SchemaName, &t.TableName,
			&t.RowCount, &t.RowCountExact, &t.EntityClass, &t.ClassConfidence,
			&t.IsLikelyLookup, &t.IsLikelyArchive, &t.ProfileStatus, &t.Notes); err != nil {
			return nil, fmt.Errorf("scan source table: %w", err)
		}
		tables = append(tables, t)
	}
	return tables, rows.Err()
}

// InsertSourceColumn inserts a column discovered during L1.
func InsertSourceColumn(db *sql.DB, c *models.SourceColumnRow) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	return db.QueryRow(
		`INSERT INTO migration.source_column
		 (source_table_id, column_name, ordinal_position, data_type, max_length,
		  is_nullable, is_primary_key, is_unique)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id`,
		c.SourceTableID, c.ColumnName, c.OrdinalPosition, c.DataType, c.MaxLength,
		c.IsNullable, c.IsPrimaryKey, c.IsUnique,
	).Scan(&c.ID)
}

// UpdateColumnStats updates Level 2 statistics on a source column.
func UpdateColumnStats(db *sql.DB, colID string, stats *models.SourceColumnRow) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	topJSON, _ := json.Marshal(stats.TopValues)
	patJSON, _ := json.Marshal(stats.PatternFreqs)
	sampleJSON, _ := json.Marshal(stats.SampleValues)

	_, err := db.Exec(
		`UPDATE migration.source_column SET
		 row_count = $1, null_count = $2, null_pct = $3,
		 distinct_count = $4, distinct_pct = $5,
		 min_value = $6, max_value = $7, mean_value = $8, stddev_value = $9,
		 top_values = $10, pattern_frequencies = $11, sample_values = $12,
		 sample_size = $13, is_sampled = $14
		 WHERE id = $15`,
		stats.RowCount, stats.NullCount, stats.NullPct,
		stats.DistinctCount, stats.DistinctPct,
		stats.MinValue, stats.MaxValue, stats.MeanValue, stats.StddevValue,
		topJSON, patJSON, sampleJSON,
		stats.SampleSize, stats.IsSampled, colID)
	return err
}

// ListSourceColumns returns all columns for a source table.
func ListSourceColumns(db *sql.DB, tableID string) ([]models.SourceColumnRow, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	rows, err := db.Query(
		`SELECT id, source_table_id, column_name, ordinal_position, data_type, max_length,
		        is_nullable, is_primary_key, is_unique,
		        row_count, null_count, null_pct, distinct_count, distinct_pct,
		        min_value, max_value, mean_value, stddev_value,
		        top_values, pattern_frequencies, sample_values, sample_size, is_sampled
		 FROM migration.source_column
		 WHERE source_table_id = $1
		 ORDER BY ordinal_position`, tableID,
	)
	if err != nil {
		return nil, fmt.Errorf("list source columns: %w", err)
	}
	defer rows.Close()

	var cols []models.SourceColumnRow
	for rows.Next() {
		var c models.SourceColumnRow
		var topJSON, patJSON, sampleJSON []byte
		if err := rows.Scan(&c.ID, &c.SourceTableID, &c.ColumnName, &c.OrdinalPosition,
			&c.DataType, &c.MaxLength, &c.IsNullable, &c.IsPrimaryKey, &c.IsUnique,
			&c.RowCount, &c.NullCount, &c.NullPct, &c.DistinctCount, &c.DistinctPct,
			&c.MinValue, &c.MaxValue, &c.MeanValue, &c.StddevValue,
			&topJSON, &patJSON, &sampleJSON, &c.SampleSize, &c.IsSampled); err != nil {
			return nil, fmt.Errorf("scan source column: %w", err)
		}
		if topJSON != nil {
			_ = json.Unmarshal(topJSON, &c.TopValues)
		}
		if patJSON != nil {
			_ = json.Unmarshal(patJSON, &c.PatternFreqs)
		}
		if sampleJSON != nil {
			_ = json.Unmarshal(sampleJSON, &c.SampleValues)
		}
		cols = append(cols, c)
	}
	return cols, rows.Err()
}

// CountSourceTablesByStatus counts tables in each profile_status for a run.
func CountSourceTablesByStatus(db *sql.DB, runID string) (map[string]int, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	rows, err := db.Query(
		`SELECT profile_status, COUNT(*) FROM migration.source_table
		 WHERE profiling_run_id = $1 GROUP BY profile_status`, runID)
	if err != nil {
		return nil, fmt.Errorf("count source tables: %w", err)
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		counts[status] = count
	}
	return counts, rows.Err()
}
```

**Step 4: Run test — verify it passes**

Run: `cd platform/migration && go test ./db/ -short -run TestProfilingRun -v`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/migration/db/profiling.go platform/migration/db/profiling_test.go
git commit -m "[migration/db] Add profiling run, source table, source column CRUD"
```

---

## Task 4: Pension Pattern Detectors (Expanded)

**Files:**
- Create: `platform/migration/profiler/pension_patterns.go`
- Create: `platform/migration/profiler/pension_patterns_test.go`

The plan specifies 10 named patterns. The existing `patterns.go` has 7 patterns but they're embedded in the `DetectPatterns` function. The new file provides a clean, named map matching the plan spec.

**Step 1: Write the test**

```go
package profiler

import (
	"testing"
)

func TestPensionPatterns(t *testing.T) {
	tests := []struct {
		name    string
		pattern string
		match   []string
		noMatch []string
	}{
		{
			name:    "CYYMMDD (AS400 date)",
			pattern: "CYYMMDD",
			match:   []string{"1250315", "0990101", "1260101"},
			noMatch: []string{"2250315", "12503", "12503150", "abc"},
		},
		{
			name:    "YYYYMMDD packed date",
			pattern: "YYYYMMDD",
			match:   []string{"20250315", "19650101", "20001231"},
			noMatch: []string{"18501231", "21001231", "2025031", "202503150"},
		},
		{
			name:    "IMPLICIT_2DEC (integer cents)",
			pattern: "IMPLICIT_2DEC",
			match:   []string{"18450", "32100", "0", "95600", "123456789012"},
			noMatch: []string{"184.50", "abc", "-100", "1234567890123"},
		},
		{
			name:    "PCT_WHOLE (percentage as integer)",
			pattern: "PCT_WHOLE",
			match:   []string{"3", "25", "100", "0"},
			noMatch: []string{"3.5", "1000", "abc"},
		},
		{
			name:    "TIER_CODE",
			pattern: "TIER_CODE",
			match:   []string{"T1", "AB", "A", "T2B1"},
			noMatch: []string{"TOOLONG", "t1", "12345"},
		},
		{
			name:    "STATUS_CODE",
			pattern: "STATUS_CODE",
			match:   []string{"A", "RT", "AC"},
			noMatch: []string{"ABC", "1", "a", ""},
		},
		{
			name:    "MEMBER_NUM",
			pattern: "MEMBER_NUM",
			match:   []string{"A123456", "1234567890", "123456"},
			noMatch: []string{"12345", "AB123456", "12345678901"},
		},
		{
			name:    "SSN (no dashes)",
			pattern: "SSN",
			match:   []string{"123456789", "000000000"},
			noMatch: []string{"12345678", "1234567890", "123-45-6789"},
		},
		{
			name:    "FISCAL_YEAR",
			pattern: "FISCAL_YEAR",
			match:   []string{"2025", "1965", "2000"},
			noMatch: []string{"1899", "2100", "202", "20250"},
		},
		{
			name:    "SSN_DASHED",
			pattern: "SSN_DASHED",
			match:   []string{"123-45-6789", "000-00-0000"},
			noMatch: []string{"123456789", "123-456789", "12-345-6789"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			re, ok := PensionPatterns[tt.pattern]
			if !ok {
				t.Fatalf("pattern %q not found in PensionPatterns map", tt.pattern)
			}
			for _, v := range tt.match {
				if !re.MatchString(v) {
					t.Errorf("expected %q to match pattern %s", v, tt.pattern)
				}
			}
			for _, v := range tt.noMatch {
				if re.MatchString(v) {
					t.Errorf("expected %q NOT to match pattern %s", v, tt.pattern)
				}
			}
		})
	}
}

func TestPensionPatternCount(t *testing.T) {
	if len(PensionPatterns) < 10 {
		t.Errorf("expected at least 10 pension patterns, got %d", len(PensionPatterns))
	}
}
```

**Step 2: Run test — verify it fails**

Run: `cd platform/migration && go test ./profiler/ -short -run TestPension -v`
Expected: FAIL (PensionPatterns undefined)

**Step 3: Write the implementation**

```go
package profiler

import "regexp"

// PensionPatterns is the named map of pension-domain encoding patterns.
// Used by Level 2 profiling to classify column data formats.
// Each key is a short pattern identifier; the value is a compiled regex.
var PensionPatterns = map[string]*regexp.Regexp{
	"CYYMMDD":      regexp.MustCompile(`^[01]\d{6}$`),            // AS400 century-encoded date
	"YYYYMMDD":     regexp.MustCompile(`^(19|20)\d{6}$`),         // ISO date as integer
	"IMPLICIT_2DEC": regexp.MustCompile(`^\d{1,12}$`),            // Amounts stored as integer cents
	"PCT_WHOLE":    regexp.MustCompile(`^\d{1,3}$`),              // Percentage as whole number (0-999)
	"TIER_CODE":    regexp.MustCompile(`^[A-Z0-9]{1,4}$`),        // Plan tier designation
	"STATUS_CODE":  regexp.MustCompile(`^[A-Z]{1,2}$`),           // Status codes (A, RT, etc.)
	"MEMBER_NUM":   regexp.MustCompile(`^[A-Z]?\d{6,10}$`),       // Member number with optional prefix
	"SSN":          regexp.MustCompile(`^\d{9}$`),                 // SSN without dashes
	"SSN_DASHED":   regexp.MustCompile(`^\d{3}-\d{2}-\d{4}$`),    // SSN with dashes
	"FISCAL_YEAR":  regexp.MustCompile(`^(19|20)\d{2}$`),          // 4-digit fiscal year
}

// PensionPatternLabels provides human-readable labels for each pattern key.
var PensionPatternLabels = map[string]string{
	"CYYMMDD":       "CYYMMDD century-encoded date (AS400)",
	"YYYYMMDD":      "YYYYMMDD packed date",
	"IMPLICIT_2DEC": "Implicit decimal (integer cents/units)",
	"PCT_WHOLE":     "Percentage as whole number",
	"TIER_CODE":     "Plan tier/code designation",
	"STATUS_CODE":   "Short alpha status code",
	"MEMBER_NUM":    "Member ID number",
	"SSN":           "SSN without dashes",
	"SSN_DASHED":    "SSN with dashes (NNN-NN-NNNN)",
	"FISCAL_YEAR":   "4-digit fiscal year",
}
```

**Step 4: Run test — verify it passes**

Run: `cd platform/migration && go test ./profiler/ -short -run TestPension -v`
Expected: PASS (10/10 pattern tests + count check)

**Step 5: Commit**

```bash
git add platform/migration/profiler/pension_patterns.go platform/migration/profiler/pension_patterns_test.go
git commit -m "[migration/profiler] Add 10 named pension pattern detectors with tests"
```

---

## Task 5: Sampling Strategy

**Files:**
- Create: `platform/migration/profiler/sampling.go`
- Create: `platform/migration/profiler/sampling_test.go`

**Step 1: Write the test**

```go
package profiler

import "testing"

func TestSamplingDecision(t *testing.T) {
	tests := []struct {
		name        string
		rowEstimate int64
		driver      string
		wantSample  bool
		wantMethod  string
	}{
		{"small_pg", 500_000, "postgres", false, ""},
		{"large_pg", 2_000_000, "postgres", true, "TABLESAMPLE BERNOULLI(1) REPEATABLE(42)"},
		{"exact_threshold_pg", 1_000_000, "postgres", false, ""},
		{"above_threshold_pg", 1_000_001, "postgres", true, "TABLESAMPLE BERNOULLI(1) REPEATABLE(42)"},
		{"large_mssql", 2_000_000, "mssql", true, "TABLESAMPLE SYSTEM(1 PERCENT)"},
		{"small_mssql", 500_000, "mssql", false, ""},
		{"unknown_driver", 2_000_000, "oracle", true, "LIMIT"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := SamplingDecision(tt.rowEstimate, tt.driver)
			if d.UseSampling != tt.wantSample {
				t.Errorf("UseSampling = %v, want %v", d.UseSampling, tt.wantSample)
			}
			if tt.wantSample && d.Method != tt.wantMethod {
				t.Errorf("Method = %q, want %q", d.Method, tt.wantMethod)
			}
		})
	}
}

func TestRowCountStrategy(t *testing.T) {
	tests := []struct {
		name       string
		driver     string
		wantExact  bool
	}{
		{"postgres_uses_catalog", "postgres", false},
		{"mssql_uses_catalog", "mssql", false},
		{"unknown_uses_exact", "oracle", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := RowCountStrategy(tt.driver)
			if s.CatalogEstimateAvailable != !tt.wantExact {
				t.Errorf("CatalogEstimateAvailable = %v, want %v", s.CatalogEstimateAvailable, !tt.wantExact)
			}
		})
	}
}
```

**Step 2: Run test — verify it fails**

Run: `cd platform/migration && go test ./profiler/ -short -run TestSampling -v`
Expected: FAIL

**Step 3: Write the implementation**

```go
package profiler

// SamplingThreshold is the row count above which we use sampling for column stats.
const SamplingThreshold int64 = 1_000_000

// SamplingResult describes whether to use sampling and which method.
type SamplingResult struct {
	UseSampling bool
	Method      string // empty if UseSampling is false
}

// SamplingDecision returns the sampling strategy for a table based on its estimated
// row count and the source database driver.
func SamplingDecision(rowEstimate int64, driver string) SamplingResult {
	if rowEstimate <= SamplingThreshold {
		return SamplingResult{UseSampling: false}
	}
	switch driver {
	case "postgres":
		return SamplingResult{UseSampling: true, Method: "TABLESAMPLE BERNOULLI(1) REPEATABLE(42)"}
	case "mssql":
		return SamplingResult{UseSampling: true, Method: "TABLESAMPLE SYSTEM(1 PERCENT)"}
	default:
		// Fallback: use LIMIT-based sampling
		return SamplingResult{UseSampling: true, Method: "LIMIT"}
	}
}

// RowCountEstimate describes how to get a table's row count.
type RowCountEstimate struct {
	CatalogEstimateAvailable bool
	CatalogQuery             string // SQL to get estimate from catalog
}

// RowCountStrategy returns the row count estimation strategy for a database driver.
// Catalog estimates are fast but approximate; exact COUNT(*) is slow for large tables.
func RowCountStrategy(driver string) RowCountEstimate {
	switch driver {
	case "postgres":
		return RowCountEstimate{
			CatalogEstimateAvailable: true,
			CatalogQuery:             `SELECT reltuples::BIGINT FROM pg_class WHERE relname = $1`,
		}
	case "mssql":
		return RowCountEstimate{
			CatalogEstimateAvailable: true,
			CatalogQuery: `SELECT SUM(row_count) FROM sys.dm_db_partition_stats
			               WHERE object_id = OBJECT_ID(@p1) AND index_id IN (0, 1)`,
		}
	default:
		return RowCountEstimate{CatalogEstimateAvailable: false}
	}
}
```

**Step 4: Run test — verify it passes**

Run: `cd platform/migration && go test ./profiler/ -short -run TestSampling -v`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/migration/profiler/sampling.go platform/migration/profiler/sampling_test.go
git commit -m "[migration/profiler] Add sampling strategy with driver-specific methods"
```

---

## Task 6: Level 1 Executor — Table + Column Discovery

**Files:**
- Create: `platform/migration/worker/profile_l1_executor.go`
- Create: `platform/migration/worker/profile_l1_executor_test.go`

**Step 1: Write the test**

```go
package worker

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/noui/platform/migration/jobqueue"
)

func TestL1ExecutorInputParsing(t *testing.T) {
	t.Run("valid_input", func(t *testing.T) {
		input := L1Input{
			ProfilingRunID: "run-123",
			EngagementID:   "eng-456",
			SchemaName:     "public",
			TableName:      "members",
			SourcePlatform: "postgres",
		}
		data, _ := json.Marshal(input)

		var parsed L1Input
		if err := json.Unmarshal(data, &parsed); err != nil {
			t.Fatalf("failed to parse: %v", err)
		}
		if parsed.ProfilingRunID != "run-123" {
			t.Errorf("ProfilingRunID = %q, want %q", parsed.ProfilingRunID, "run-123")
		}
		if parsed.TableName != "members" {
			t.Errorf("TableName = %q, want %q", parsed.TableName, "members")
		}
	})

	t.Run("implements_executor_interface", func(t *testing.T) {
		var _ Executor = &L1Executor{}
	})
}
```

**Step 2: Run test — verify it fails**

Run: `cd platform/migration && go test ./worker/ -short -run TestL1 -v`
Expected: FAIL

**Step 3: Write the implementation**

```go
package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"

	migdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
	"github.com/noui/platform/migration/profiler"
)

// L1Input is the job input for a profile_l1 job.
type L1Input struct {
	ProfilingRunID string `json:"profiling_run_id"`
	EngagementID   string `json:"engagement_id"`
	SchemaName     string `json:"schema_name"`
	TableName      string `json:"table_name"`
	SourcePlatform string `json:"source_platform"`
}

// L1Result is the job result for a profile_l1 job.
type L1Result struct {
	SourceTableID string `json:"source_table_id"`
	ColumnCount   int    `json:"column_count"`
	RowEstimate   int64  `json:"row_estimate"`
	EntityClass   string `json:"entity_class,omitempty"`
}

// L1Executor discovers columns and estimates row count for a single source table.
type L1Executor struct {
	// SourceDB is the connection to the source database (not the migration DB).
	// In production, resolved from engagement.source_connection.
	// For dev/test, can be injected directly.
	SourceDB *sql.DB
}

// Execute runs the Level 1 profiling job for a single table.
func (e *L1Executor) Execute(ctx context.Context, job *jobqueue.Job, q *jobqueue.Queue, migrationDB *sql.DB) error {
	if err := q.MarkRunning(ctx, job.JobID); err != nil {
		return fmt.Errorf("mark running: %w", err)
	}

	var input L1Input
	if err := json.Unmarshal(job.InputJSON, &input); err != nil {
		return fmt.Errorf("parse L1 input: %w", err)
	}

	slog.Info("L1 profiling table",
		"table", input.TableName,
		"schema", input.SchemaName,
		"run_id", input.ProfilingRunID,
	)

	sourceDB := e.SourceDB
	if sourceDB == nil {
		// Resolve source connection from engagement record.
		sourceDB, err := resolveSourceDB(ctx, migrationDB, input.EngagementID)
		if err != nil {
			return fmt.Errorf("resolve source DB: %w", err)
		}
		defer sourceDB.Close()
		_ = sourceDB // use resolved
	}

	// Step 1: Estimate row count using catalog or exact COUNT.
	rowEstimate, exact, err := estimateRowCount(ctx, sourceDB, input.SourcePlatform, input.SchemaName, input.TableName)
	if err != nil {
		return fmt.Errorf("estimate row count: %w", err)
	}

	// Step 2: Insert source_table row.
	tableRow := &models.SourceTableRow{
		ProfilingRunID: input.ProfilingRunID,
		SchemaName:     strPtr(input.SchemaName),
		TableName:      input.TableName,
		RowCount:       &rowEstimate,
		RowCountExact:  exact,
		ProfileStatus:  models.TableProfilePending,
	}

	// Step 3: Classify table using heuristic concept tags.
	entityClass, confidence := classifyTable(input.TableName)
	if entityClass != "" {
		tableRow.EntityClass = &entityClass
		tableRow.ClassConfidence = &confidence
	}

	// Detect archive/lookup patterns.
	tableRow.IsLikelyArchive = isLikelyArchive(input.TableName)
	tableRow.IsLikelyLookup = isLikelyLookup(input.TableName, rowEstimate)

	if err := migdb.InsertSourceTable(migrationDB, tableRow); err != nil {
		return fmt.Errorf("insert source table: %w", err)
	}

	// Step 4: Discover columns.
	columns, err := discoverColumns(ctx, sourceDB, input.SchemaName, input.TableName)
	if err != nil {
		return fmt.Errorf("discover columns: %w", err)
	}

	for i := range columns {
		columns[i].SourceTableID = tableRow.ID
		if err := migdb.InsertSourceColumn(migrationDB, &columns[i]); err != nil {
			return fmt.Errorf("insert column %s: %w", columns[i].ColumnName, err)
		}
	}

	// Step 5: Mark table as L1_DONE.
	if err := migdb.UpdateSourceTableStatus(migrationDB, tableRow.ID, string(models.TableProfileL1Done)); err != nil {
		return fmt.Errorf("update table status: %w", err)
	}

	_ = q.UpdateProgress(ctx, job.JobID, 100)

	// Step 6: Enqueue L2 job for this table.
	l2Input := L2Input{
		ProfilingRunID: input.ProfilingRunID,
		EngagementID:   input.EngagementID,
		SourceTableID:  tableRow.ID,
		SchemaName:     input.SchemaName,
		TableName:      input.TableName,
		SourcePlatform: input.SourcePlatform,
		RowEstimate:    rowEstimate,
	}
	l2Data, _ := json.Marshal(l2Input)
	// Priority: smaller tables first (higher priority number = lower row count).
	priority := 1000 - int(rowEstimate/100_000)
	if priority < 0 {
		priority = 0
	}
	_, err = q.Enqueue(ctx, jobqueue.EnqueueParams{
		EngagementID: input.EngagementID,
		JobType:      "profile_l2",
		Scope:        input.TableName,
		Priority:     priority,
		InputJSON:    l2Data,
	})
	if err != nil {
		slog.Warn("failed to enqueue L2 job", "error", err, "table", input.TableName)
	}

	result := L1Result{
		SourceTableID: tableRow.ID,
		ColumnCount:   len(columns),
		RowEstimate:   rowEstimate,
	}
	if entityClass != "" {
		result.EntityClass = entityClass
	}
	resultJSON, _ := json.Marshal(result)
	return q.Complete(ctx, job.JobID, resultJSON)
}

// estimateRowCount returns a row count estimate. Uses catalog for large tables.
func estimateRowCount(ctx context.Context, sourceDB *sql.DB, driver, schema, table string) (int64, bool, error) {
	strategy := profiler.RowCountStrategy(driver)

	if strategy.CatalogEstimateAvailable {
		var estimate int64
		qualifiedName := table
		if schema != "" {
			qualifiedName = schema + "." + table
		}
		err := sourceDB.QueryRowContext(ctx, strategy.CatalogQuery, qualifiedName).Scan(&estimate)
		if err == nil && estimate > 0 {
			// If estimate is small enough, do exact count.
			if estimate <= profiler.SamplingThreshold {
				return exactCount(ctx, sourceDB, schema, table)
			}
			return estimate, false, nil
		}
		// Fallback to exact count if catalog fails.
	}

	return exactCount(ctx, sourceDB, schema, table)
}

// exactCount does SELECT COUNT(*) on the source table.
func exactCount(ctx context.Context, db *sql.DB, schema, table string) (int64, bool, error) {
	qualified := table
	if schema != "" {
		qualified = schema + "." + table
	}
	quoted, err := profiler.QuoteIdent(qualified)
	if err != nil {
		return 0, false, err
	}
	var count int64
	err = db.QueryRowContext(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s", quoted)).Scan(&count)
	return count, true, err
}

// discoverColumns reads column metadata from information_schema.
func discoverColumns(ctx context.Context, db *sql.DB, schema, table string) ([]models.SourceColumnRow, error) {
	query := `SELECT column_name, ordinal_position, data_type,
	                 character_maximum_length, is_nullable
	          FROM information_schema.columns
	          WHERE table_name = $1`
	args := []any{table}
	if schema != "" {
		query += ` AND table_schema = $2`
		args = append(args, schema)
	}
	query += ` ORDER BY ordinal_position`

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("discover columns: %w", err)
	}
	defer rows.Close()

	var cols []models.SourceColumnRow
	for rows.Next() {
		var c models.SourceColumnRow
		var nullable string
		if err := rows.Scan(&c.ColumnName, &c.OrdinalPosition, &c.DataType,
			&c.MaxLength, &nullable); err != nil {
			return nil, fmt.Errorf("scan column: %w", err)
		}
		c.IsNullable = nullable == "YES"
		cols = append(cols, c)
	}
	return cols, rows.Err()
}

// classifyTable uses heuristic substring matching (same as existing conceptTagHeuristics).
func classifyTable(tableName string) (string, float64) {
	// Simple heuristic — to be replaced by AI classification in Sprint C.
	heuristics := map[string]string{
		"member":     "employee-master",
		"employee":   "employee-master",
		"empl":       "employee-master",
		"salary":     "salary-history",
		"sal_hist":   "salary-history",
		"earnings":   "salary-history",
		"contrib":    "contribution-record",
		"employment": "employment-dates",
		"plan_mem":   "plan-enrollment",
		"enrollment": "plan-enrollment",
		"beneficiary": "beneficiary-record",
		"payment":    "payment-history",
		"benefit":    "benefit-record",
		"code":       "code-mappings",
	}

	lower := strings.ToLower(tableName)
	for substr, concept := range heuristics {
		if strings.Contains(lower, substr) {
			return concept, 0.70 // heuristic confidence
		}
	}
	return "", 0
}

// isLikelyArchive checks for archive table naming patterns.
func isLikelyArchive(tableName string) bool {
	lower := strings.ToLower(tableName)
	return strings.Contains(lower, "archive") ||
		strings.Contains(lower, "_bak") ||
		strings.Contains(lower, "_old") ||
		strings.HasSuffix(lower, "_hist") && strings.Contains(lower, "audit")
}

// isLikelyLookup checks for lookup table patterns (small + naming convention).
func isLikelyLookup(tableName string, rowCount int64) bool {
	if rowCount > 1000 {
		return false
	}
	lower := strings.ToLower(tableName)
	return strings.Contains(lower, "lookup") ||
		strings.Contains(lower, "_lkp") ||
		strings.Contains(lower, "_ref") ||
		strings.HasPrefix(lower, "code_") ||
		strings.HasPrefix(lower, "ref_")
}

// resolveSourceDB opens a connection to the source database using the engagement's
// stored source_connection. Caller must close the returned *sql.DB.
func resolveSourceDB(ctx context.Context, migrationDB *sql.DB, engagementID string) (*sql.DB, error) {
	// Read source_connection JSONB from engagement record.
	var connJSON []byte
	err := migrationDB.QueryRowContext(ctx,
		`SELECT source_connection FROM migration.engagement WHERE engagement_id = $1`,
		engagementID).Scan(&connJSON)
	if err != nil {
		return nil, fmt.Errorf("read source connection: %w", err)
	}
	if connJSON == nil {
		return nil, fmt.Errorf("no source connection configured for engagement %s", engagementID)
	}

	var conn models.SourceConnection
	if err := json.Unmarshal(connJSON, &conn); err != nil {
		return nil, fmt.Errorf("parse source connection: %w", err)
	}

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		conn.Host, conn.Port, conn.User, conn.Password, conn.DBName, conn.SSLMode)

	return sql.Open(conn.Driver, dsn)
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
```

Note: Add missing imports: `"fmt"`, `"strings"` to the import block.

**Step 4: Run test — verify it passes**

Run: `cd platform/migration && go test ./worker/ -short -run TestL1 -v`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/migration/worker/profile_l1_executor.go platform/migration/worker/profile_l1_executor_test.go
git commit -m "[migration/worker] Add L1 executor: table/column discovery, heuristic classification"
```

---

## Task 7: Level 2 Executor — Column Statistics + Pension Patterns

**Files:**
- Create: `platform/migration/worker/profile_l2_executor.go`
- Create: `platform/migration/worker/profile_l2_executor_test.go`

**Step 1: Write the test**

```go
package worker

import (
	"encoding/json"
	"testing"
)

func TestL2ExecutorInputParsing(t *testing.T) {
	input := L2Input{
		ProfilingRunID: "run-1",
		EngagementID:   "eng-1",
		SourceTableID:  "tbl-1",
		TableName:      "members",
		SourcePlatform: "postgres",
		RowEstimate:    50000,
	}
	data, _ := json.Marshal(input)

	var parsed L2Input
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to parse: %v", err)
	}
	if parsed.RowEstimate != 50000 {
		t.Errorf("RowEstimate = %d, want 50000", parsed.RowEstimate)
	}
}

func TestL2ExecutorInterface(t *testing.T) {
	var _ Executor = &L2Executor{}
}
```

**Step 2: Run test — verify it fails**

Run: `cd platform/migration && go test ./worker/ -short -run TestL2 -v`

**Step 3: Write the implementation**

```go
package worker

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	migdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
	"github.com/noui/platform/migration/profiler"
)

// L2Input is the job input for a profile_l2 job.
type L2Input struct {
	ProfilingRunID string `json:"profiling_run_id"`
	EngagementID   string `json:"engagement_id"`
	SourceTableID  string `json:"source_table_id"`
	SchemaName     string `json:"schema_name"`
	TableName      string `json:"table_name"`
	SourcePlatform string `json:"source_platform"`
	RowEstimate    int64  `json:"row_estimate"`
}

// L2Result is the job result for a profile_l2 job.
type L2Result struct {
	ColumnsProfiled int `json:"columns_profiled"`
	PatternsFound   int `json:"patterns_found"`
}

// L2Executor computes column-level statistics and detects pension patterns.
type L2Executor struct {
	SourceDB *sql.DB // injected for dev/test; nil = resolve from engagement
}

// Execute runs Level 2 profiling for a single table's columns.
func (e *L2Executor) Execute(ctx context.Context, job *jobqueue.Job, q *jobqueue.Queue, migrationDB *sql.DB) error {
	if err := q.MarkRunning(ctx, job.JobID); err != nil {
		return fmt.Errorf("mark running: %w", err)
	}

	var input L2Input
	if err := json.Unmarshal(job.InputJSON, &input); err != nil {
		return fmt.Errorf("parse L2 input: %w", err)
	}

	slog.Info("L2 profiling table",
		"table", input.TableName,
		"table_id", input.SourceTableID,
		"row_estimate", input.RowEstimate,
	)

	sourceDB := e.SourceDB
	if sourceDB == nil {
		resolved, err := resolveSourceDB(ctx, migrationDB, input.EngagementID)
		if err != nil {
			return fmt.Errorf("resolve source DB: %w", err)
		}
		defer resolved.Close()
		sourceDB = resolved
	}

	// Load columns from migration DB (inserted by L1).
	columns, err := migdb.ListSourceColumns(migrationDB, input.SourceTableID)
	if err != nil {
		return fmt.Errorf("list columns: %w", err)
	}

	sampling := profiler.SamplingDecision(input.RowEstimate, input.SourcePlatform)
	totalPatterns := 0

	for i, col := range columns {
		stats, err := computeColumnStats(ctx, sourceDB, input.SchemaName, input.TableName, col.ColumnName, col.DataType, sampling)
		if err != nil {
			slog.Warn("L2 stats failed for column", "column", col.ColumnName, "error", err)
			continue
		}

		// Detect pension patterns on text columns.
		patterns := detectPensionPatterns(stats.SampleValues, col.DataType)
		stats.PatternFreqs = patterns
		totalPatterns += len(patterns)

		if err := migdb.UpdateColumnStats(migrationDB, col.ID, stats); err != nil {
			slog.Warn("failed to save column stats", "column", col.ColumnName, "error", err)
		}

		// Progress: proportional to columns processed.
		progress := int(float64(i+1) / float64(len(columns)) * 100)
		_ = q.UpdateProgress(ctx, job.JobID, progress)
	}

	// Mark table as L2_DONE.
	if err := migdb.UpdateSourceTableStatus(migrationDB, input.SourceTableID, string(models.TableProfileL2Done)); err != nil {
		return fmt.Errorf("update table status: %w", err)
	}

	result := L2Result{ColumnsProfiled: len(columns), PatternsFound: totalPatterns}
	resultJSON, _ := json.Marshal(result)
	return q.Complete(ctx, job.JobID, resultJSON)
}

// computeColumnStats gathers statistics for a single column.
func computeColumnStats(ctx context.Context, db *sql.DB, schema, table, column, dataType string, sampling profiler.SamplingResult) (*models.SourceColumnRow, error) {
	qualified := table
	if schema != "" {
		qualified = schema + "." + table
	}
	quotedTable, err := profiler.QuoteIdent(qualified)
	if err != nil {
		return nil, err
	}
	quotedCol, err := profiler.QuoteIdent(column)
	if err != nil {
		return nil, err
	}

	stats := &models.SourceColumnRow{}

	// Basic counts: total, nulls, distinct.
	fromClause := quotedTable
	if sampling.UseSampling && sampling.Method != "LIMIT" {
		fromClause = fmt.Sprintf("%s %s", quotedTable, sampling.Method)
		stats.IsSampled = true
	}

	query := fmt.Sprintf(
		`SELECT COUNT(*), COUNT(*) - COUNT(%s), COUNT(DISTINCT %s) FROM %s`,
		quotedCol, quotedCol, fromClause)

	var total, nulls, distinct int64
	if err := db.QueryRowContext(ctx, query).Scan(&total, &nulls, &distinct); err != nil {
		return nil, fmt.Errorf("basic stats for %s: %w", column, err)
	}

	stats.RowCount = &total
	stats.NullCount = &nulls
	if total > 0 {
		nullPct := float64(nulls) / float64(total) * 100
		stats.NullPct = &nullPct
		distinctPct := float64(distinct) / float64(total) * 100
		stats.DistinctPct = &distinctPct
	}
	stats.DistinctCount = &distinct
	sampleSize := total
	stats.SampleSize = &sampleSize

	// Min/max for orderable types.
	if isOrderableType(dataType) {
		var minVal, maxVal sql.NullString
		minMaxQuery := fmt.Sprintf(
			`SELECT MIN(%s)::TEXT, MAX(%s)::TEXT FROM %s WHERE %s IS NOT NULL`,
			quotedCol, quotedCol, fromClause, quotedCol)
		if err := db.QueryRowContext(ctx, minMaxQuery).Scan(&minVal, &maxVal); err == nil {
			if minVal.Valid {
				stats.MinValue = &minVal.String
			}
			if maxVal.Valid {
				stats.MaxValue = &maxVal.String
			}
		}
	}

	// Top 20 values.
	topQuery := fmt.Sprintf(
		`SELECT %s::TEXT, COUNT(*) FROM %s WHERE %s IS NOT NULL
		 GROUP BY %s ORDER BY COUNT(*) DESC LIMIT 20`,
		quotedCol, fromClause, quotedCol, quotedCol)
	topRows, err := db.QueryContext(ctx, topQuery)
	if err == nil {
		defer topRows.Close()
		for topRows.Next() {
			var val string
			var count int64
			if topRows.Scan(&val, &count) == nil {
				pct := 0.0
				if total > 0 {
					pct = float64(count) / float64(total-nulls) * 100
				}
				stats.TopValues = append(stats.TopValues, models.TopValue{
					Value: val, Count: count, Pct: pct,
				})
			}
		}
	}

	// Sample 10 random non-null values.
	sampleQuery := fmt.Sprintf(
		`SELECT %s::TEXT FROM %s WHERE %s IS NOT NULL ORDER BY RANDOM() LIMIT 10`,
		quotedCol, fromClause, quotedCol)
	sampleRows, err := db.QueryContext(ctx, sampleQuery)
	if err == nil {
		defer sampleRows.Close()
		for sampleRows.Next() {
			var val string
			if sampleRows.Scan(&val) == nil {
				stats.SampleValues = append(stats.SampleValues, val)
			}
		}
	}

	return stats, nil
}

// detectPensionPatterns runs all pension patterns against sample values.
func detectPensionPatterns(sampleValues []string, dataType string) []models.PatternFrequency {
	if len(sampleValues) == 0 {
		return nil
	}

	// Only run on text-like types.
	lower := strings.ToLower(dataType)
	isText := strings.Contains(lower, "char") || strings.Contains(lower, "text") ||
		strings.Contains(lower, "varchar") || strings.Contains(lower, "nvarchar")
	if !isText {
		return nil
	}

	var results []models.PatternFrequency
	for name, re := range profiler.PensionPatterns {
		matched := 0
		for _, v := range sampleValues {
			if re.MatchString(v) {
				matched++
			}
		}
		if matched == 0 {
			continue
		}
		pct := float64(matched) / float64(len(sampleValues)) * 100
		if pct >= 50.0 { // MinMatchRate = 50%
			results = append(results, models.PatternFrequency{
				Pattern: name,
				Label:   profiler.PensionPatternLabels[name],
				Count:   matched,
				Pct:     pct,
			})
		}
	}
	return results
}

// isOrderableType returns true for types where MIN/MAX make sense.
func isOrderableType(dataType string) bool {
	lower := strings.ToLower(dataType)
	return strings.Contains(lower, "int") || strings.Contains(lower, "numeric") ||
		strings.Contains(lower, "decimal") || strings.Contains(lower, "float") ||
		strings.Contains(lower, "double") || strings.Contains(lower, "date") ||
		strings.Contains(lower, "timestamp") || strings.Contains(lower, "char") ||
		strings.Contains(lower, "text") || strings.Contains(lower, "varchar")
}
```

**Step 4: Run test — verify it passes**

Run: `cd platform/migration && go test ./worker/ -short -run TestL2 -v`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/migration/worker/profile_l2_executor.go platform/migration/worker/profile_l2_executor_test.go
git commit -m "[migration/worker] Add L2 executor: column stats, pension patterns, sampling"
```

---

## Task 8: Level Orchestrator + Gate

**Files:**
- Create: `platform/migration/profiler/levels.go`
- Create: `platform/migration/profiler/levels_test.go`

The orchestrator is also a job executor. It starts the profiling run, discovers tables, and enqueues L1 jobs.

**Step 1: Write the test**

```go
package profiler

import "testing"

func TestOrchestrateInputParsing(t *testing.T) {
	// Verify the type exists and is parseable.
	input := OrchestrateInput{
		ProfilingRunID: "run-1",
		EngagementID:   "eng-1",
		SourcePlatform: "postgres",
	}
	if input.ProfilingRunID != "run-1" {
		t.Errorf("unexpected run ID")
	}
}
```

**Step 2: Write the implementation**

Create `platform/migration/profiler/levels.go`:

```go
package profiler

// OrchestrateInput is the input for the profile_orchestrate job.
type OrchestrateInput struct {
	ProfilingRunID string `json:"profiling_run_id"`
	EngagementID   string `json:"engagement_id"`
	SourcePlatform string `json:"source_platform"`
}

// GateInput is the input for the profile_gate_l2 job.
type GateInput struct {
	ProfilingRunID string `json:"profiling_run_id"`
	EngagementID   string `json:"engagement_id"`
	TotalTables    int    `json:"total_tables"`
}

// QuoteIdent re-exports the existing quoteIdent for use by worker package.
func QuoteIdent(id string) (string, error) {
	return quoteIdent(id)
}
```

**Step 3: Run tests**

Run: `cd platform/migration && go test ./profiler/ -short -v`
Expected: PASS

**Step 4: Commit**

```bash
git add platform/migration/profiler/levels.go platform/migration/profiler/levels_test.go
git commit -m "[migration/profiler] Add orchestration + gate input types, export QuoteIdent"
```

---

## Task 9: Profiling API Handlers

**Files:**
- Create: `platform/migration/api/profiling_handlers.go`
- Modify: `platform/migration/api/handlers.go` (add routes, lines 41-49 area)

**Step 1: Write the handlers**

```go
package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	migdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
	"github.com/noui/platform/migration/profiler"
)

// InitiateProfilingRun handles POST /api/v1/migration/engagements/{id}/profiling-runs.
func (h *Handler) InitiateProfilingRun(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id required")
		return
	}

	var req models.InitiateProfilingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.SourcePlatform == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "source_platform required")
		return
	}

	userID := auth.UserID(r.Context())

	run, err := migdb.CreateProfilingRun(h.DB, engID, req.SourcePlatform, userID)
	if err != nil {
		slog.Error("failed to create profiling run", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to create profiling run")
		return
	}

	// Enqueue the orchestration job.
	if h.JobQueue != nil {
		orchInput := profiler.OrchestrateInput{
			ProfilingRunID: run.ID,
			EngagementID:   engID,
			SourcePlatform: req.SourcePlatform,
		}
		inputJSON, _ := json.Marshal(orchInput)
		_, err := h.JobQueue.Enqueue(r.Context(), jobqueue.EnqueueParams{
			EngagementID: engID,
			JobType:      "profile_orchestrate",
			Scope:        "run:" + run.ID,
			Priority:     100,
			InputJSON:    inputJSON,
		})
		if err != nil {
			slog.Error("failed to enqueue orchestration job", "error", err)
			// Run is created but job failed — update status.
			errMsg := err.Error()
			_ = migdb.CompleteProfilingRun(h.DB, run.ID, string(models.ProfilingStatusFailed), &errMsg)
			apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "JOB_ENQUEUE_FAILED", "failed to start profiling")
			return
		}
	}

	h.broadcast(engID, "profiling_started", map[string]string{"run_id": run.ID})
	apiresponse.WriteSuccess(w, http.StatusCreated, "migration", run)
}

// ListProfilingRuns handles GET /api/v1/migration/engagements/{id}/profiling-runs.
func (h *Handler) ListProfilingRuns(w http.ResponseWriter, r *http.Request) {
	engID := r.PathValue("id")
	if engID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id required")
		return
	}

	runs, err := migdb.ListProfilingRuns(h.DB, engID)
	if err != nil {
		slog.Error("failed to list profiling runs", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list profiling runs")
		return
	}
	if runs == nil {
		runs = []models.ProfilingRun{}
	}
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", runs)
}

// GetProfilingRun handles GET /api/v1/migration/profiling-runs/{run_id}.
func (h *Handler) GetProfilingRun(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("run_id")
	if runID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "run_id required")
		return
	}

	run, err := migdb.GetProfilingRun(h.DB, runID)
	if err != nil {
		slog.Error("failed to get profiling run", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get profiling run")
		return
	}
	if run == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "profiling run not found")
		return
	}
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", run)
}

// GetProfilingInventory handles GET /api/v1/migration/profiling-runs/{run_id}/inventory.
func (h *Handler) GetProfilingInventory(w http.ResponseWriter, r *http.Request) {
	runID := r.PathValue("run_id")
	if runID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "run_id required")
		return
	}

	tables, err := migdb.ListSourceTables(h.DB, runID)
	if err != nil {
		slog.Error("failed to list source tables", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list inventory")
		return
	}

	var result []models.SourceTableWithColumns
	for _, t := range tables {
		cols, err := migdb.ListSourceColumns(h.DB, t.ID)
		if err != nil {
			slog.Warn("failed to list columns for table", "table_id", t.ID, "error", err)
			cols = []models.SourceColumnRow{}
		}
		result = append(result, models.SourceTableWithColumns{
			SourceTableRow: t,
			Columns:        cols,
		})
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", models.ProfilingInventoryResponse{Tables: result})
}
```

**Step 2: Register routes in handlers.go**

Add after the existing quality profiling routes (after line 49):

```go
	// 5-Level profiling runs
	mux.HandleFunc("POST /api/v1/migration/engagements/{id}/profiling-runs", h.InitiateProfilingRun)
	mux.HandleFunc("GET /api/v1/migration/engagements/{id}/profiling-runs", h.ListProfilingRuns)
	mux.HandleFunc("GET /api/v1/migration/profiling-runs/{run_id}", h.GetProfilingRun)
	mux.HandleFunc("GET /api/v1/migration/profiling-runs/{run_id}/inventory", h.GetProfilingInventory)
```

**Step 3: Build verification**

Run: `cd platform/migration && go build ./...`
Expected: PASS

**Step 4: Commit**

```bash
git add platform/migration/api/profiling_handlers.go platform/migration/api/handlers.go
git commit -m "[migration/api] Add profiling run endpoints: initiate, list, get, inventory"
```

---

## Task 10: Wire Executors into main.go

**Files:**
- Modify: `platform/migration/main.go` (lines 72-81)

**Step 1: Register L1 and L2 executors**

Replace the placeholder comment at line 78:
```go
		// Future: register profile_l1, profile_l2, etc. executors here
```

With:
```go
		w.RegisterExecutor("profile_l1", &worker.L1Executor{})
		w.RegisterExecutor("profile_l2", &worker.L2Executor{})
```

Keep the noop executor registration as-is.

**Step 2: Build verification**

Run: `cd platform/migration && go build ./...`
Expected: PASS

**Step 3: Run all tests**

Run: `cd platform/migration && go test ./... -short -v`
Expected: All pass

**Step 4: Commit**

```bash
git add platform/migration/main.go
git commit -m "[migration] Wire L1/L2 profiling executors into embedded worker"
```

---

## Task 11: Full Build + Test Verification

**Step 1: Build all modified packages**

Run: `cd platform/migration && go build ./...`
Expected: PASS

**Step 2: Run all unit tests**

Run: `cd platform/migration && go test ./... -short -v -count=1`
Expected: All PASS

**Step 3: Check for import cycles or vet warnings**

Run: `cd platform/migration && go vet ./...`
Expected: No warnings

**Step 4: Final commit (if any fixes needed)**

---

## Summary of Deliverables

| # | What | Files |
|---|------|-------|
| 1 | Types | `models/types.go` |
| 2 | Migration 042 | `db/migrations/042_profiling_run.sql` |
| 3 | DB layer | `db/profiling.go`, `db/profiling_test.go` |
| 4 | Pension patterns | `profiler/pension_patterns.go`, `profiler/pension_patterns_test.go` |
| 5 | Sampling | `profiler/sampling.go`, `profiler/sampling_test.go` |
| 6 | L1 executor | `worker/profile_l1_executor.go`, `worker/profile_l1_executor_test.go` |
| 7 | L2 executor | `worker/profile_l2_executor.go`, `worker/profile_l2_executor_test.go` |
| 8 | Orchestrator types | `profiler/levels.go`, `profiler/levels_test.go` |
| 9 | API handlers | `api/profiling_handlers.go`, `api/handlers.go` |
| 10 | Wiring | `main.go` |

**Expected test count:** ~20 new tests across 5 test files.
