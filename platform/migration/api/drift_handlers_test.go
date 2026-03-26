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

// driftRunCols matches the 11-column RETURNING clause for drift_detection_run.
var driftRunCols = []string{
	"run_id", "engagement_id", "status", "drift_type", "baseline_snapshot_id",
	"detected_changes", "critical_changes", "started_at", "completed_at",
	"error_message", "created_at",
}

// driftRecordCols matches the 8-column list for drift_record.
var driftRecordCols = []string{
	"record_id", "run_id", "change_type", "entity", "detail", "severity", "affects_mapping", "created_at",
}

// newTestHandlerWithDrift creates a handler with JobQueue for drift detection tests.
func newTestHandlerWithDrift(t *testing.T) (*Handler, sqlmock.Sqlmock) {
	t.Helper()
	h, mock := newTestHandler(t)
	h.JobQueue = jobqueue.New(h.DB)
	return h, mock
}

// --- AC-5: TestDriftDetectionEndpoint ---

func TestDriftDetectionEndpoint(t *testing.T) {
	t.Run("happy_path_202_accepted", func(t *testing.T) {
		h, mock := newTestHandlerWithDrift(t)
		now := time.Now().UTC()

		// Mock GetEngagement — must return GO_LIVE status.
		mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
				"eng-001", "tenant-001", "LegacyPAS", "1.0",
				string(models.StatusGoLive), nil, nil, nil, "standard", now, now,
			))

		// Mock GetActiveSchemaVersionID.
		mock.ExpectQuery("SELECT version_id FROM migration.schema_version").
			WithArgs("tenant-001").
			WillReturnRows(sqlmock.NewRows([]string{"version_id"}).AddRow("sv-001"))

		// Mock CreateDriftDetectionRun INSERT.
		mock.ExpectQuery("INSERT INTO migration.drift_detection_run").
			WillReturnRows(sqlmock.NewRows(driftRunCols).AddRow(
				"run-001", "eng-001", "PENDING", "BOTH", "sv-001",
				0, 0, nil, nil, nil, now,
			))

		// Mock job queue INSERT (Enqueue scans only job_id).
		mock.ExpectQuery("INSERT INTO migration.job").
			WillReturnRows(sqlmock.NewRows([]string{"job_id"}).AddRow("job-001"))

		body, _ := json.Marshal(models.CreateDriftDetectionRequest{
			DriftType: models.DriftTypeBoth,
		})
		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/drift-detection", body)

		if w.Code != http.StatusAccepted {
			t.Errorf("expected 202, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("rejects_non_go_live_409", func(t *testing.T) {
		h, mock := newTestHandlerWithDrift(t)
		now := time.Now().UTC()

		// Return engagement in MAPPING status.
		mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
				"eng-001", "tenant-001", "LegacyPAS", "1.0",
				string(models.StatusMapping), nil, nil, nil, "standard", now, now,
			))

		body, _ := json.Marshal(models.CreateDriftDetectionRequest{DriftType: models.DriftTypeBoth})
		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/drift-detection", body)

		if w.Code != http.StatusConflict {
			t.Errorf("expected 409, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("not_found_engagement", func(t *testing.T) {
		h, mock := newTestHandlerWithDrift(t)

		mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
			WithArgs("eng-999").
			WillReturnRows(sqlmock.NewRows(engagementCols))

		body, _ := json.Marshal(models.CreateDriftDetectionRequest{DriftType: models.DriftTypeSchema})
		w := serve(h, "POST", "/api/v1/migration/engagements/eng-999/drift-detection", body)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("defaults_to_BOTH_when_no_body", func(t *testing.T) {
		h, mock := newTestHandlerWithDrift(t)
		now := time.Now().UTC()

		mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
				"eng-001", "tenant-001", "LegacyPAS", "1.0",
				string(models.StatusGoLive), nil, nil, nil, "standard", now, now,
			))
		mock.ExpectQuery("SELECT version_id FROM migration.schema_version").
			WithArgs("tenant-001").
			WillReturnRows(sqlmock.NewRows([]string{"version_id"}).AddRow("sv-001"))
		mock.ExpectQuery("INSERT INTO migration.drift_detection_run").
			WillReturnRows(sqlmock.NewRows(driftRunCols).AddRow(
				"run-002", "eng-001", "PENDING", "BOTH", "sv-001",
				0, 0, nil, nil, nil, now,
			))
		mock.ExpectQuery("INSERT INTO migration.job").
			WillReturnRows(sqlmock.NewRows([]string{"job_id"}).AddRow("job-002"))

		// Send with nil body.
		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/drift-detection", nil)

		if w.Code != http.StatusAccepted {
			t.Errorf("expected 202, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("no_job_queue_503", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
				"eng-001", "tenant-001", "LegacyPAS", "1.0",
				string(models.StatusGoLive), nil, nil, nil, "standard", now, now,
			))
		mock.ExpectQuery("SELECT version_id FROM migration.schema_version").
			WithArgs("tenant-001").
			WillReturnRows(sqlmock.NewRows([]string{"version_id"}).AddRow("sv-001"))

		body, _ := json.Marshal(models.CreateDriftDetectionRequest{DriftType: models.DriftTypeBoth})
		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/drift-detection", body)

		if w.Code != http.StatusServiceUnavailable {
			t.Errorf("expected 503, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// --- AC-6: TestDriftDetectionListEndpoints ---

func TestDriftDetectionListEndpoints(t *testing.T) {
	t.Run("list_runs_paginated", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		mock.ExpectQuery("SELECT COUNT").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

		mock.ExpectQuery("SELECT .+ FROM migration.drift_detection_run WHERE engagement_id").
			WithArgs("eng-001", 20, 0).
			WillReturnRows(sqlmock.NewRows(driftRunCols).
				AddRow("run-002", "eng-001", "COMPLETED", "BOTH", "sv-001", 5, 2, now, now, nil, now).
				AddRow("run-001", "eng-001", "COMPLETED", "SCHEMA", "sv-001", 3, 0, now, now, nil, now))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/drift-detection", nil)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].(map[string]interface{})
		if int(data["total"].(float64)) != 2 {
			t.Errorf("expected total=2, got %v", data["total"])
		}
	})

	t.Run("get_single_run_with_records", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		// Mock GetDriftDetectionRun.
		mock.ExpectQuery("SELECT .+ FROM migration.drift_detection_run WHERE run_id").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(driftRunCols).AddRow(
				"run-001", "eng-001", "COMPLETED", "BOTH", "sv-001",
				3, 1, now, now, nil, now,
			))

		// Mock GetDriftRecordsForRun — count.
		mock.ExpectQuery("SELECT COUNT").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

		// Mock GetDriftRecordsForRun — data.
		mock.ExpectQuery("SELECT .+ FROM migration.drift_record WHERE run_id").
			WillReturnRows(sqlmock.NewRows(driftRecordCols).
				AddRow("rec-001", "run-001", "COLUMN_REMOVED", "members.ssn",
					`{"old_type":"varchar"}`, "CRITICAL", true, now).
				AddRow("rec-002", "run-001", "COLUMN_ADDED", "members.middle_name",
					`{"new_type":"varchar"}`, "LOW", false, now))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/drift-detection/run-001", nil)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("get_run_not_found", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mock.ExpectQuery("SELECT .+ FROM migration.drift_detection_run WHERE run_id").
			WithArgs("nonexistent").
			WillReturnRows(sqlmock.NewRows(driftRunCols))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/drift-detection/nonexistent", nil)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("get_run_wrong_engagement", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		// Run belongs to eng-002, not eng-001.
		mock.ExpectQuery("SELECT .+ FROM migration.drift_detection_run WHERE run_id").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(driftRunCols).AddRow(
				"run-001", "eng-002", "COMPLETED", "BOTH", "sv-001",
				0, 0, now, now, nil, now,
			))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/drift-detection/run-001", nil)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 for wrong engagement, got %d", w.Code)
		}
	})

	t.Run("list_records_with_severity_filter", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		// Mock GetDriftDetectionRun.
		mock.ExpectQuery("SELECT .+ FROM migration.drift_detection_run WHERE run_id").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(driftRunCols).AddRow(
				"run-001", "eng-001", "COMPLETED", "BOTH", "sv-001",
				5, 1, now, now, nil, now,
			))

		// Mock count with severity filter.
		mock.ExpectQuery("SELECT COUNT").
			WithArgs("run-001", "CRITICAL").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

		// Mock data query with severity filter.
		mock.ExpectQuery("SELECT .+ FROM migration.drift_record WHERE run_id").
			WillReturnRows(sqlmock.NewRows(driftRecordCols).
				AddRow("rec-001", "run-001", "COLUMN_REMOVED", "members.ssn",
					`{"old_type":"varchar"}`, "CRITICAL", true, now))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/drift-detection/run-001/records?severity=CRITICAL", nil)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("list_records_paginated", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		mock.ExpectQuery("SELECT .+ FROM migration.drift_detection_run WHERE run_id").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows(driftRunCols).AddRow(
				"run-001", "eng-001", "COMPLETED", "BOTH", "sv-001",
				10, 3, now, now, nil, now,
			))

		mock.ExpectQuery("SELECT COUNT").
			WithArgs("run-001").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(10))

		mock.ExpectQuery("SELECT .+ FROM migration.drift_record WHERE run_id").
			WillReturnRows(sqlmock.NewRows(driftRecordCols))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/drift-detection/run-001/records?page=2&per_page=5", nil)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})
}
