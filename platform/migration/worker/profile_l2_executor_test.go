package worker

import (
	"encoding/json"
	"testing"
)

func TestL2Input_Unmarshal(t *testing.T) {
	raw := `{
		"profiling_run_id":"run-1",
		"engagement_id":"eng-1",
		"source_table_id":"tbl-1",
		"schema_name":"public",
		"table_name":"employees",
		"source_driver":"postgres",
		"estimated_rows":5000000
	}`
	var input L2Input
	if err := json.Unmarshal([]byte(raw), &input); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if input.ProfilingRunID != "run-1" {
		t.Errorf("ProfilingRunID = %q, want %q", input.ProfilingRunID, "run-1")
	}
	if input.SourceTableID != "tbl-1" {
		t.Errorf("SourceTableID = %q, want %q", input.SourceTableID, "tbl-1")
	}
	if input.EstimatedRows != 5000000 {
		t.Errorf("EstimatedRows = %d, want 5000000", input.EstimatedRows)
	}
}

func TestQuoteColName(t *testing.T) {
	tests := []struct {
		col, driver, want string
	}{
		{"employee_id", "postgres", `"employee_id"`},
		{"employee_id", "mssql", `[employee_id]`},
		{"salary", "postgres", `"salary"`},
	}
	for _, tt := range tests {
		got, err := quoteColName(tt.col, tt.driver)
		if err != nil {
			t.Errorf("quoteColName(%q, %q) unexpected error: %v", tt.col, tt.driver, err)
			continue
		}
		if got != tt.want {
			t.Errorf("quoteColName(%q, %q) = %q, want %q", tt.col, tt.driver, got, tt.want)
		}
	}
}

func TestIsNumericType(t *testing.T) {
	numeric := []string{"integer", "int", "bigint", "numeric", "decimal", "float", "real", "money", "int4", "float8"}
	for _, dt := range numeric {
		if !isNumericType(dt) {
			t.Errorf("isNumericType(%q) = false, want true", dt)
		}
	}

	nonNumeric := []string{"text", "varchar", "character varying", "date", "timestamp", "boolean", "uuid"}
	for _, dt := range nonNumeric {
		if isNumericType(dt) {
			t.Errorf("isNumericType(%q) = true, want false", dt)
		}
	}
}

func TestProfileL2Executor_ImplementsExecutor(t *testing.T) {
	var _ Executor = (*ProfileL2Executor)(nil)
}
