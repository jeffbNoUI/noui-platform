package profiler

import (
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func TestDetectPatterns_CYYMMDD(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// Mock column discovery: one VARCHAR column.
	mock.ExpectQuery("SELECT column_name FROM information_schema.columns").
		WithArgs("test_table").
		WillReturnRows(sqlmock.NewRows([]string{"column_name"}).AddRow("date_field"))

	// Mock value sampling: all CYYMMDD values.
	mock.ExpectQuery("SELECT .+ FROM .+").
		WithArgs(1000).
		WillReturnRows(sqlmock.NewRows([]string{"date_field"}).
			AddRow("1260315").
			AddRow("1251201").
			AddRow("0990101"))

	patterns, err := DetectPatterns(db, "test_table", 0)
	if err != nil {
		t.Fatalf("DetectPatterns error: %v", err)
	}

	found := false
	for _, p := range patterns {
		if p.Label == "CYYMMDD century-encoded date (AS400)" {
			found = true
			if p.MatchRate < 0.99 {
				t.Errorf("CYYMMDD match rate = %.2f, want >= 0.99", p.MatchRate)
			}
			if p.SampleSize != 3 {
				t.Errorf("sample size = %d, want 3", p.SampleSize)
			}
		}
	}
	if !found {
		t.Error("CYYMMDD pattern not detected")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestDetectPatterns_SSN(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT column_name FROM information_schema.columns").
		WithArgs("members").
		WillReturnRows(sqlmock.NewRows([]string{"column_name"}).AddRow("ssn_col"))

	mock.ExpectQuery("SELECT .+ FROM .+").
		WithArgs(1000).
		WillReturnRows(sqlmock.NewRows([]string{"ssn_col"}).
			AddRow("123-45-6789").
			AddRow("987-65-4321").
			AddRow("111-22-3333").
			AddRow("not-an-ssn"))

	patterns, err := DetectPatterns(db, "members", 0)
	if err != nil {
		t.Fatalf("DetectPatterns error: %v", err)
	}

	found := false
	for _, p := range patterns {
		if p.Label == "SSN format (NNN-NN-NNNN)" {
			found = true
			if p.MatchRate < 0.50 {
				t.Errorf("SSN match rate = %.2f, want >= 0.50", p.MatchRate)
			}
		}
	}
	if !found {
		t.Error("SSN pattern not detected")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestDetectPatterns_AlphaPrefixMemberID(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT column_name FROM information_schema.columns").
		WithArgs("mbr_master").
		WillReturnRows(sqlmock.NewRows([]string{"column_name"}).AddRow("mbr_id"))

	mock.ExpectQuery("SELECT .+ FROM .+").
		WithArgs(1000).
		WillReturnRows(sqlmock.NewRows([]string{"mbr_id"}).
			AddRow("R12345").
			AddRow("A67890").
			AddRow("R00001"))

	patterns, err := DetectPatterns(db, "mbr_master", 0)
	if err != nil {
		t.Fatalf("DetectPatterns error: %v", err)
	}

	found := false
	for _, p := range patterns {
		if p.Label == "Member ID with alpha prefix" {
			found = true
			if p.MatchRate < 0.99 {
				t.Errorf("alpha prefix match rate = %.2f, want >= 0.99", p.MatchRate)
			}
		}
	}
	if !found {
		t.Error("alpha prefix member ID pattern not detected")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestDetectPatterns_BelowThreshold(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT column_name FROM information_schema.columns").
		WithArgs("misc_table").
		WillReturnRows(sqlmock.NewRows([]string{"column_name"}).AddRow("notes"))

	// Free-form text — no pattern should match >50%.
	mock.ExpectQuery("SELECT .+ FROM .+").
		WithArgs(1000).
		WillReturnRows(sqlmock.NewRows([]string{"notes"}).
			AddRow("Some free-form text about a member").
			AddRow("Another note here that is longer than codes").
			AddRow("Third note with various punctuation: @#$%"))

	patterns, err := DetectPatterns(db, "misc_table", 0)
	if err != nil {
		t.Fatalf("DetectPatterns error: %v", err)
	}

	if len(patterns) != 0 {
		t.Errorf("expected 0 patterns for free-form text, got %d: %+v", len(patterns), patterns)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestDetectPatterns_EmptyColumn(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT column_name FROM information_schema.columns").
		WithArgs("empty_table").
		WillReturnRows(sqlmock.NewRows([]string{"column_name"}).AddRow("val"))

	// No non-null values.
	mock.ExpectQuery("SELECT .+ FROM .+").
		WithArgs(1000).
		WillReturnRows(sqlmock.NewRows([]string{"val"}))

	patterns, err := DetectPatterns(db, "empty_table", 0)
	if err != nil {
		t.Fatalf("DetectPatterns error: %v", err)
	}

	if len(patterns) != 0 {
		t.Errorf("expected 0 patterns for empty column, got %d", len(patterns))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestDetectPatterns_SchemaQualifiedTable(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT column_name FROM information_schema.columns").
		WithArgs("mbr_tbl", "legacy").
		WillReturnRows(sqlmock.NewRows([]string{"column_name"}).AddRow("code"))

	mock.ExpectQuery("SELECT .+ FROM .+").
		WithArgs(1000).
		WillReturnRows(sqlmock.NewRows([]string{"code"}).
			AddRow("AC").
			AddRow("RT").
			AddRow("IN"))

	patterns, err := DetectPatterns(db, "legacy.mbr_tbl", 0)
	if err != nil {
		t.Fatalf("DetectPatterns error: %v", err)
	}

	found := false
	for _, p := range patterns {
		if p.Label == "Two-character status code" {
			found = true
		}
	}
	if !found {
		t.Error("two-char status code not detected for schema-qualified table")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestParseSchemaTable(t *testing.T) {
	tests := []struct {
		input      string
		wantSchema string
		wantTable  string
	}{
		{"members", "", "members"},
		{"legacy.members", "legacy", "members"},
		{"public.salary_history", "public", "salary_history"},
	}

	for _, tt := range tests {
		schema, table := parseSchemaTable(tt.input)
		if schema != tt.wantSchema || table != tt.wantTable {
			t.Errorf("parseSchemaTable(%q) = (%q, %q), want (%q, %q)",
				tt.input, schema, table, tt.wantSchema, tt.wantTable)
		}
	}
}
