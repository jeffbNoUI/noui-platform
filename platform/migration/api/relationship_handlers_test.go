package api

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

// relCols matches the 11-column list for source_relationship queries.
var relCols = []string{
	"relationship_id", "profiling_run_id", "parent_table", "parent_column",
	"child_table", "child_column", "relationship_type", "confidence",
	"orphan_count", "orphan_pct", "created_at",
}

func TestListRelationships_Success(t *testing.T) {
	h, mock := newTestHandler(t)
	now := time.Now().UTC()

	// Count query.
	mock.ExpectQuery("SELECT COUNT").
		WithArgs("run-001").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	// Data query.
	mock.ExpectQuery("SELECT .+ FROM migration.source_relationship").
		WithArgs("run-001", 50, 0).
		WillReturnRows(sqlmock.NewRows(relCols).AddRow(
			"rel-001", "run-001", "public.employees", "id",
			"public.salaries", "employee_id", "FK_DECLARED", 1.0,
			5, 0.5, now,
		))

	w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/profiling/run-001/relationships", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatal("expected data object in response")
	}
	rels, ok := data["relationships"].([]interface{})
	if !ok {
		t.Fatal("expected relationships array")
	}
	if len(rels) != 1 {
		t.Errorf("expected 1 relationship, got %d", len(rels))
	}
	if total, ok := data["total"].(float64); !ok || total != 1 {
		t.Errorf("expected total=1, got %v", data["total"])
	}
}

func TestListRelationships_OrphansOnly(t *testing.T) {
	h, mock := newTestHandler(t)

	// Count query with orphan filter.
	mock.ExpectQuery("SELECT COUNT").
		WithArgs("run-001").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	// Data query.
	mock.ExpectQuery("SELECT .+ FROM migration.source_relationship").
		WithArgs("run-001", 50, 0).
		WillReturnRows(sqlmock.NewRows(relCols))

	w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/profiling/run-001/relationships?orphans_only=true", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestListRelationships_MissingRunID(t *testing.T) {
	h, _ := newTestHandler(t)

	// The route requires {runId} in the path — a missing runId will 404.
	w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/profiling//relationships", nil)

	// Missing path component results in route not matching → 404 or 400.
	if w.Code == http.StatusOK {
		t.Error("expected non-200 for missing runId")
	}
}

func TestOrphanSummary_Success(t *testing.T) {
	h, mock := newTestHandler(t)

	mock.ExpectQuery("SELECT").
		WithArgs("run-001").
		WillReturnRows(sqlmock.NewRows([]string{
			"total_relationships", "orphan_relationships", "total_orphan_rows", "highest_orphan_pct",
		}).AddRow(10, 3, 150, 12.5))

	w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/profiling/run-001/orphan-summary", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatal("expected data object in response")
	}
	if tr, ok := data["total_relationships"].(float64); !ok || tr != 10 {
		t.Errorf("expected total_relationships=10, got %v", data["total_relationships"])
	}
	if or, ok := data["orphan_relationships"].(float64); !ok || or != 3 {
		t.Errorf("expected orphan_relationships=3, got %v", data["orphan_relationships"])
	}
}

func TestOrphanSummary_MissingRunID(t *testing.T) {
	h, _ := newTestHandler(t)

	w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/profiling//orphan-summary", nil)

	if w.Code == http.StatusOK {
		t.Error("expected non-200 for missing runId")
	}
}
