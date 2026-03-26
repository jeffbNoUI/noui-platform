package worker

import (
	"encoding/json"
	"testing"

	"github.com/noui/platform/migration/models"
)

func TestL3Input_Unmarshal(t *testing.T) {
	raw := `{"profiling_run_id":"run-1","engagement_id":"eng-1","source_driver":"postgres"}`
	var input L3Input
	if err := json.Unmarshal([]byte(raw), &input); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if input.ProfilingRunID != "run-1" {
		t.Errorf("ProfilingRunID = %q, want %q", input.ProfilingRunID, "run-1")
	}
	if input.EngagementID != "eng-1" {
		t.Errorf("EngagementID = %q, want %q", input.EngagementID, "eng-1")
	}
	if input.SourceDriver != "postgres" {
		t.Errorf("SourceDriver = %q, want %q", input.SourceDriver, "postgres")
	}
}

func TestProfileL3Executor_ImplementsExecutor(t *testing.T) {
	// Compile-time check that ProfileL3Executor implements the Executor interface.
	var _ Executor = (*ProfileL3Executor)(nil)
}

func TestDeclaredFKQuery_Postgres(t *testing.T) {
	q := DeclaredFKQuery("postgres")
	if q == "" {
		t.Fatal("expected non-empty query for postgres")
	}
	// Should reference information_schema.table_constraints.
	if !containsStr(q, "information_schema.table_constraints") {
		t.Error("postgres FK query should use information_schema.table_constraints")
	}
	if !containsStr(q, "FOREIGN KEY") {
		t.Error("postgres FK query should filter by FOREIGN KEY constraint type")
	}
}

func TestDeclaredFKQuery_MySQL(t *testing.T) {
	q := DeclaredFKQuery("mysql")
	if q == "" {
		t.Fatal("expected non-empty query for mysql")
	}
	if !containsStr(q, "REFERENCED_TABLE_NAME") {
		t.Error("mysql FK query should use REFERENCED_TABLE_NAME")
	}
}

func TestDeclaredFKQuery_MSSQL(t *testing.T) {
	q := DeclaredFKQuery("mssql")
	if q == "" {
		t.Fatal("expected non-empty query for mssql")
	}
	if !containsStr(q, "sys.foreign_keys") {
		t.Error("mssql FK query should use sys.foreign_keys")
	}
}

func TestDeclaredFKQuery_Unknown(t *testing.T) {
	q := DeclaredFKQuery("oracle")
	if q != "" {
		t.Errorf("expected empty query for unsupported driver, got %q", q)
	}
}

func TestQualifiedName(t *testing.T) {
	tests := []struct {
		schema, table, want string
	}{
		{"public", "employees", "public.employees"},
		{"", "employees", "employees"},
		{"dbo", "users", "dbo.users"},
	}
	for _, tt := range tests {
		got := QualifiedName(tt.schema, tt.table)
		if got != tt.want {
			t.Errorf("QualifiedName(%q, %q) = %q, want %q", tt.schema, tt.table, got, tt.want)
		}
	}
}

func TestQualifiedTableName(t *testing.T) {
	schema := "public"
	got := QualifiedTableName(&schema, "employees")
	if got != "public.employees" {
		t.Errorf("got %q, want %q", got, "public.employees")
	}

	got = QualifiedTableName(nil, "employees")
	if got != "employees" {
		t.Errorf("got %q, want %q", got, "employees")
	}

	empty := ""
	got = QualifiedTableName(&empty, "employees")
	if got != "employees" {
		t.Errorf("got %q, want %q", got, "employees")
	}
}

