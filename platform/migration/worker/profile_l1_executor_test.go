package worker

import (
	"encoding/json"
	"testing"
)

func TestL1Input_Unmarshal(t *testing.T) {
	raw := `{"profiling_run_id":"run-1","engagement_id":"eng-1","schema_name":"public","table_name":"employees","source_driver":"postgres"}`
	var input L1Input
	if err := json.Unmarshal([]byte(raw), &input); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if input.ProfilingRunID != "run-1" {
		t.Errorf("ProfilingRunID = %q, want %q", input.ProfilingRunID, "run-1")
	}
	if input.EngagementID != "eng-1" {
		t.Errorf("EngagementID = %q, want %q", input.EngagementID, "eng-1")
	}
	if input.SchemaName != "public" {
		t.Errorf("SchemaName = %q, want %q", input.SchemaName, "public")
	}
	if input.TableName != "employees" {
		t.Errorf("TableName = %q, want %q", input.TableName, "employees")
	}
	if input.SourceDriver != "postgres" {
		t.Errorf("SourceDriver = %q, want %q", input.SourceDriver, "postgres")
	}
}

func TestQuoteIdentL1_Postgres(t *testing.T) {
	tests := []struct {
		schema, table, driver, want string
	}{
		{"public", "employees", "postgres", `"public"."employees"`},
		{"", "employees", "postgres", `"employees"`},
		{"dbo", "employees", "mssql", `[dbo].[employees]`},
		{"", "employees", "mssql", `[employees]`},
	}
	for _, tt := range tests {
		got, err := quoteIdentL1(tt.schema, tt.table, tt.driver)
		if err != nil {
			t.Errorf("quoteIdentL1(%q, %q, %q) error: %v", tt.schema, tt.table, tt.driver, err)
			continue
		}
		if got != tt.want {
			t.Errorf("quoteIdentL1(%q, %q, %q) = %q, want %q", tt.schema, tt.table, tt.driver, got, tt.want)
		}
	}
}

func TestStrPtr(t *testing.T) {
	if strPtr("") != nil {
		t.Error("strPtr(\"\") should return nil")
	}
	p := strPtr("hello")
	if p == nil || *p != "hello" {
		t.Error("strPtr(\"hello\") should return pointer to \"hello\"")
	}
}

func TestProfileL1Executor_ImplementsExecutor(t *testing.T) {
	// Compile-time check that ProfileL1Executor implements the Executor interface.
	var _ Executor = (*ProfileL1Executor)(nil)
}
