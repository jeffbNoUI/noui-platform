package mapper

import (
	"database/sql"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func TestInferDomain(t *testing.T) {
	tests := []struct {
		col    string
		domain string
	}{
		{"STATUS_CD", "status"},
		{"member_status", "status"},
		{"emp_stat", "status"},
		{"GENDER", "gender"},
		{"sex_code", "gender"},
		{"PLAN_TYPE", "plan_type"},
		{"plan_cd", "plan_type"},
		{"benefit_type", "plan_type"},
		{"TIER", "tier"},
		{"member_tier", "tier"},
		{"job_code", "code"},
		{"pay_cd", "code"},
		{"first_name", "unknown"},
		{"salary_amount", "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.col, func(t *testing.T) {
			got := InferDomain(tt.col)
			if got != tt.domain {
				t.Errorf("InferDomain(%q) = %q, want %q", tt.col, got, tt.domain)
			}
		})
	}
}

func TestDiscoverCodeColumns(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// Table has 10000 rows, threshold = 100.
	rowCount := 10000

	// Return two columns.
	mock.ExpectQuery("SELECT column_name FROM information_schema.columns").
		WithArgs("members").
		WillReturnRows(sqlmock.NewRows([]string{"column_name"}).
			AddRow("member_id").
			AddRow("status_cd"))

	// member_id: cardinality 5000 — too high (>= threshold 100)
	mock.ExpectQuery(`SELECT COUNT\(DISTINCT "member_id"\)`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5000))

	// status_cd: cardinality 5 — below both thresholds
	mock.ExpectQuery(`SELECT COUNT\(DISTINCT "status_cd"\)`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))

	// Fetch distinct values for status_cd.
	mock.ExpectQuery(`SELECT DISTINCT`).
		WillReturnRows(sqlmock.NewRows([]string{"val"}).
			AddRow("A").AddRow("D").AddRow("I").AddRow("R").AddRow("T"))

	candidates, err := DiscoverCodeColumns(db, "members", rowCount)
	if err != nil {
		t.Fatalf("DiscoverCodeColumns error: %v", err)
	}

	if len(candidates) != 1 {
		t.Fatalf("len(candidates) = %d, want 1", len(candidates))
	}

	c := candidates[0]
	if c.ColumnName != "status_cd" {
		t.Errorf("ColumnName = %q, want %q", c.ColumnName, "status_cd")
	}
	if c.Cardinality != 5 {
		t.Errorf("Cardinality = %d, want 5", c.Cardinality)
	}
	if len(c.DistinctValues) != 5 {
		t.Errorf("len(DistinctValues) = %d, want 5", len(c.DistinctValues))
	}
	if c.LikelyDomain != "status" {
		t.Errorf("LikelyDomain = %q, want %q", c.LikelyDomain, "status")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestDiscoverCodeColumns_ZeroRows(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	candidates, err := DiscoverCodeColumns(db, "empty_table", 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if candidates != nil {
		t.Errorf("expected nil candidates for 0 rows, got %d", len(candidates))
	}
}

func TestDiscoverCodeColumns_CardinalityAt50(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// Row count = 100000, threshold = 1000. Cardinality = 50 should be excluded (>= 50).
	mock.ExpectQuery("SELECT column_name FROM information_schema.columns").
		WithArgs("big_table").
		WillReturnRows(sqlmock.NewRows([]string{"column_name"}).AddRow("code_col"))

	mock.ExpectQuery(`SELECT COUNT\(DISTINCT "code_col"\)`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(50))

	candidates, err := DiscoverCodeColumns(db, "big_table", 100000)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(candidates) != 0 {
		t.Errorf("expected 0 candidates for cardinality=50, got %d", len(candidates))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestDiscoverCodeColumns_CardinalityAboveThreshold(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// Row count = 500, threshold = 5. Cardinality = 10 is < 50 but >= threshold (5).
	mock.ExpectQuery("SELECT column_name FROM information_schema.columns").
		WithArgs("small_table").
		WillReturnRows(sqlmock.NewRows([]string{"column_name"}).AddRow("category"))

	mock.ExpectQuery(`SELECT COUNT\(DISTINCT "category"\)`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(10))

	candidates, err := DiscoverCodeColumns(db, "small_table", 500)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(candidates) != 0 {
		t.Errorf("expected 0 candidates for cardinality above threshold, got %d", len(candidates))
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListCodeMappings(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	approvedBy := "analyst@example.com"
	approvedAt := "2026-03-21T10:00:00Z"

	mock.ExpectQuery("SELECT .+ FROM migration.code_mapping").
		WithArgs("eng-001").
		WillReturnRows(sqlmock.NewRows([]string{
			"code_mapping_id", "engagement_id", "source_table", "source_column",
			"source_value", "canonical_value", "approved_by", "approved_at",
		}).
			AddRow("cm-001", "eng-001", "MEMBERS", "STATUS_CD", "A", "ACTIVE", &approvedBy, &approvedAt).
			AddRow("cm-002", "eng-001", "MEMBERS", "STATUS_CD", "R", "RETIRED", nil, nil))

	mappings, err := ListCodeMappings(db, "eng-001")
	if err != nil {
		t.Fatalf("ListCodeMappings error: %v", err)
	}

	if len(mappings) != 2 {
		t.Fatalf("len(mappings) = %d, want 2", len(mappings))
	}

	if mappings[0].SourceValue != "A" {
		t.Errorf("mappings[0].SourceValue = %q, want %q", mappings[0].SourceValue, "A")
	}
	if mappings[0].CanonicalValue != "ACTIVE" {
		t.Errorf("mappings[0].CanonicalValue = %q, want %q", mappings[0].CanonicalValue, "ACTIVE")
	}
	if mappings[1].ApprovedBy != nil {
		t.Errorf("mappings[1].ApprovedBy = %v, want nil", mappings[1].ApprovedBy)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateCodeMapping(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	approvedBy := "analyst@example.com"
	approvedAt := "2026-03-21T10:00:00Z"

	mock.ExpectQuery("UPDATE migration.code_mapping").
		WithArgs("ACTIVE", "analyst@example.com", "cm-001", "eng-001").
		WillReturnRows(sqlmock.NewRows([]string{
			"code_mapping_id", "engagement_id", "source_table", "source_column",
			"source_value", "canonical_value", "approved_by", "approved_at",
		}).AddRow("cm-001", "eng-001", "MEMBERS", "STATUS_CD", "A", "ACTIVE", &approvedBy, &approvedAt))

	m, err := UpdateCodeMapping(db, "eng-001", "cm-001", "ACTIVE", "analyst@example.com")
	if err != nil {
		t.Fatalf("UpdateCodeMapping error: %v", err)
	}

	if m.CanonicalValue != "ACTIVE" {
		t.Errorf("CanonicalValue = %q, want %q", m.CanonicalValue, "ACTIVE")
	}
	if m.ApprovedBy == nil || *m.ApprovedBy != "analyst@example.com" {
		t.Errorf("ApprovedBy = %v, want %q", m.ApprovedBy, "analyst@example.com")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateCodeMapping_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("UPDATE migration.code_mapping").
		WithArgs("ACTIVE", "analyst@example.com", "cm-999", "eng-001").
		WillReturnRows(sqlmock.NewRows([]string{
			"code_mapping_id", "engagement_id", "source_table", "source_column",
			"source_value", "canonical_value", "approved_by", "approved_at",
		}))

	_, err = UpdateCodeMapping(db, "eng-001", "cm-999", "ACTIVE", "analyst@example.com")
	if err != sql.ErrNoRows {
		t.Errorf("expected sql.ErrNoRows, got %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestResolveCode(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT canonical_value FROM migration.code_mapping").
		WithArgs("eng-001", "MEMBERS", "STATUS_CD", "A").
		WillReturnRows(sqlmock.NewRows([]string{"canonical_value"}).AddRow("ACTIVE"))

	val, found, err := ResolveCode(db, "eng-001", "MEMBERS", "STATUS_CD", "A")
	if err != nil {
		t.Fatalf("ResolveCode error: %v", err)
	}
	if !found {
		t.Error("expected found=true")
	}
	if val != "ACTIVE" {
		t.Errorf("val = %q, want %q", val, "ACTIVE")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestResolveCode_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT canonical_value FROM migration.code_mapping").
		WithArgs("eng-001", "MEMBERS", "STATUS_CD", "X").
		WillReturnRows(sqlmock.NewRows([]string{"canonical_value"}))

	val, found, err := ResolveCode(db, "eng-001", "MEMBERS", "STATUS_CD", "X")
	if err != nil {
		t.Fatalf("ResolveCode error: %v", err)
	}
	if found {
		t.Error("expected found=false")
	}
	if val != "" {
		t.Errorf("val = %q, want empty", val)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestQuoteIdent(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"simple", `"simple"`},
		{`has"quote`, `"has""quote"`},
		{"UPPER_CASE", `"UPPER_CASE"`},
	}
	for _, tt := range tests {
		got := quoteIdent(tt.input)
		if got != tt.want {
			t.Errorf("quoteIdent(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
