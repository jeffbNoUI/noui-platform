package db

import (
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/models"
)

func TestInsertSourceRelationships(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	rels := []models.SourceRelationship{
		{
			ProfilingRunID:   "run-1",
			ParentTable:      "public.employees",
			ParentColumn:     "id",
			ChildTable:       "public.salaries",
			ChildColumn:      "employee_id",
			RelationshipType: models.RelationshipFKDeclared,
			Confidence:       1.0,
			OrphanCount:      5,
			OrphanPct:        0.5,
		},
		{
			ProfilingRunID:   "run-1",
			ParentTable:      "public.departments",
			ParentColumn:     "id",
			ChildTable:       "public.employees",
			ChildColumn:      "department_id",
			RelationshipType: models.RelationshipFKInferred,
			Confidence:       0.9,
			OrphanCount:      0,
			OrphanPct:        0.0,
		},
	}

	mock.ExpectExec("INSERT INTO migration.source_relationship").
		WithArgs(
			"run-1", "public.employees", "id", "public.salaries", "employee_id", "FK_DECLARED", 1.0, 5, 0.5,
			"run-1", "public.departments", "id", "public.employees", "department_id", "FK_INFERRED", 0.9, 0, 0.0,
		).
		WillReturnResult(sqlmock.NewResult(0, 2))

	err = InsertSourceRelationships(db, rels)
	if err != nil {
		t.Fatalf("InsertSourceRelationships error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestInsertSourceRelationshipsEmpty(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	err = InsertSourceRelationships(db, nil)
	if err != nil {
		t.Fatalf("InsertSourceRelationships(nil) should not error: %v", err)
	}
}

func TestInsertSourceRelationshipsNilDB(t *testing.T) {
	err := InsertSourceRelationships(nil, []models.SourceRelationship{{ProfilingRunID: "run-1"}})
	if err == nil {
		t.Fatal("expected error for nil db")
	}
}

func TestListSourceRelationships(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	// Expect count query.
	mock.ExpectQuery("SELECT COUNT").
		WithArgs("run-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	// Expect data query.
	rows := sqlmock.NewRows([]string{
		"relationship_id", "profiling_run_id", "parent_table", "parent_column",
		"child_table", "child_column", "relationship_type", "confidence",
		"orphan_count", "orphan_pct", "created_at",
	}).
		AddRow("rel-1", "run-1", "public.employees", "id", "public.salaries", "employee_id", "FK_DECLARED", 1.0, 5, 0.5, time.Now().UTC())

	mock.ExpectQuery("SELECT .+ FROM migration.source_relationship").
		WithArgs("run-1", 50, 0).
		WillReturnRows(rows)

	rels, total, err := ListSourceRelationships(db, "run-1", false, 1, 50)
	if err != nil {
		t.Fatalf("ListSourceRelationships error: %v", err)
	}
	if total != 2 {
		t.Errorf("total = %d, want 2", total)
	}
	if len(rels) != 1 {
		t.Errorf("len(rels) = %d, want 1", len(rels))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListSourceRelationshipsOrphansOnly(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT COUNT").
		WithArgs("run-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	rows := sqlmock.NewRows([]string{
		"relationship_id", "profiling_run_id", "parent_table", "parent_column",
		"child_table", "child_column", "relationship_type", "confidence",
		"orphan_count", "orphan_pct", "created_at",
	}).
		AddRow("rel-1", "run-1", "public.employees", "id", "public.salaries", "employee_id", "FK_DECLARED", 1.0, 5, 0.5, time.Now().UTC())

	mock.ExpectQuery("SELECT .+ FROM migration.source_relationship").
		WithArgs("run-1", 50, 0).
		WillReturnRows(rows)

	rels, total, err := ListSourceRelationships(db, "run-1", true, 1, 50)
	if err != nil {
		t.Fatalf("ListSourceRelationships error: %v", err)
	}
	if total != 1 {
		t.Errorf("total = %d, want 1", total)
	}
	if len(rels) != 1 {
		t.Errorf("len(rels) = %d, want 1", len(rels))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListSourceRelationshipsNilDB(t *testing.T) {
	_, _, err := ListSourceRelationships(nil, "run-1", false, 1, 50)
	if err == nil {
		t.Fatal("expected error for nil db")
	}
}

func TestGetOrphanSummary(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT").
		WithArgs("run-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"total_relationships", "orphan_relationships", "total_orphan_rows", "highest_orphan_pct",
		}).AddRow(10, 3, 150, 12.5))

	summary, err := GetOrphanSummary(db, "run-1")
	if err != nil {
		t.Fatalf("GetOrphanSummary error: %v", err)
	}
	if summary.TotalRelationships != 10 {
		t.Errorf("TotalRelationships = %d, want 10", summary.TotalRelationships)
	}
	if summary.OrphanRelationships != 3 {
		t.Errorf("OrphanRelationships = %d, want 3", summary.OrphanRelationships)
	}
	if summary.TotalOrphanRows != 150 {
		t.Errorf("TotalOrphanRows = %d, want 150", summary.TotalOrphanRows)
	}
	if summary.HighestOrphanPct != 12.5 {
		t.Errorf("HighestOrphanPct = %f, want 12.5", summary.HighestOrphanPct)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetOrphanSummaryNilDB(t *testing.T) {
	_, err := GetOrphanSummary(nil, "run-1")
	if err == nil {
		t.Fatal("expected error for nil db")
	}
}
