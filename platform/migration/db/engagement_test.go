package db

import (
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/models"
)

// engagementCols matches the 9-column RETURNING clause used by engagement queries.
var engagementCols = []string{
	"engagement_id", "tenant_id", "source_system_name", "canonical_schema_version",
	"status", "quality_baseline_approved_at", "source_connection", "created_at", "updated_at",
}

func TestCreateEngagement(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO migration.engagement").
		WithArgs("tenant-1", "LegacyPAS").
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			"eng-001", "tenant-1", "LegacyPAS", "1.0",
			"DISCOVERY", nil, nil, now, now,
		))

	e, err := CreateEngagement(db, "tenant-1", "LegacyPAS")
	if err != nil {
		t.Fatalf("CreateEngagement error: %v", err)
	}
	if e.EngagementID != "eng-001" {
		t.Errorf("EngagementID = %q, want %q", e.EngagementID, "eng-001")
	}
	if e.SourceSystemName != "LegacyPAS" {
		t.Errorf("SourceSystemName = %q, want %q", e.SourceSystemName, "LegacyPAS")
	}
	if e.Status != models.StatusDiscovery {
		t.Errorf("Status = %q, want %q", e.Status, models.StatusDiscovery)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetEngagement(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT .+ FROM migration.engagement").
		WithArgs("eng-001").
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			"eng-001", "tenant-1", "LegacyPAS", "1.0",
			"MAPPING", nil, nil, now, now,
		))

	e, err := GetEngagement(db, "eng-001")
	if err != nil {
		t.Fatalf("GetEngagement error: %v", err)
	}
	if e == nil {
		t.Fatal("GetEngagement returned nil")
	}
	if e.EngagementID != "eng-001" {
		t.Errorf("EngagementID = %q, want %q", e.EngagementID, "eng-001")
	}
	if e.Status != models.StatusMapping {
		t.Errorf("Status = %q, want %q", e.Status, models.StatusMapping)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetEngagement_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT .+ FROM migration.engagement").
		WithArgs("eng-999").
		WillReturnRows(sqlmock.NewRows(engagementCols))

	e, err := GetEngagement(db, "eng-999")
	if err != nil {
		t.Fatalf("GetEngagement error: %v", err)
	}
	if e != nil {
		t.Errorf("expected nil for not-found, got %+v", e)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestUpdateEngagementStatus(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	mock.ExpectQuery("UPDATE migration.engagement").
		WithArgs("eng-001", "MAPPING").
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			"eng-001", "tenant-1", "LegacyPAS", "1.0",
			"MAPPING", nil, nil, now, now,
		))

	e, err := UpdateEngagementStatus(db, "eng-001", models.StatusMapping)
	if err != nil {
		t.Fatalf("UpdateEngagementStatus error: %v", err)
	}
	if e.Status != models.StatusMapping {
		t.Errorf("Status = %q, want %q", e.Status, models.StatusMapping)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestListEngagements(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	rows := sqlmock.NewRows(engagementCols).
		AddRow("eng-002", "tenant-1", "SystemB", "1.0", "PROFILING", nil, nil, now, now).
		AddRow("eng-001", "tenant-1", "SystemA", "1.0", "MAPPING", nil, nil, now.Add(-time.Hour), now)

	mock.ExpectQuery("SELECT .+ FROM migration.engagement").
		WithArgs("tenant-1").
		WillReturnRows(rows)

	engagements, err := ListEngagements(db, "tenant-1")
	if err != nil {
		t.Fatalf("ListEngagements error: %v", err)
	}
	if len(engagements) != 2 {
		t.Fatalf("len(engagements) = %d, want 2", len(engagements))
	}
	if engagements[0].EngagementID != "eng-002" {
		t.Errorf("first engagement = %q, want eng-002", engagements[0].EngagementID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}
