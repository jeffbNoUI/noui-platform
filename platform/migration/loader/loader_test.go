package loader

import (
	"encoding/json"
	"fmt"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/transformer"
)

// --- WriteCanonicalRow tests ---

func TestWriteCanonicalRow_SingleColumn(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	mock.ExpectQuery("INSERT INTO migration.member").
		WithArgs("John").
		WillReturnRows(sqlmock.NewRows([]string{"canonical_id"}).AddRow("uuid-001"))

	id, err := WriteCanonicalRow(tx, "migration.member", map[string]interface{}{
		"first_name": "John",
	})
	if err != nil {
		t.Fatalf("WriteCanonicalRow error: %v", err)
	}
	if id != "uuid-001" {
		t.Errorf("canonical_id = %q, want %q", id, "uuid-001")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestWriteCanonicalRow_MultipleColumns(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	// Columns are sorted alphabetically: dob, first_name, last_name, ssn
	mock.ExpectQuery("INSERT INTO migration.member").
		WithArgs("1990-01-15", "Jane", "Doe", "123-45-6789").
		WillReturnRows(sqlmock.NewRows([]string{"canonical_id"}).AddRow("uuid-002"))

	id, err := WriteCanonicalRow(tx, "migration.member", map[string]interface{}{
		"first_name": "Jane",
		"last_name":  "Doe",
		"ssn":        "123-45-6789",
		"dob":        "1990-01-15",
	})
	if err != nil {
		t.Fatalf("WriteCanonicalRow error: %v", err)
	}
	if id != "uuid-002" {
		t.Errorf("canonical_id = %q, want %q", id, "uuid-002")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestWriteCanonicalRow_DifferentTable(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	// salary table: amount, effective_date, member_id (sorted)
	mock.ExpectQuery("INSERT INTO migration.salary").
		WithArgs("75000.00", "2024-01-01", "mem-001").
		WillReturnRows(sqlmock.NewRows([]string{"canonical_id"}).AddRow("uuid-sal-001"))

	id, err := WriteCanonicalRow(tx, "migration.salary", map[string]interface{}{
		"member_id":      "mem-001",
		"amount":         "75000.00",
		"effective_date": "2024-01-01",
	})
	if err != nil {
		t.Fatalf("WriteCanonicalRow error: %v", err)
	}
	if id != "uuid-sal-001" {
		t.Errorf("canonical_id = %q, want %q", id, "uuid-sal-001")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestWriteCanonicalRow_EmptyRow(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	_, err = WriteCanonicalRow(tx, "migration.member", map[string]interface{}{})
	if err == nil {
		t.Fatal("expected error for empty row, got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestWriteCanonicalRow_DBError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	mock.ExpectQuery("INSERT INTO migration.member").
		WithArgs("John").
		WillReturnError(fmt.Errorf("unique constraint violation"))

	_, err = WriteCanonicalRow(tx, "migration.member", map[string]interface{}{
		"first_name": "John",
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- WriteLineage tests ---

func TestWriteLineage(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	actions := []TransformAction{
		{Handler: "NormalizeSSN", Input: "123456789", Output: "123-45-6789"},
		{Handler: "ParseDate", Input: "01/15/1990", Output: "1990-01-15"},
	}

	actionsJSON, _ := json.Marshal(actions)

	mock.ExpectExec("INSERT INTO migration.lineage").
		WithArgs(
			"batch-001", "source_members", "src-001",
			"migration.member", "uuid-001",
			"v1.0", "ACTUAL",
			string(actionsJSON),
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = WriteLineage(tx, LineageEntry{
		BatchID:         "batch-001",
		SourceTable:     "source_members",
		SourceID:        "src-001",
		CanonicalTable:  "migration.member",
		CanonicalID:     "uuid-001",
		MappingVersion:  "v1.0",
		ConfidenceLevel: "ACTUAL",
		Transformations: actions,
	})
	if err != nil {
		t.Fatalf("WriteLineage error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestWriteLineage_EmptyTransformations(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	mock.ExpectExec("INSERT INTO migration.lineage").
		WithArgs(
			"batch-001", "source_members", "src-001",
			"migration.member", "uuid-001",
			"v1.0", "ACTUAL",
			"[]",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = WriteLineage(tx, LineageEntry{
		BatchID:         "batch-001",
		SourceTable:     "source_members",
		SourceID:        "src-001",
		CanonicalTable:  "migration.member",
		CanonicalID:     "uuid-001",
		MappingVersion:  "v1.0",
		ConfidenceLevel: "ACTUAL",
		Transformations: []TransformAction{},
	})
	if err != nil {
		t.Fatalf("WriteLineage error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestWriteLineage_DerivedConfidence(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	actions := []TransformAction{
		{Handler: "DeriveDefaults", Input: "<nil>", Output: "ACTIVE"},
	}
	actionsJSON, _ := json.Marshal(actions)

	mock.ExpectExec("INSERT INTO migration.lineage").
		WithArgs(
			"batch-002", "source_members", "src-010",
			"migration.member", "uuid-010",
			"v2.0", "DERIVED",
			string(actionsJSON),
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = WriteLineage(tx, LineageEntry{
		BatchID:         "batch-002",
		SourceTable:     "source_members",
		SourceID:        "src-010",
		CanonicalTable:  "migration.member",
		CanonicalID:     "uuid-010",
		MappingVersion:  "v2.0",
		ConfidenceLevel: "DERIVED",
		Transformations: actions,
	})
	if err != nil {
		t.Fatalf("WriteLineage error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestWriteLineage_DBError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	mock.ExpectExec("INSERT INTO migration.lineage").
		WithArgs(
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(),
		).
		WillReturnError(fmt.Errorf("FK constraint: batch_id not found"))

	err = WriteLineage(tx, LineageEntry{
		BatchID:         "nonexistent-batch",
		SourceTable:     "src",
		SourceID:        "1",
		CanonicalTable:  "migration.member",
		CanonicalID:     "uuid-001",
		MappingVersion:  "v1.0",
		ConfidenceLevel: "ACTUAL",
		Transformations: []TransformAction{},
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- WriteException tests ---

func TestWriteException(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	mock.ExpectExec("INSERT INTO migration.exception").
		WithArgs(
			"batch-001", "source_members", "src-005",
			"migration.member", "ssn",
			"MISSING_REQUIRED", "",
			"ssn is required",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = WriteException(tx, ExceptionEntry{
		BatchID:            "batch-001",
		SourceTable:        "source_members",
		SourceID:           "src-005",
		CanonicalTable:     "migration.member",
		FieldName:          "ssn",
		ExceptionType:      "MISSING_REQUIRED",
		AttemptedValue:     "",
		ConstraintViolated: "ssn is required",
	})
	if err != nil {
		t.Fatalf("WriteException error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestWriteException_InvalidFormat(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	mock.ExpectExec("INSERT INTO migration.exception").
		WithArgs(
			"batch-001", "source_members", "src-007",
			"migration.member", "dob",
			"INVALID_FORMAT", "not-a-date",
			"expected DATE format YYYY-MM-DD",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = WriteException(tx, ExceptionEntry{
		BatchID:            "batch-001",
		SourceTable:        "source_members",
		SourceID:           "src-007",
		CanonicalTable:     "migration.member",
		FieldName:          "dob",
		ExceptionType:      "INVALID_FORMAT",
		AttemptedValue:     "not-a-date",
		ConstraintViolated: "expected DATE format YYYY-MM-DD",
	})
	if err != nil {
		t.Fatalf("WriteException error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestWriteException_DBError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	mock.ExpectExec("INSERT INTO migration.exception").
		WithArgs(
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(),
		).
		WillReturnError(fmt.Errorf("check constraint violation"))

	err = WriteException(tx, ExceptionEntry{
		BatchID:            "batch-001",
		SourceTable:        "src",
		SourceID:           "1",
		CanonicalTable:     "migration.member",
		FieldName:          "status",
		ExceptionType:      "BUSINESS_RULE",
		AttemptedValue:     "INVALID_STATUS",
		ConstraintViolated: "status must be ACTIVE or INACTIVE",
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- WriteBatchToCanonical tests ---

func TestWriteBatchToCanonical_SingleRow(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	cfg := BatchWriteConfig{
		BatchID:        "batch-001",
		SourceTable:    "source_members",
		CanonicalTable: "migration.member",
		MappingVersion: "v1.0",
	}

	results := []transformer.TransformResult{
		{
			CanonicalRow: map[string]interface{}{
				"first_name": "Alice",
				"last_name":  "Smith",
			},
			Lineage: []transformer.LineageEntry{
				{HandlerName: "TypeCoerce", Column: "first_name", SourceValue: "ALICE", ResultValue: "Alice"},
			},
			Exceptions: []transformer.ExceptionEntry{},
			Confidence: transformer.ConfidenceActual,
		},
	}
	sourceIDs := []string{"src-001"}

	// Expect canonical row INSERT (columns sorted: first_name, last_name)
	mock.ExpectQuery("INSERT INTO migration.member").
		WithArgs("Alice", "Smith").
		WillReturnRows(sqlmock.NewRows([]string{"canonical_id"}).AddRow("uuid-001"))

	// Expect lineage INSERT
	actions := []TransformAction{{Handler: "TypeCoerce", Input: "ALICE", Output: "Alice"}}
	actionsJSON, _ := json.Marshal(actions)
	mock.ExpectExec("INSERT INTO migration.lineage").
		WithArgs(
			"batch-001", "source_members", "src-001",
			"migration.member", "uuid-001",
			"v1.0", "ACTUAL",
			string(actionsJSON),
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	loaded, err := WriteBatchToCanonical(tx, cfg, results, sourceIDs)
	if err != nil {
		t.Fatalf("WriteBatchToCanonical error: %v", err)
	}
	if loaded != 1 {
		t.Errorf("loaded = %d, want 1", loaded)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestWriteBatchToCanonical_MultipleRows(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	cfg := BatchWriteConfig{
		BatchID:        "batch-002",
		SourceTable:    "source_members",
		CanonicalTable: "migration.member",
		MappingVersion: "v1.0",
	}

	results := []transformer.TransformResult{
		{
			CanonicalRow: map[string]interface{}{"first_name": "Bob"},
			Lineage:      []transformer.LineageEntry{},
			Exceptions:   []transformer.ExceptionEntry{},
			Confidence:   transformer.ConfidenceActual,
		},
		{
			CanonicalRow: map[string]interface{}{"first_name": "Carol"},
			Lineage:      []transformer.LineageEntry{},
			Exceptions:   []transformer.ExceptionEntry{},
			Confidence:   transformer.ConfidenceDerived,
		},
	}
	sourceIDs := []string{"src-010", "src-011"}

	// Row 1
	mock.ExpectQuery("INSERT INTO migration.member").
		WithArgs("Bob").
		WillReturnRows(sqlmock.NewRows([]string{"canonical_id"}).AddRow("uuid-010"))
	mock.ExpectExec("INSERT INTO migration.lineage").
		WithArgs(
			"batch-002", "source_members", "src-010",
			"migration.member", "uuid-010",
			"v1.0", "ACTUAL", "[]",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Row 2
	mock.ExpectQuery("INSERT INTO migration.member").
		WithArgs("Carol").
		WillReturnRows(sqlmock.NewRows([]string{"canonical_id"}).AddRow("uuid-011"))
	mock.ExpectExec("INSERT INTO migration.lineage").
		WithArgs(
			"batch-002", "source_members", "src-011",
			"migration.member", "uuid-011",
			"v1.0", "DERIVED", "[]",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	loaded, err := WriteBatchToCanonical(tx, cfg, results, sourceIDs)
	if err != nil {
		t.Fatalf("WriteBatchToCanonical error: %v", err)
	}
	if loaded != 2 {
		t.Errorf("loaded = %d, want 2", loaded)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestWriteBatchToCanonical_WithExceptions(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	cfg := BatchWriteConfig{
		BatchID:        "batch-003",
		SourceTable:    "source_members",
		CanonicalTable: "migration.member",
		MappingVersion: "v1.0",
	}

	results := []transformer.TransformResult{
		{
			CanonicalRow: map[string]interface{}{"first_name": "Dave"},
			Lineage:      []transformer.LineageEntry{},
			Exceptions: []transformer.ExceptionEntry{
				{
					HandlerName:   "ValidateConstraints",
					Column:        "ssn",
					SourceValue:   "",
					ExceptionType: transformer.ExceptionMissingRequired,
					Message:       "ssn is required",
				},
			},
			Confidence: transformer.ConfidenceEstimated,
		},
	}
	sourceIDs := []string{"src-020"}

	// Canonical row
	mock.ExpectQuery("INSERT INTO migration.member").
		WithArgs("Dave").
		WillReturnRows(sqlmock.NewRows([]string{"canonical_id"}).AddRow("uuid-020"))

	// Lineage
	mock.ExpectExec("INSERT INTO migration.lineage").
		WithArgs(
			"batch-003", "source_members", "src-020",
			"migration.member", "uuid-020",
			"v1.0", "ESTIMATED", "[]",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Exception
	mock.ExpectExec("INSERT INTO migration.exception").
		WithArgs(
			"batch-003", "source_members", "src-020",
			"migration.member", "ssn",
			"MISSING_REQUIRED", "",
			"ssn is required",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	loaded, err := WriteBatchToCanonical(tx, cfg, results, sourceIDs)
	if err != nil {
		t.Fatalf("WriteBatchToCanonical error: %v", err)
	}
	if loaded != 1 {
		t.Errorf("loaded = %d, want 1", loaded)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestWriteBatchToCanonical_MismatchedLengths(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	cfg := BatchWriteConfig{
		BatchID:        "batch-004",
		SourceTable:    "src",
		CanonicalTable: "migration.member",
		MappingVersion: "v1.0",
	}

	results := []transformer.TransformResult{
		{CanonicalRow: map[string]interface{}{"name": "A"}},
		{CanonicalRow: map[string]interface{}{"name": "B"}},
	}
	sourceIDs := []string{"src-001"} // only 1 ID for 2 results

	_, err = WriteBatchToCanonical(tx, cfg, results, sourceIDs)
	if err == nil {
		t.Fatal("expected error for mismatched lengths, got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestWriteBatchToCanonical_CanonicalRowError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	cfg := BatchWriteConfig{
		BatchID:        "batch-005",
		SourceTable:    "src",
		CanonicalTable: "migration.member",
		MappingVersion: "v1.0",
	}

	results := []transformer.TransformResult{
		{
			CanonicalRow: map[string]interface{}{"name": "Fail"},
			Lineage:      []transformer.LineageEntry{},
			Exceptions:   []transformer.ExceptionEntry{},
			Confidence:   transformer.ConfidenceActual,
		},
	}
	sourceIDs := []string{"src-fail"}

	mock.ExpectQuery("INSERT INTO migration.member").
		WithArgs("Fail").
		WillReturnError(fmt.Errorf("table does not exist"))

	loaded, err := WriteBatchToCanonical(tx, cfg, results, sourceIDs)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if loaded != 0 {
		t.Errorf("loaded = %d, want 0", loaded)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- sanitizeIdentifier tests ---

func TestSanitizeIdentifier(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"migration.member", "migration.member"},
		{"simple_table", "simple_table"},
		{"schema.table_name", "schema.table_name"},
		{"bad;table--name", "badtablename"},
		{`"quoted"`, `"quoted"`},
		{"DROP TABLE foo", "DROPTABLEfoo"},
	}
	for _, tt := range tests {
		got := sanitizeIdentifier(tt.input)
		if got != tt.want {
			t.Errorf("sanitizeIdentifier(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestWriteBatchToCanonical_EmptyBatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	cfg := BatchWriteConfig{
		BatchID:        "batch-empty",
		SourceTable:    "src",
		CanonicalTable: "migration.member",
		MappingVersion: "v1.0",
	}

	loaded, err := WriteBatchToCanonical(tx, cfg, []transformer.TransformResult{}, []string{})
	if err != nil {
		t.Fatalf("WriteBatchToCanonical error: %v", err)
	}
	if loaded != 0 {
		t.Errorf("loaded = %d, want 0", loaded)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}
