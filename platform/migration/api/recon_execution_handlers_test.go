package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/models"
)

// reconExecRunCols matches the 15-column RETURNING clause for recon_execution_run.
var reconExecRunCols = []string{
	"execution_id", "engagement_id", "ruleset_id", "parallel_run_id",
	"status", "total_evaluated", "match_count", "mismatch_count",
	"p1_count", "p2_count", "p3_count",
	"started_at", "completed_at", "error_message", "created_at",
}

func TestReconExecutionEndpoints_CreateValidation(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()
	h := NewHandler(db)

	t.Run("missing parallel_run_id", func(t *testing.T) {
		body := `{}`
		req := httptest.NewRequest("POST", "/api/v1/migration/engagements/eng-001/recon-executions", bytes.NewBufferString(body))
		req.SetPathValue("id", "eng-001")
		w := httptest.NewRecorder()
		h.HandleCreateReconExecution(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", w.Code)
		}
	})

	t.Run("parallel_run not found", func(t *testing.T) {
		mock.ExpectQuery("SELECT .+ FROM migration.parallel_run").
			WithArgs("pr-999").
			WillReturnRows(sqlmock.NewRows([]string{
				"run_id", "engagement_id", "name", "description", "status",
				"legacy_source", "canonical_source", "comparison_mode", "sample_rate",
				"started_by", "started_at", "completed_at", "created_at",
			}))

		body := `{"parallel_run_id":"pr-999"}`
		req := httptest.NewRequest("POST", "/api/v1/migration/engagements/eng-001/recon-executions", bytes.NewBufferString(body))
		req.SetPathValue("id", "eng-001")
		w := httptest.NewRecorder()
		h.HandleCreateReconExecution(w, req)
		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d", w.Code)
		}
	})

	t.Run("parallel_run not completed", func(t *testing.T) {
		now := time.Now().UTC()
		sr := 1.0
		mock.ExpectQuery("SELECT .+ FROM migration.parallel_run").
			WithArgs("pr-001").
			WillReturnRows(sqlmock.NewRows([]string{
				"run_id", "engagement_id", "name", "description", "status",
				"legacy_source", "canonical_source", "comparison_mode", "sample_rate",
				"started_by", "started_at", "completed_at", "created_at",
			}).AddRow("pr-001", "eng-001", "Test", nil, "RUNNING", "src", "tgt", "FULL", &sr, "user", &now, nil, now))

		body := `{"parallel_run_id":"pr-001"}`
		req := httptest.NewRequest("POST", "/api/v1/migration/engagements/eng-001/recon-executions", bytes.NewBufferString(body))
		req.SetPathValue("id", "eng-001")
		w := httptest.NewRecorder()
		h.HandleCreateReconExecution(w, req)
		if w.Code != http.StatusConflict {
			t.Errorf("expected 409, got %d", w.Code)
		}
	})
}

func TestReconExecutionEndpoints_List(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()
	h := NewHandler(db)

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT .+ FROM migration.recon_execution_run").
		WithArgs("eng-001", 20, 0).
		WillReturnRows(sqlmock.NewRows(reconExecRunCols).AddRow(
			"exec-001", "eng-001", "rs-001", "pr-001",
			"COMPLETED", 100, 95, 5, 2, 2, 1,
			&now, &now, nil, now,
		))

	req := httptest.NewRequest("GET", "/api/v1/migration/engagements/eng-001/recon-executions", nil)
	req.SetPathValue("id", "eng-001")
	w := httptest.NewRecorder()
	h.HandleListReconExecutions(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var runs []models.ReconExecutionRun
	json.Unmarshal(w.Body.Bytes(), &runs)
	if len(runs) != 1 {
		t.Errorf("expected 1 run, got %d", len(runs))
	}
}

func TestReconExecutionEndpoints_Get(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()
	h := NewHandler(db)

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT .+ FROM migration.recon_execution_run").
		WithArgs("exec-001").
		WillReturnRows(sqlmock.NewRows(reconExecRunCols).AddRow(
			"exec-001", "eng-001", "rs-001", "pr-001",
			"COMPLETED", 100, 95, 5, 2, 2, 1,
			&now, &now, nil, now,
		))

	req := httptest.NewRequest("GET", "/api/v1/migration/engagements/eng-001/recon-executions/exec-001", nil)
	req.SetPathValue("id", "eng-001")
	req.SetPathValue("execId", "exec-001")
	w := httptest.NewRecorder()
	h.HandleGetReconExecution(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestReconExecutionEndpoints_Mismatches(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock error: %v", err)
	}
	defer db.Close()
	h := NewHandler(db)

	mock.ExpectQuery("SELECT .+ FROM migration.recon_execution_mismatch").
		WithArgs("exec-001", 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{
			"mismatch_id", "execution_id", "rule_id", "member_id",
			"canonical_entity", "field_name", "legacy_value", "new_value",
			"variance_amount", "comparison_type", "tolerance_value", "priority",
			"created_at",
		}))

	req := httptest.NewRequest("GET", "/api/v1/migration/engagements/eng-001/recon-executions/exec-001/mismatches", nil)
	req.SetPathValue("id", "eng-001")
	req.SetPathValue("execId", "exec-001")
	w := httptest.NewRecorder()
	h.HandleListReconExecutionMismatches(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var mismatches []models.ReconExecutionMismatch
	json.Unmarshal(w.Body.Bytes(), &mismatches)
	if len(mismatches) != 0 {
		t.Errorf("expected 0 mismatches, got %d", len(mismatches))
	}
}
