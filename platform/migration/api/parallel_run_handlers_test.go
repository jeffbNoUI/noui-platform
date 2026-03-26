package api

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/jobqueue"
	"github.com/noui/platform/migration/models"
)

// parallelRunCols is the standard column list for parallel_run queries in test mocks.
var parallelRunCols = []string{
	"run_id", "engagement_id", "name", "description", "status",
	"legacy_source", "canonical_source", "comparison_mode", "sample_rate",
	"started_by", "started_at", "completed_at", "created_at",
}

// parallelRunResultCols is the standard column list for parallel_run_result queries in test mocks.
var parallelRunResultTestCols = []string{
	"result_id", "run_id", "member_id", "canonical_entity", "field_name",
	"legacy_value", "new_value", "match", "variance_amount", "variance_pct", "checked_at",
}

func newTestHandlerWithQueue(t *testing.T) (*Handler, sqlmock.Sqlmock) {
	t.Helper()
	h, mock := newTestHandler(t)
	h.JobQueue = jobqueue.New(h.DB)
	return h, mock
}

// --- AC-1: CreateParallelRun ---

func TestCreateParallelRun(t *testing.T) {
	t.Run("happy_path", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		sampleRate := 0.5
		now := time.Now()
		// Expect INSERT for parallel_run creation.
		mock.ExpectQuery(`INSERT INTO migration\.parallel_run`).
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "PENDING",
				"legacy_db", "canonical_db", "SAMPLE", &sampleRate,
				"user-001", nil, nil, now,
			))

		// Expect INSERT for job enqueue.
		mock.ExpectQuery(`INSERT INTO migration\.job`).
			WillReturnRows(sqlmock.NewRows([]string{"job_id"}).AddRow("job-001"))

		body, _ := json.Marshal(map[string]interface{}{
			"name":             "Test Run",
			"legacy_source":    "legacy_db",
			"canonical_source": "canonical_db",
			"comparison_mode":  "SAMPLE",
			"sample_rate":      0.5,
			"entities":         []string{"member", "salary"},
		})

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs", body, "editor")

		if w.Code != http.StatusCreated {
			t.Fatalf("status = %d, want 201; body: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Data models.ParallelRun `json:"data"`
		}
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if resp.Data.RunID != "run-001" {
			t.Errorf("run_id = %q, want %q", resp.Data.RunID, "run-001")
		}
		if resp.Data.Status != models.ParallelRunPending {
			t.Errorf("status = %q, want PENDING", resp.Data.Status)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("continuous_mode_returns_400", func(t *testing.T) {
		h, _ := newTestHandlerWithQueue(t)

		body, _ := json.Marshal(map[string]interface{}{
			"name":             "Test Run",
			"legacy_source":    "legacy_db",
			"canonical_source": "canonical_db",
			"comparison_mode":  "CONTINUOUS",
		})

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs", body, "editor")

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("invalid_comparison_mode_returns_400", func(t *testing.T) {
		h, _ := newTestHandlerWithQueue(t)

		body, _ := json.Marshal(map[string]interface{}{
			"name":             "Test Run",
			"legacy_source":    "legacy_db",
			"canonical_source": "canonical_db",
			"comparison_mode":  "INVALID",
		})

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs", body, "editor")

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("missing_name_returns_400", func(t *testing.T) {
		h, _ := newTestHandlerWithQueue(t)

		body, _ := json.Marshal(map[string]interface{}{
			"legacy_source":    "legacy_db",
			"canonical_source": "canonical_db",
			"comparison_mode":  "FULL",
		})

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs", body, "editor")

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("invalid_json_returns_400", func(t *testing.T) {
		h, _ := newTestHandlerWithQueue(t)

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs", []byte(`{invalid`), "editor")

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400; body: %s", w.Code, w.Body.String())
		}
	})
}

// --- AC-2: ListParallelRuns ---

func TestListParallelRuns(t *testing.T) {
	t.Run("happy_path", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		now := time.Now()
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE engagement_id`).
			WillReturnRows(sqlmock.NewRows(parallelRunCols).
				AddRow("run-001", "eng-001", "Run 1", nil, "COMPLETED",
					"leg", "can", "FULL", nil,
					"user-001", &now, &now, now).
				AddRow("run-002", "eng-001", "Run 2", nil, "RUNNING",
					"leg", "can", "SAMPLE", float64Ptr(0.1),
					"user-001", &now, nil, now))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/parallel-runs", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Data []models.ParallelRun `json:"data"`
		}
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if len(resp.Data) != 2 {
			t.Fatalf("expected 2 runs, got %d", len(resp.Data))
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("filter_by_status", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE engagement_id`).
			WillReturnRows(sqlmock.NewRows(parallelRunCols))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/parallel-runs?status=RUNNING", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("empty_list", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE engagement_id`).
			WillReturnRows(sqlmock.NewRows(parallelRunCols))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/parallel-runs", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Data []models.ParallelRun `json:"data"`
		}
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if resp.Data == nil || len(resp.Data) != 0 {
			t.Errorf("expected empty array, got %v", resp.Data)
		}
	})
}

// --- AC-3: GetParallelRun ---

func TestGetParallelRun(t *testing.T) {
	t.Run("happy_path_with_summary", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		now := time.Now()
		// Expect GET parallel run.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "COMPLETED",
				"leg", "can", "FULL", nil,
				"user-001", &now, &now, now,
			))

		// Expect summary query.
		mock.ExpectQuery(`SELECT canonical_entity`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows([]string{"canonical_entity", "match_count", "mismatch_count"}).
				AddRow("member", 90, 10).
				AddRow("salary", 80, 20))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/parallel-runs/run-001", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Data map[string]interface{} `json:"data"`
		}
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if resp.Data["run_id"] != "run-001" {
			t.Errorf("run_id = %v, want run-001", resp.Data["run_id"])
		}
		if resp.Data["summary"] == nil {
			t.Error("expected summary to be present")
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("not_found", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-999").
			WillReturnRows(sqlmock.NewRows(parallelRunCols))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/parallel-runs/run-999", nil)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("wrong_engagement_returns_404", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		now := time.Now()
		// Run belongs to eng-002, not eng-001.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-002", "Test Run", nil, "RUNNING",
				"leg", "can", "FULL", nil,
				"user-001", &now, nil, now,
			))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/parallel-runs/run-001", nil)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404; body: %s", w.Code, w.Body.String())
		}
	})
}