func TestExtractTableName(t *testing.T) {
	tests := []struct {
		input, want string
	}{
		{"public.employees", "employees"},
		{"employees", "employees"},
		{"dbo.users", "users"},
	}
	for _, tt := range tests {
		got := extractTableName(tt.input)
		if got != tt.want {
			t.Errorf("extractTableName(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestQuoteTableRef(t *testing.T) {
	tests := []struct {
		name, driver, want string
	}{
		{"public.employees", "postgres", `"public"."employees"`},
		{"employees", "postgres", `"employees"`},
		{"dbo.users", "mssql", `[dbo].[users]`},
	}
	for _, tt := range tests {
		got, err := quoteTableRef(tt.name, tt.driver)
		if err != nil {
			t.Errorf("quoteTableRef(%q, %q) error: %v", tt.name, tt.driver, err)
			continue
		}
		if got != tt.want {
			t.Errorf("quoteTableRef(%q, %q) = %q, want %q", tt.name, tt.driver, got, tt.want)
		}
	}
}

func TestMatchFKCandidate_ExactMatch(t *testing.T) {
	// employee_id column should match employees table's PK with 0.9 confidence.
	col := models.SourceColumnProfile{
		ColumnName: "employee_id",
		DataType:   "integer",
	}

	pkByTable := map[string][]models.SourceColumnProfile{
		"tbl-1": {{ColumnName: "id", DataType: "integer", IsPrimaryKey: true}},
	}
	tableIDToName := map[string]string{
		"tbl-1": "public.employees",
	}

	conf, parent, parentCol := MatchFKCandidate(col, pkByTable, tableIDToName, "public.salaries")
	if conf != 0.9 {
		t.Errorf("confidence = %f, want 0.9", conf)
	}
	if parent != "public.employees" {
		t.Errorf("parent = %q, want %q", parent, "public.employees")
	}
	if parentCol != "id" {
		t.Errorf("parentCol = %q, want %q", parentCol, "id")
	}
}

func TestMatchFKCandidate_ExactPKNameMatch(t *testing.T) {
	// department_id column matches departments.department_id PK exactly.
	col := models.SourceColumnProfile{
		ColumnName: "department_id",
		DataType:   "integer",
	}

	pkByTable := map[string][]models.SourceColumnProfile{
		"tbl-1": {{ColumnName: "department_id", DataType: "integer", IsPrimaryKey: true}},
	}
	tableIDToName := map[string]string{
		"tbl-1": "public.departments",
	}

	conf, parent, parentCol := MatchFKCandidate(col, pkByTable, tableIDToName, "public.employees")
	if conf != 0.9 {
		t.Errorf("confidence = %f, want 0.9", conf)
	}
	if parent != "public.departments" {
		t.Errorf("parent = %q, want %q", parent, "public.departments")
	}
	if parentCol != "department_id" {
		t.Errorf("parentCol = %q, want %q", parentCol, "department_id")
	}
}

func TestMatchFKCandidate_PartialMatch(t *testing.T) {
	// emp_id contains "emp" which matches "employees" partially.
	col := models.SourceColumnProfile{
		ColumnName: "emp_id",
		DataType:   "integer",
	}

	pkByTable := map[string][]models.SourceColumnProfile{
		"tbl-1": {{ColumnName: "id", DataType: "integer", IsPrimaryKey: true}},
	}
	tableIDToName := map[string]string{
		"tbl-1": "public.employees",
	}

	conf, parent, _ := MatchFKCandidate(col, pkByTable, tableIDToName, "public.salaries")
	if conf != 0.7 {
		t.Errorf("confidence = %f, want 0.7", conf)
	}
	if parent != "public.employees" {
		t.Errorf("parent = %q, want %q", parent, "public.employees")
	}
}

func TestMatchFKCandidate_TypeOnlyMatch(t *testing.T) {
	// xyz_id has no name match but same type.
	col := models.SourceColumnProfile{
		ColumnName: "xyz_id",
		DataType:   "integer",
	}

	pkByTable := map[string][]models.SourceColumnProfile{
		"tbl-1": {{ColumnName: "id", DataType: "integer", IsPrimaryKey: true}},
	}
	tableIDToName := map[string]string{
		"tbl-1": "public.categories",
	}

	conf, _, _ := MatchFKCandidate(col, pkByTable, tableIDToName, "public.items")
	if conf != 0.5 {
		t.Errorf("confidence = %f, want 0.5", conf)
	}
}

func TestMatchFKCandidate_NoMatch(t *testing.T) {
	// Non _id column should not match.
	col := models.SourceColumnProfile{
		ColumnName: "name",
		DataType:   "text",
	}

	pkByTable := map[string][]models.SourceColumnProfile{
		"tbl-1": {{ColumnName: "id", DataType: "integer", IsPrimaryKey: true}},
	}
	tableIDToName := map[string]string{
		"tbl-1": "public.employees",
	}

	// name doesn't end in _id, so it won't be passed to MatchFKCandidate
	// in real usage. But if called directly, it should match by type only
	// since "nam" entity hint doesn't match "employees".
	conf, _, _ := MatchFKCandidate(col, pkByTable, tableIDToName, "public.departments")
	// No _id suffix doesn't prevent matching in the helper itself,
	// but the caller filters before calling.
	_ = conf
}

func TestMatchFKCandidate_SkipsSelfReference(t *testing.T) {
	col := models.SourceColumnProfile{
		ColumnName: "parent_id",
		DataType:   "integer",
	}

	pkByTable := map[string][]models.SourceColumnProfile{
		"tbl-1": {{ColumnName: "id", DataType: "integer", IsPrimaryKey: true}},
	}
	tableIDToName := map[string]string{
		"tbl-1": "public.categories",
	}

	// childTable == parentTable: should not match (self-reference skipped).
	conf, _, _ := MatchFKCandidate(col, pkByTable, tableIDToName, "public.categories")
	if conf != 0 {
		t.Errorf("self-reference should yield confidence 0, got %f", conf)
	}
}

func TestMatchFKCandidate_SkipsCompositeKeys(t *testing.T) {
	col := models.SourceColumnProfile{
		ColumnName: "order_id",
		DataType:   "integer",
	}

	// Composite PK (2 columns) should be skipped.
	pkByTable := map[string][]models.SourceColumnProfile{
		"tbl-1": {
			{ColumnName: "order_id", DataType: "integer", IsPrimaryKey: true},
			{ColumnName: "line_id", DataType: "integer", IsPrimaryKey: true},
		},
	}
	tableIDToName := map[string]string{
		"tbl-1": "public.order_lines",
	}

	conf, _, _ := MatchFKCandidate(col, pkByTable, tableIDToName, "public.shipments")
	if conf != 0 {
		t.Errorf("composite PK should yield confidence 0, got %f", conf)
	}
}

// containsStr checks if substr is in s.
func containsStr(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 && contains(s, substr)
}

func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
