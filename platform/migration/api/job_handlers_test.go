package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/auth"
	"github.com/noui/platform/migration/jobqueue"
)

// --- helpers for job handler tests ---

// jobCols is the standard column list for migration.job queries in test mocks.
var jobCols = []string{
	"job_id", "engagement_id", "job_type", "scope", "status", "priority", "progress",
	"input_json", "result_json", "error_message", "worker_id", "attempt", "max_attempts",
	"created_at", "claimed_at", "heartbeat_at", "completed_at",
}

func newTestHandlerWithJobQueue(t *testing.T) (*Handler, *jobqueue.Queue, sqlmock.Sqlmock) {
	t.Helper()
	h, mock := newTestHandler(t)
	q := jobqueue.New(h.DB)
	h.JobQueue = q
	return h, q, mock
}

// serveWithRole dispatches a request through a real ServeMux with auth context injected.
func serveWithRole(h *Handler, method, path string, body []byte, role string) *httptest.ResponseRecorder {
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	var req *http.Request
	if body != nil {
		req = httptest.NewRequest(method, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	ctx := auth.WithTestClaims(req.Context(), "tenant-001", role, "user-001")
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}

// --- AC-1: ListJobs with pagination, filtering, sort ---

func TestListJobs(t *testing.T) {
	t.Run("happy_path", func(t *testing.T) {
		h, _, mock := newTestHandlerWithJobQueue(t)

		now := time.Now()
		mock.ExpectQuery(`SELECT .+ FROM migration\.job WHERE engagement_id`).
			WillReturnRows(sqlmock.NewRows(jobCols).
				AddRow("job-1", "eng-001", "profile_l1", "members", "COMPLETE", 10, 100,
					[]byte(`{}`), []byte(`{}`), nil, nil, 1, 3,
					now, nil, nil, &now).
				AddRow("job-2", "eng-001", "map_fields", "salary", "PENDING", 5, 0,
					[]byte(`{}`), nil, nil, nil, 0, 3,
					now.Add(-time.Minute), nil, nil, nil))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/jobs", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Data []jobqueue.Job `json:"data"`
		}
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if len(resp.Data) != 2 {
			t.Fatalf("expected 2 jobs, got %d", len(resp.Data))
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("filter_by_status", func(t *testing.T) {
		h, _, mock := newTestHandlerWithJobQueue(t)

		now := time.Now()
		mock.ExpectQuery(`SELECT .+ FROM migration\.job WHERE engagement_id`).
			WillReturnRows(sqlmock.NewRows(jobCols).
				AddRow("job-1", "eng-001", "profile_l1", "members", "FAILED", 10, 50,
					[]byte(`{}`), nil, stringPtr("timeout"), nil, 3, 3,
					now, nil, nil, &now))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/jobs?status=FAILED", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("filter_by_type", func(t *testing.T) {
		h, _, mock := newTestHandlerWithJobQueue(t)

		mock.ExpectQuery(`SELECT .+ FROM migration\.job WHERE engagement_id`).
			WillReturnRows(sqlmock.NewRows(jobCols))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/jobs?type=profile_l1", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
		var resp struct {
			Data []jobqueue.Job `json:"data"`
		}
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if len(resp.Data) != 0 {
			t.Fatalf("expected 0 jobs, got %d", len(resp.Data))
		}
	})

	t.Run("cursor_pagination", func(t *testing.T) {
		h, _, mock := newTestHandlerWithJobQueue(t)

		now := time.Now()
		mock.ExpectQuery(`SELECT .+ FROM migration\.job WHERE engagement_id`).
			WillReturnRows(sqlmock.NewRows(jobCols).
				AddRow("job-3", "eng-001", "profile_l1", "t1", "PENDING", 0, 0,
					[]byte(`{}`), nil, nil, nil, 0, 3,
					now.Add(-2*time.Hour), nil, nil, nil))

		cursor := now.Add(-time.Hour).Format(time.RFC3339Nano)
		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/jobs?cursor="+cursor+"&cursor_id=job-2&limit=10", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})
}

// --- AC-2: GetJob (engagement-scoped) ---

func TestGetJob(t *testing.T) {
	t.Run("happy_path", func(t *testing.T) {
		h, _, mock := newTestHandlerWithJobQueue(t)

		now := time.Now()
		mock.ExpectQuery(`SELECT .+ FROM migration\.job WHERE job_id`).
			WithArgs("job-001", "eng-001").
			WillReturnRows(sqlmock.NewRows(jobCols).AddRow(
				"job-001", "eng-001", "profile_l1", "members", "RUNNING", 10, 45,
				[]byte(`{"table":"members"}`), nil, nil, stringPtr("worker-1"), 1, 3,
				now, &now, &now, nil,
			))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/jobs/job-001", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("not_found", func(t *testing.T) {
		h, _, mock := newTestHandlerWithJobQueue(t)

		mock.ExpectQuery(`SELECT .+ FROM migration\.job WHERE job_id`).
			WithArgs("job-999", "eng-001").
			WillReturnRows(sqlmock.NewRows(jobCols))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/jobs/job-999", nil)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404; body: %s", w.Code, w.Body.String())
		}
	})
}

// --- AC-3: CancelJob (409 for RUNNING, broadcast WS event) ---

func TestCancelJob(t *testing.T) {
	t.Run("cancel_pending", func(t *testing.T) {
		h, _, mock := newTestHandlerWithJobQueue(t)

		mock.ExpectExec(`UPDATE migration\.job SET status = 'CANCELLED'`).
			WithArgs("job-001", "eng-001").
			WillReturnResult(sqlmock.NewResult(0, 1))

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/jobs/job-001/cancel", nil, "editor")

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("cancel_running_409", func(t *testing.T) {
		h, _, mock := newTestHandlerWithJobQueue(t)

		mock.ExpectExec(`UPDATE migration\.job SET status = 'CANCELLED'`).
			WithArgs("job-002", "eng-001").
			WillReturnResult(sqlmock.NewResult(0, 0))

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/jobs/job-002/cancel", nil, "editor")

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("cancel_terminal_409", func(t *testing.T) {
		h, _, mock := newTestHandlerWithJobQueue(t)

		mock.ExpectExec(`UPDATE migration\.job SET status = 'CANCELLED'`).
			WithArgs("job-003", "eng-001").
			WillReturnResult(sqlmock.NewResult(0, 0))

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/jobs/job-003/cancel", nil, "editor")

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
	})
}

// --- AC-4: RetryJob (409 for non-FAILED) ---

func TestRetryJob(t *testing.T) {
	t.Run("retry_failed", func(t *testing.T) {
		h, _, mock := newTestHandlerWithJobQueue(t)

		mock.ExpectExec(`UPDATE migration\.job SET status = 'PENDING'`).
			WithArgs("job-001", "eng-001").
			WillReturnResult(sqlmock.NewResult(0, 1))

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/jobs/job-001/retry", nil, "editor")

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("retry_non_failed_409", func(t *testing.T) {
		h, _, mock := newTestHandlerWithJobQueue(t)

		mock.ExpectExec(`UPDATE migration\.job SET status = 'PENDING'`).
			WithArgs("job-002", "eng-001").
			WillReturnResult(sqlmock.NewResult(0, 0))

		w := serveWithRole(h, "POST", "/api/v1/migration/engagements/eng-001/jobs/job-002/retry", nil, "editor")

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
	})
}

// --- AC-5: JobSummary (counts by status + avg exec time) ---

func TestJobSummary(t *testing.T) {
	t.Run("happy_path", func(t *testing.T) {
		h, _, mock := newTestHandlerWithJobQueue(t)

		mock.ExpectQuery(`SELECT status, COUNT`).
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows([]string{"status", "count", "avg_seconds"}).
				AddRow("PENDING", 5, nil).
				AddRow("RUNNING", 2, nil).
				AddRow("COMPLETE", 10, 45.5).
				AddRow("FAILED", 1, 12.0))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/jobs/summary", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Data map[string]interface{} `json:"data"`
		}
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode error: %v", err)
		}

		counts, ok := resp.Data["counts"].(map[string]interface{})
		if !ok {
			t.Fatalf("expected counts object, got %T", resp.Data["counts"])
		}
		if counts["COMPLETE"] != float64(10) {
			t.Errorf("expected COMPLETE=10, got %v", counts["COMPLETE"])
		}
		if counts["PENDING"] != float64(5) {
			t.Errorf("expected PENDING=5, got %v", counts["PENDING"])
		}

		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("no_jobs", func(t *testing.T) {
		h, _, mock := newTestHandlerWithJobQueue(t)

		mock.ExpectQuery(`SELECT status, COUNT`).
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows([]string{"status", "count", "avg_seconds"}))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/jobs/summary", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Data map[string]interface{} `json:"data"`
		}
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode error: %v", err)
		}
		if resp.Data["total"] != float64(0) {
			t.Errorf("expected total=0, got %v", resp.Data["total"])
		}
	})
}

// --- AC-6: Auth checks ---

func TestJobAuth(t *testing.T) {
	t.Run("cancel_requires_editor", func(t *testing.T) {
		h, _, _ := newTestHandlerWithJobQueue(t)

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/jobs/job-001/cancel", nil)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("retry_requires_editor", func(t *testing.T) {
		h, _, _ := newTestHandlerWithJobQueue(t)

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/jobs/job-001/retry", nil)

		if w.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("list_allows_viewer", func(t *testing.T) {
		h, _, mock := newTestHandlerWithJobQueue(t)

		mock.ExpectQuery(`SELECT .+ FROM migration\.job WHERE engagement_id`).
			WillReturnRows(sqlmock.NewRows(jobCols))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/jobs", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
	})
}