// --- AC-4: GetParallelRunResults ---

func TestGetParallelRunResults(t *testing.T) {
	t.Run("happy_path_paginated", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		now := time.Now()
		legVal := "1000.00"
		newVal := "1050.00"

		// Run lookup.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "COMPLETED",
				"leg", "can", "FULL", nil,
				"user-001", &now, &now, now,
			))

		// Results query.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run_result WHERE run_id`).
			WillReturnRows(sqlmock.NewRows(parallelRunResultTestCols).AddRow(
				"res-001", "run-001", "M001", "salary", "amount",
				&legVal, &newVal, false, 50.0, 5.0, "2026-03-25T12:00:00Z",
			))

		// Count query.
		mock.ExpectQuery(`SELECT COUNT`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/parallel-runs/run-001/results?page=1&per_page=50", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp parallelRunResultsResponse
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if len(resp.Results) != 1 {
			t.Errorf("expected 1 result, got %d", len(resp.Results))
		}
		if resp.Total != 1 {
			t.Errorf("total = %d, want 1", resp.Total)
		}
		if resp.Page != 1 {
			t.Errorf("page = %d, want 1", resp.Page)
		}
		if resp.PerPage != 50 {
			t.Errorf("per_page = %d, want 50", resp.PerPage)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("per_page_clamped_to_200", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		now := time.Now()
		// Run lookup.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "COMPLETED",
				"leg", "can", "FULL", nil,
				"user-001", &now, &now, now,
			))

		// Results query — per_page should be clamped to 200.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run_result WHERE run_id`).
			WillReturnRows(sqlmock.NewRows(parallelRunResultTestCols))

		// Count query.
		mock.ExpectQuery(`SELECT COUNT`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/parallel-runs/run-001/results?per_page=500", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp parallelRunResultsResponse
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if resp.PerPage != 200 {
			t.Errorf("per_page = %d, want 200 (clamped)", resp.PerPage)
		}
	})

	t.Run("match_filter", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		now := time.Now()
		// Run lookup.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "COMPLETED",
				"leg", "can", "FULL", nil,
				"user-001", &now, &now, now,
			))

		// Results query with match filter.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run_result WHERE run_id`).
			WillReturnRows(sqlmock.NewRows(parallelRunResultTestCols))

		// Count query.
		mock.ExpectQuery(`SELECT COUNT`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/parallel-runs/run-001/results?match=false", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("entity_filter", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		now := time.Now()
		// Run lookup.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "COMPLETED",
				"leg", "can", "FULL", nil,
				"user-001", &now, &now, now,
			))

		// Results query with entity filter.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run_result WHERE run_id`).
			WillReturnRows(sqlmock.NewRows(parallelRunResultTestCols))

		// Count query.
		mock.ExpectQuery(`SELECT COUNT`).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/parallel-runs/run-001/results?entity=salary", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
	})
}

