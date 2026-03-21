package loader

import (
	"fmt"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/transformer"
)

// --- Retransform tests ---

func TestRetransform_Success(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	sourceDB, sourceMock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() source error: %v", err)
	}
	defer sourceDB.Close()

	// Step 1: Lookup correction — approved
	mock.ExpectQuery("SELECT c.affected_mapping_id").
		WithArgs("corr-001").
		WillReturnRows(sqlmock.NewRows([]string{"affected_mapping_id", "mapping_version", "status"}).
			AddRow("map-001", "v1.0", "APPROVED"))

	// Step 2: Find affected rows
	mock.ExpectQuery("SELECT lineage_id, batch_id, source_table, source_id").
		WithArgs("v1.0").
		WillReturnRows(sqlmock.NewRows([]string{
			"lineage_id", "batch_id", "source_table", "source_id",
			"canonical_table", "canonical_id", "mapping_version",
		}).AddRow(
			"lin-001", "batch-001", "source_members", "src-001",
			"migration.member", "uuid-001", "v1.0",
		))

	// Step 3: Begin transaction
	mock.ExpectBegin()

	// Fetch source row
	sourceMock.ExpectQuery("SELECT \\* FROM source_members").
		WithArgs("src-001").
		WillReturnRows(sqlmock.NewRows([]string{"id", "STATUS_CD"}).
			AddRow("src-001", "A"))

	// Step 4: Update canonical row (columns sorted: member_status)
	mock.ExpectExec("UPDATE migration.member SET member_status").
		WithArgs("ACTIVE", "uuid-001").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Step 5a: Write new lineage with RETURNING
	mock.ExpectQuery("INSERT INTO migration.lineage").
		WithArgs(
			"batch-001", "source_members", "src-001",
			"migration.member", "uuid-001",
			"v1.1", "ACTUAL",
			sqlmock.AnyArg(),
		).
		WillReturnRows(sqlmock.NewRows([]string{"lineage_id"}).AddRow("lin-002"))

	// Step 5b: Mark old lineage superseded
	mock.ExpectExec("UPDATE migration.lineage SET superseded_by").
		WithArgs("lin-001", "lin-002").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Commit
	mock.ExpectCommit()

	// Create a simple pipeline with an identity handler.
	pipeline := transformer.NewPipeline([]transformer.TransformHandler{
		{
			Name:     "Identity",
			Priority: 1,
			Apply: func(value interface{}, sourceRow map[string]interface{}, mapping transformer.FieldMapping, ctx *transformer.TransformContext) (interface{}, error) {
				// Map "A" -> "ACTIVE"
				if s, ok := value.(string); ok && s == "A" {
					return "ACTIVE", nil
				}
				return value, nil
			},
		},
	})

	newMappings := []transformer.FieldMapping{
		{
			SourceColumn:    "STATUS_CD",
			CanonicalColumn: "member_status",
			SourceType:      "varchar(10)",
			CanonicalType:   "VARCHAR",
		},
	}

	result, err := Retransform(db, sourceDB, "corr-001", pipeline, newMappings)
	if err != nil {
		t.Fatalf("Retransform error: %v", err)
	}
	if result.RowsAffected != 1 {
		t.Errorf("RowsAffected = %d, want 1", result.RowsAffected)
	}
	if result.RowsTransformed != 1 {
		t.Errorf("RowsTransformed = %d, want 1", result.RowsTransformed)
	}
	if result.RowsFailed != 0 {
		t.Errorf("RowsFailed = %d, want 0", result.RowsFailed)
	}
	if result.NewVersion != "v1.1" {
		t.Errorf("NewVersion = %q, want %q", result.NewVersion, "v1.1")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet DB expectations: %v", err)
	}
	if err := sourceMock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet source DB expectations: %v", err)
	}
}

