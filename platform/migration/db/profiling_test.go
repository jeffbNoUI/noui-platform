package db

import (
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/models"
)

func TestCreateProfilingRun(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("INSERT INTO migration.profiling_run").
		WithArgs("eng-1", "postgres", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("run-1"))

	id, err := CreateProfilingRun(db, "eng-1", "postgres", "user-1")
	if err != nil {
		t.Fatalf("CreateProfilingRun error: %v", err)
	}
	if id != "run-1" {
		t.Errorf("id = %q, want %q", id, "run-1")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCreateProfilingRunNilDB(t *testing.T) {
	_, err := CreateProfilingRun(nil, "eng-1", "postgres", "user-1")
	if err == nil {
		t.Fatal("expected error for nil db")
	}
}

func TestInsertSourceTable(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	schema := "public"
	rowCount := int64(1000)
	tbl := &models.SourceTableProfile{
		ProfilingRunID: "run-1",
		SchemaName:     &schema,
		TableName:      "employees",
		RowCount:       &rowCount,
		RowCountExact:  false,
		ProfileStatus:  models.TableProfilePending,
	}

	mock.ExpectQuery("INSERT INTO migration.source_table").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("tbl-1"))

	id, err := InsertSourceTable(db, tbl)
	if err != nil {
		t.Fatalf("InsertSourceTable error: %v", err)
	}
	if id != "tbl-1" {
		t.Errorf("id = %q, want %q", id, "tbl-1")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestInsertSourceColumn(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	ordinal := 1
	col := &models.SourceColumnProfile{
		SourceTableID:   "tbl-1",
		ColumnName:      "employee_id",
		OrdinalPosition: &ordinal,
		DataType:        "integer",
		IsNullable:      false,
		IsPrimaryKey:    true,
	}

	mock.ExpectQuery("INSERT INTO migration.source_column").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("col-1"))

	id, err := InsertSourceColumn(db, col)
	if err != nil {
		t.Fatalf("InsertSourceColumn error: %v", err)
	}
	if id != "col-1" {
		t.Errorf("id = %q, want %q", id, "col-1")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateProfilingRunStatus(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	level := 1
	mock.ExpectExec("UPDATE migration.profiling_run").
		WithArgs("run-1", "RUNNING_L1", &level, nil).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = UpdateProfilingRunStatus(db, "run-1", models.ProfilingStatusRunningL1, &level, nil)
	if err != nil {
		t.Fatalf("UpdateProfilingRunStatus error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCountSourceTablesByStatus(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("run-1", "L1_DONE").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))

	count, err := CountSourceTablesByStatus(db, "run-1", models.TableProfileL1Done)
	if err != nil {
		t.Fatalf("CountSourceTablesByStatus error: %v", err)
	}
	if count != 5 {
		t.Errorf("count = %d, want 5", count)
	}
}

func TestNilDBFunctions(t *testing.T) {
	tests := []struct {
		name string
		fn   func() error
	}{
		{"GetProfilingRun", func() error { _, e := GetProfilingRun(nil, "x"); return e }},
		{"ListProfilingRuns", func() error { _, e := ListProfilingRuns(nil, "x"); return e }},
		{"UpdateProfilingRunStatus", func() error { return UpdateProfilingRunStatus(nil, "x", "s", nil, nil) }},
		{"InsertSourceTable", func() error { _, e := InsertSourceTable(nil, &models.SourceTableProfile{}); return e }},
		{"UpdateSourceTableStatus", func() error { return UpdateSourceTableStatus(nil, "x", "s") }},
		{"ListSourceTables", func() error { _, e := ListSourceTables(nil, "x"); return e }},
		{"InsertSourceColumn", func() error { _, e := InsertSourceColumn(nil, &models.SourceColumnProfile{}); return e }},
		{"UpdateSourceColumnStats", func() error { return UpdateSourceColumnStats(nil, "x", &models.SourceColumnProfile{}) }},
		{"ListSourceColumns", func() error { _, e := ListSourceColumns(nil, "x"); return e }},
		{"ListSourceColumnsByRun", func() error { _, e := ListSourceColumnsByRun(nil, "x"); return e }},
		{"GetEngagementSourceConnection", func() error { _, e := GetEngagementSourceConnection(nil, "x"); return e }},
		{"CountSourceTablesByStatus", func() error { _, e := CountSourceTablesByStatus(nil, "x", "s"); return e }},
		{"CountSourceTables", func() error { _, e := CountSourceTables(nil, "x"); return e }},
		{"GetSourceTable", func() error { _, e := GetSourceTable(nil, "x"); return e }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.fn(); err == nil {
				t.Error("expected error for nil db")
			}
		})
	}
}