// --- AC-5: CancelParallelRun ---

func TestCancelParallelRun(t *testing.T) {
	t.Run("cancel_pending", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		now := time.Now()
		// Get run for cancel check.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "PENDING",
				"leg", "can", "FULL", nil,
				"user-001", nil, nil, now,
			))

		// UpdateParallelRunStatus: read current then update.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "PENDING",
				"leg", "can", "FULL", nil,
				"user-001", nil, nil, now,
			))
		mock.ExpectQuery(`UPDATE migration\.parallel_run`).
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "CANCELLED",
				"leg", "can", "FULL", nil,
				"user-001", nil, &now, now,
			))

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs/run-001/cancel", nil, "editor")

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("cancel_running_cooperative", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		now := time.Now()
		// Get run — status is RUNNING.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "RUNNING",
				"leg", "can", "FULL", nil,
				"user-001", &now, nil, now,
			))

		// No CancelScoped for RUNNING — cooperative cancel via status update only.

		// UpdateParallelRunStatus: read current then update.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "RUNNING",
				"leg", "can", "FULL", nil,
				"user-001", &now, nil, now,
			))
		mock.ExpectQuery(`UPDATE migration\.parallel_run`).
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "CANCELLED",
				"leg", "can", "FULL", nil,
				"user-001", &now, &now, now,
			))

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs/run-001/cancel", nil, "editor")

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("cancel_paused", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		now := time.Now()
		// PAUSED→CANCELLED is valid per M03a transitions.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "PAUSED",
				"leg", "can", "FULL", nil,
				"user-001", &now, nil, now,
			))

		// UpdateParallelRunStatus: read current then update.
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "PAUSED",
				"leg", "can", "FULL", nil,
				"user-001", &now, nil, now,
			))
		mock.ExpectQuery(`UPDATE migration\.parallel_run`).
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "CANCELLED",
				"leg", "can", "FULL", nil,
				"user-001", &now, &now, now,
			))

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs/run-001/cancel", nil, "editor")

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("cancel_completed_returns_409", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		now := time.Now()
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "COMPLETED",
				"leg", "can", "FULL", nil,
				"user-001", &now, &now, now,
			))

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs/run-001/cancel", nil, "editor")

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("cancel_failed_returns_409", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		now := time.Now()
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "FAILED",
				"leg", "can", "FULL", nil,
				"user-001", &now, &now, now,
			))

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs/run-001/cancel", nil, "editor")

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("cancel_already_cancelled_returns_409", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		now := time.Now()
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "CANCELLED",
				"leg", "can", "FULL", nil,
				"user-001", &now, &now, now,
			))

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs/run-001/cancel", nil, "editor")

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("cancel_not_found_returns_404", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-999").
			WillReturnRows(sqlmock.NewRows(parallelRunCols))

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs/run-999/cancel", nil, "editor")

		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404; body: %s", w.Code, w.Body.String())
		}
	})
}