func TestRetransform_CorrectionNotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	sourceDB, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() source error: %v", err)
	}
	defer sourceDB.Close()

	mock.ExpectQuery("SELECT c.affected_mapping_id").
		WithArgs("nonexistent").
		WillReturnRows(sqlmock.NewRows([]string{"affected_mapping_id", "mapping_version", "status"}))

	pipeline := transformer.NewPipeline(nil)

	_, err = Retransform(db, sourceDB, "nonexistent", pipeline, nil)
	if err == nil {
		t.Fatal("expected error for missing correction, got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestRetransform_CorrectionNotApproved(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	sourceDB, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() source error: %v", err)
	}
	defer sourceDB.Close()

	mock.ExpectQuery("SELECT c.affected_mapping_id").
		WithArgs("corr-proposed").
		WillReturnRows(sqlmock.NewRows([]string{"affected_mapping_id", "mapping_version", "status"}).
			AddRow("map-001", "v1.0", "PROPOSED"))

	pipeline := transformer.NewPipeline(nil)

	_, err = Retransform(db, sourceDB, "corr-proposed", pipeline, nil)
	if err == nil {
		t.Fatal("expected error for non-approved correction, got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestRetransform_NoAffectedRows(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	sourceDB, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() source error: %v", err)
	}
	defer sourceDB.Close()

	// Correction exists and is approved
	mock.ExpectQuery("SELECT c.affected_mapping_id").
		WithArgs("corr-empty").
		WillReturnRows(sqlmock.NewRows([]string{"affected_mapping_id", "mapping_version", "status"}).
			AddRow("map-001", "v2.0", "APPROVED"))

	// No affected rows
	mock.ExpectQuery("SELECT lineage_id, batch_id, source_table, source_id").
		WithArgs("v2.0").
		WillReturnRows(sqlmock.NewRows([]string{
			"lineage_id", "batch_id", "source_table", "source_id",
			"canonical_table", "canonical_id", "mapping_version",
		}))

	pipeline := transformer.NewPipeline(nil)

	result, err := Retransform(db, sourceDB, "corr-empty", pipeline, nil)
	if err != nil {
		t.Fatalf("Retransform error: %v", err)
	}
	if result.RowsAffected != 0 {
		t.Errorf("RowsAffected = %d, want 0", result.RowsAffected)
	}
	if result.RowsTransformed != 0 {
		t.Errorf("RowsTransformed = %d, want 0", result.RowsTransformed)
	}
	if result.NewVersion != "v2.1" {
		t.Errorf("NewVersion = %q, want %q", result.NewVersion, "v2.1")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestRetransform_MultipleAffectedRows(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	sourceDB, sourceMock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() source error: %v", err)
	}
	defer sourceDB.Close()

	// Correction lookup
	mock.ExpectQuery("SELECT c.affected_mapping_id").
		WithArgs("corr-multi").
		WillReturnRows(sqlmock.NewRows([]string{"affected_mapping_id", "mapping_version", "status"}).
			AddRow("map-001", "v1.0", "APPROVED"))

	// Two affected rows
	mock.ExpectQuery("SELECT lineage_id, batch_id, source_table, source_id").
		WithArgs("v1.0").
		WillReturnRows(sqlmock.NewRows([]string{
			"lineage_id", "batch_id", "source_table", "source_id",
			"canonical_table", "canonical_id", "mapping_version",
		}).
			AddRow("lin-001", "batch-001", "source_members", "src-001", "migration.member", "uuid-001", "v1.0").
			AddRow("lin-002", "batch-001", "source_members", "src-002", "migration.member", "uuid-002", "v1.0"))

	mock.ExpectBegin()

	// Row 1: source fetch + update + lineage + supersede
	sourceMock.ExpectQuery("SELECT \\* FROM source_members").
		WithArgs("src-001").
		WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow("src-001", "Alice"))
	mock.ExpectExec("UPDATE migration.member SET").
		WithArgs("Alice", "uuid-001").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("INSERT INTO migration.lineage").
		WithArgs("batch-001", "source_members", "src-001", "migration.member", "uuid-001", "v1.1", "ACTUAL", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"lineage_id"}).AddRow("lin-new-001"))
	mock.ExpectExec("UPDATE migration.lineage SET superseded_by").
		WithArgs("lin-001", "lin-new-001").
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Row 2: source fetch + update + lineage + supersede
	sourceMock.ExpectQuery("SELECT \\* FROM source_members").
		WithArgs("src-002").
		WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow("src-002", "Bob"))
	mock.ExpectExec("UPDATE migration.member SET").
		WithArgs("Bob", "uuid-002").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("INSERT INTO migration.lineage").
		WithArgs("batch-001", "source_members", "src-002", "migration.member", "uuid-002", "v1.1", "ACTUAL", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"lineage_id"}).AddRow("lin-new-002"))
	mock.ExpectExec("UPDATE migration.lineage SET superseded_by").
		WithArgs("lin-002", "lin-new-002").
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectCommit()

	pipeline := transformer.NewPipeline([]transformer.TransformHandler{
		{
			Name:     "Passthrough",
			Priority: 1,
			Apply: func(value interface{}, _ map[string]interface{}, _ transformer.FieldMapping, _ *transformer.TransformContext) (interface{}, error) {
				return value, nil
			},
		},
	})

	newMappings := []transformer.FieldMapping{
		{SourceColumn: "name", CanonicalColumn: "name", SourceType: "varchar", CanonicalType: "VARCHAR"},
	}

	result, err := Retransform(db, sourceDB, "corr-multi", pipeline, newMappings)
	if err != nil {
		t.Fatalf("Retransform error: %v", err)
	}
	if result.RowsAffected != 2 {
		t.Errorf("RowsAffected = %d, want 2", result.RowsAffected)
	}
	if result.RowsTransformed != 2 {
		t.Errorf("RowsTransformed = %d, want 2", result.RowsTransformed)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet DB expectations: %v", err)
	}
	if err := sourceMock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet source DB expectations: %v", err)
	}
}

func TestRetransform_SourceRowNotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	sourceDB, sourceMock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() source error: %v", err)
	}
	defer sourceDB.Close()

	mock.ExpectQuery("SELECT c.affected_mapping_id").
		WithArgs("corr-missing-src").
		WillReturnRows(sqlmock.NewRows([]string{"affected_mapping_id", "mapping_version", "status"}).
			AddRow("map-001", "v1.0", "APPROVED"))

	mock.ExpectQuery("SELECT lineage_id, batch_id, source_table, source_id").
		WithArgs("v1.0").
		WillReturnRows(sqlmock.NewRows([]string{
			"lineage_id", "batch_id", "source_table", "source_id",
			"canonical_table", "canonical_id", "mapping_version",
		}).AddRow("lin-001", "batch-001", "source_members", "src-gone", "migration.member", "uuid-001", "v1.0"))

	mock.ExpectBegin()

	// Source row not found (empty result set)
	sourceMock.ExpectQuery("SELECT \\* FROM source_members").
		WithArgs("src-gone").
		WillReturnRows(sqlmock.NewRows([]string{"id", "name"}))

	mock.ExpectCommit()

	pipeline := transformer.NewPipeline(nil)

	result, err := Retransform(db, sourceDB, "corr-missing-src", pipeline, nil)
	if err != nil {
		t.Fatalf("Retransform error: %v", err)
	}
	if result.RowsAffected != 1 {
		t.Errorf("RowsAffected = %d, want 1", result.RowsAffected)
	}
	if result.RowsFailed != 1 {
		t.Errorf("RowsFailed = %d, want 1", result.RowsFailed)
	}
	if result.RowsTransformed != 0 {
		t.Errorf("RowsTransformed = %d, want 0", result.RowsTransformed)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- updateCanonicalRow tests ---

func TestUpdateCanonicalRow(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	// Sorted columns: first_name, last_name
	mock.ExpectExec("UPDATE migration.member SET first_name").
		WithArgs("Jane", "Doe", "uuid-001").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = updateCanonicalRow(tx, "migration.member", "uuid-001", map[string]interface{}{
		"first_name": "Jane",
		"last_name":  "Doe",
	})
	if err != nil {
		t.Fatalf("updateCanonicalRow error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateCanonicalRow_EmptyRow(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	err = updateCanonicalRow(tx, "migration.member", "uuid-001", map[string]interface{}{})
	if err == nil {
		t.Fatal("expected error for empty row, got nil")
	}
}

func TestUpdateCanonicalRow_DBError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	mock.ExpectExec("UPDATE migration.member SET").
		WithArgs("John", "uuid-001").
		WillReturnError(fmt.Errorf("row not found"))

	err = updateCanonicalRow(tx, "migration.member", "uuid-001", map[string]interface{}{
		"first_name": "John",
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- markSuperseded tests ---

func TestMarkSuperseded(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	mock.ExpectExec("UPDATE migration.lineage SET superseded_by").
		WithArgs("old-lin-001", "new-lin-001").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = markSuperseded(tx, "old-lin-001", "new-lin-001")
	if err != nil {
		t.Fatalf("markSuperseded error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestMarkSuperseded_DBError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	mock.ExpectExec("UPDATE migration.lineage SET superseded_by").
		WithArgs("old-001", "new-001").
		WillReturnError(fmt.Errorf("FK violation"))

	err = markSuperseded(tx, "old-001", "new-001")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- writeLineageReturningID tests ---

func TestWriteLineageReturningID(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectBegin()
	tx, _ := db.Begin()

	mock.ExpectQuery("INSERT INTO migration.lineage").
		WithArgs(
			"batch-001", "source_members", "src-001",
			"migration.member", "uuid-001",
			"v1.1", "ACTUAL",
			sqlmock.AnyArg(),
		).
		WillReturnRows(sqlmock.NewRows([]string{"lineage_id"}).AddRow("new-lin-001"))

	id, err := writeLineageReturningID(tx, LineageEntry{
		BatchID:         "batch-001",
		SourceTable:     "source_members",
		SourceID:        "src-001",
		CanonicalTable:  "migration.member",
		CanonicalID:     "uuid-001",
		MappingVersion:  "v1.1",
		ConfidenceLevel: "ACTUAL",
		Transformations: []TransformAction{},
	})
	if err != nil {
		t.Fatalf("writeLineageReturningID error: %v", err)
	}
	if id != "new-lin-001" {
		t.Errorf("lineage_id = %q, want %q", id, "new-lin-001")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- bumpVersion tests ---

func TestBumpVersion(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"v1.0", "v1.1"},
		{"v2.3", "v2.4"},
		{"v10.99", "v10.100"},
		{"custom", "custom.1"},
	}
	for _, tt := range tests {
		got := bumpVersion(tt.input)
		if got != tt.want {
			t.Errorf("bumpVersion(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