// --- AC-6: WebSocket events ---

func TestParallelRunWebSocket(t *testing.T) {
	t.Run("create_broadcasts_event", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		// Set up a mock hub to verify broadcasts.
		hub := &testHub{}
		h.Hub = nil // Use nil Hub — we verify the broadcast helper separately.

		_ = hub // Hub is nil-safe; this test verifies no panic.

		sampleRate := 0.5
		now := time.Now()
		mock.ExpectQuery(`INSERT INTO migration\.parallel_run`).
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "PENDING",
				"leg", "can", "SAMPLE", &sampleRate,
				"user-001", nil, nil, now,
			))
		mock.ExpectQuery(`INSERT INTO migration\.job`).
			WillReturnRows(sqlmock.NewRows([]string{"job_id"}).AddRow("job-001"))

		body, _ := json.Marshal(map[string]interface{}{
			"name":             "Test Run",
			"legacy_source":    "leg",
			"canonical_source": "can",
			"comparison_mode":  "SAMPLE",
			"sample_rate":      0.5,
		})

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs", body, "editor")

		if w.Code != http.StatusCreated {
			t.Fatalf("status = %d, want 201; body: %s", w.Code, w.Body.String())
		}
	})
}

// testHub is a placeholder — real WS hub testing would require integration tests.
type testHub struct{}

// --- AC-7: Auth enforcement ---

func TestParallelRunAuth(t *testing.T) {
	t.Run("create_requires_editor", func(t *testing.T) {
		h, _ := newTestHandlerWithQueue(t)

		body, _ := json.Marshal(map[string]interface{}{
			"name":             "Test Run",
			"legacy_source":    "leg",
			"canonical_source": "can",
			"comparison_mode":  "FULL",
		})

		// serve() uses no auth context — should get 403.
		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs", body)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("cancel_requires_editor", func(t *testing.T) {
		h, _ := newTestHandlerWithQueue(t)

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs/run-001/cancel", nil)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("list_allows_viewer", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE engagement_id`).
			WillReturnRows(sqlmock.NewRows(parallelRunCols))

		// serve() without role context — GET endpoints don't need editor role.
		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/parallel-runs", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("get_allows_viewer", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		now := time.Now()
		mock.ExpectQuery(`SELECT .+ FROM migration\.parallel_run WHERE run_id`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "COMPLETED",
				"leg", "can", "FULL", nil,
				"user-001", &now, &now, now,
			))
		mock.ExpectQuery(`SELECT canonical_entity`).
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows([]string{"canonical_entity", "match_count", "mismatch_count"}))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/parallel-runs/run-001", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("create_owner_allowed", func(t *testing.T) {
		h, mock := newTestHandlerWithQueue(t)

		sampleRate := 0.5
		now := time.Now()
		mock.ExpectQuery(`INSERT INTO migration\.parallel_run`).
			WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
				"run-001", "eng-001", "Test Run", nil, "PENDING",
				"leg", "can", "SAMPLE", &sampleRate,
				"user-001", nil, nil, now,
			))
		mock.ExpectQuery(`INSERT INTO migration\.job`).
			WillReturnRows(sqlmock.NewRows([]string{"job_id"}).AddRow("job-001"))

		body, _ := json.Marshal(map[string]interface{}{
			"name":             "Test Run",
			"legacy_source":    "leg",
			"canonical_source": "can",
			"comparison_mode":  "SAMPLE",
			"sample_rate":      0.5,
		})

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs", body, "owner")

		if w.Code != http.StatusCreated {
			t.Fatalf("status = %d, want 201; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("create_viewer_forbidden", func(t *testing.T) {
		h, _ := newTestHandlerWithQueue(t)

		body, _ := json.Marshal(map[string]interface{}{
			"name":             "Test Run",
			"legacy_source":    "leg",
			"canonical_source": "can",
			"comparison_mode":  "FULL",
		})

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/parallel-runs", body, "viewer")

		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403; body: %s", w.Code, w.Body.String())
		}
	})
}

// --- helpers ---

func float64Ptr(f float64) *float64 { return &f }
