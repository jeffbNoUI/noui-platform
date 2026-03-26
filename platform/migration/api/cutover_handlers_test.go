package api

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/models"
)

// cutoverPlanTestCols matches the 11-column RETURNING clause for cutover_plan queries.
var cutoverPlanTestCols = []string{
	"plan_id", "engagement_id", "status", "steps", "rollback_steps",
	"approved_by", "approved_at", "started_at", "completed_at", "created_at", "updated_at",
}

// mockGetEngagement sets up a mock for GetEngagement returning the given status.
func mockGetEngagement(mock sqlmock.Sqlmock, engID string, status models.EngagementStatus) {
	now := time.Now().UTC()
	mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
		WithArgs(engID).
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			engID, "tenant-001", "LegacyPAS", "1.0",
			string(status), nil, nil, nil, "standard", now, now,
		))
}

// mockGetEngagementNotFound sets up a mock for GetEngagement returning no rows.
func mockGetEngagementNotFound(mock sqlmock.Sqlmock, engID string) {
	mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
		WithArgs(engID).
		WillReturnRows(sqlmock.NewRows(engagementCols))
}

// mockHasActiveCutoverPlan sets up a mock for HasActiveCutoverPlan.
func mockHasActiveCutoverPlan(mock sqlmock.Sqlmock, engID string, count int) {
	mock.ExpectQuery("SELECT COUNT").
		WithArgs(engID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(count))
}

// mockCreateCutoverPlan sets up a mock for CreateCutoverPlan INSERT.
func mockCreateCutoverPlan(mock sqlmock.Sqlmock, planID, engID string) {
	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO migration.cutover_plan").
		WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
			planID, engID, "DRAFT",
			`[{"step_id":"step-1","label":"Stop legacy","order":1,"type":"MANUAL","status":"PENDING"}]`,
			`[{"step_id":"rollback-1","label":"Restart legacy","order":1,"type":"MANUAL","status":"PENDING"}]`,
			nil, nil, nil, nil, now, now,
		))
}

// mockGetCutoverPlan sets up a mock for GetCutoverPlan.
func mockGetCutoverPlan(mock sqlmock.Sqlmock, planID, engID string, status models.CutoverPlanStatus, steps string) {
	now := time.Now().UTC()
	mock.ExpectQuery("SELECT .+ FROM migration.cutover_plan WHERE plan_id").
		WithArgs(planID).
		WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
			planID, engID, string(status),
			steps, `[]`,
			nil, nil, nil, nil, now, now,
		))
}

// mockGetCutoverPlanNotFound sets up a mock for GetCutoverPlan returning no rows.
func mockGetCutoverPlanNotFound(mock sqlmock.Sqlmock, planID string) {
	mock.ExpectQuery("SELECT .+ FROM migration.cutover_plan WHERE plan_id").
		WithArgs(planID).
		WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols))
}

// mockUpdateCutoverPlanStatus sets up a mock for UpdateCutoverPlanStatus.
func mockUpdateCutoverPlanStatus(mock sqlmock.Sqlmock, planID, engID string, newStatus models.CutoverPlanStatus) {
	now := time.Now().UTC()
	mock.ExpectQuery("UPDATE migration.cutover_plan").
		WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
			planID, engID, string(newStatus),
			`[{"step_id":"step-1","label":"Stop legacy","order":1,"type":"MANUAL","status":"PENDING"}]`,
			`[]`,
			nil, nil, nil, nil, now, now,
		))
}

// mockUpdateEngagementStatus sets up a mock for UpdateEngagementStatus.
func mockUpdateEngagementStatus(mock sqlmock.Sqlmock, engID string, newStatus models.EngagementStatus) {
	now := time.Now().UTC()
	mock.ExpectQuery("UPDATE migration.engagement").
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			engID, "tenant-001", "LegacyPAS", "1.0",
			string(newStatus), nil, nil, nil, "standard", now, now,
		))
}

// mockCreateGateTransition sets up a mock for CreateGateTransition INSERT.
func mockCreateGateTransition(mock sqlmock.Sqlmock) {
	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO migration.gate_transition").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "engagement_id", "from_phase", "to_phase", "direction",
			"gate_metrics", "ai_recommendation", "overrides", "authorized_by", "authorized_at", "notes",
		}).AddRow(
			"gt-001", "eng-001", "COMPLETE", "CUTOVER_IN_PROGRESS", "ADVANCE",
			`{}`, "", `[]`, "tenant-001", now, "",
		))
}

// --- AC-3: TestCreateCutoverPlan ---

func TestCreateCutoverPlan(t *testing.T) {
	t.Run("happy_path", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mockGetEngagement(mock, "eng-001", models.StatusComplete)
		mockHasActiveCutoverPlan(mock, "eng-001", 0)
		mockCreateCutoverPlan(mock, "plan-001", "eng-001")

		body, _ := json.Marshal(models.CreateCutoverPlanRequest{
			Steps: []models.CreateCutoverStepRequest{
				{Label: "Stop legacy", Order: 1, Type: models.StepTypeManual},
			},
			RollbackSteps: []models.CreateCutoverStepRequest{
				{Label: "Restart legacy", Order: 1, Type: models.StepTypeManual},
			},
		})

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/cutover-plans", body)

		if w.Code != http.StatusCreated {
			t.Fatalf("status = %d, want 201; body: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].(map[string]any)
		if data["plan_id"] != "plan-001" {
			t.Errorf("plan_id = %v, want plan-001", data["plan_id"])
		}
		if data["status"] != "DRAFT" {
			t.Errorf("status = %v, want DRAFT", data["status"])
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("returns_409_when_engagement_not_COMPLETE", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mockGetEngagement(mock, "eng-001", models.StatusProfiling)

		body, _ := json.Marshal(models.CreateCutoverPlanRequest{
			Steps: []models.CreateCutoverStepRequest{
				{Label: "Stop legacy", Order: 1, Type: models.StepTypeManual},
			},
		})

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/cutover-plans", body)

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("returns_409_when_active_plan_exists", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mockGetEngagement(mock, "eng-001", models.StatusComplete)
		mockHasActiveCutoverPlan(mock, "eng-001", 1)

		body, _ := json.Marshal(models.CreateCutoverPlanRequest{
			Steps: []models.CreateCutoverStepRequest{
				{Label: "Stop legacy", Order: 1, Type: models.StepTypeManual},
			},
		})

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/cutover-plans", body)

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("returns_422_when_steps_empty", func(t *testing.T) {
		h, _ := newTestHandler(t)

		body, _ := json.Marshal(models.CreateCutoverPlanRequest{
			Steps: []models.CreateCutoverStepRequest{},
		})

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/cutover-plans", body)

		if w.Code != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("returns_422_when_step_missing_label", func(t *testing.T) {
		h, _ := newTestHandler(t)

		body, _ := json.Marshal(models.CreateCutoverPlanRequest{
			Steps: []models.CreateCutoverStepRequest{
				{Label: "", Order: 1, Type: models.StepTypeManual},
			},
		})

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/cutover-plans", body)

		if w.Code != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("returns_404_when_engagement_not_found", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mockGetEngagementNotFound(mock, "eng-missing")

		body, _ := json.Marshal(models.CreateCutoverPlanRequest{
			Steps: []models.CreateCutoverStepRequest{
				{Label: "Stop legacy", Order: 1, Type: models.StepTypeManual},
			},
		})

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-missing/cutover-plans", body)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404; body: %s", w.Code, w.Body.String())
		}
	})
}

// --- AC-4: TestCutoverExecution ---

func TestCutoverExecution(t *testing.T) {
	t.Run("approve_then_execute_happy_path", func(t *testing.T) {
		h, mock := newTestHandler(t)

		// Approve: plan is DRAFT
		mockGetCutoverPlan(mock, "plan-001", "eng-001", models.CutoverStatusDraft,
			`[{"step_id":"step-1","label":"Stop legacy","order":1,"type":"MANUAL","status":"PENDING"}]`)
		mockUpdateCutoverPlanStatus(mock, "plan-001", "eng-001", models.CutoverStatusApproved)

		body, _ := json.Marshal(map[string]string{})
		w := serve(h, "PATCH", "/api/v1/migration/engagements/eng-001/cutover-plans/plan-001/approve", body)

		if w.Code != http.StatusOK {
			t.Fatalf("approve: status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("execute_approved_plan", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mockGetCutoverPlan(mock, "plan-001", "eng-001", models.CutoverStatusApproved,
			`[{"step_id":"step-1","label":"Stop legacy","order":1,"type":"MANUAL","status":"PENDING"}]`)
		// Transition plan to EXECUTING
		mockUpdateCutoverPlanStatus(mock, "plan-001", "eng-001", models.CutoverStatusExecuting)
		// Transition engagement to CUTOVER_IN_PROGRESS
		mockUpdateEngagementStatus(mock, "eng-001", models.StatusCutoverInProgress)
		// Gate transition
		mockCreateGateTransition(mock)

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/cutover-plans/plan-001/execute", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("execute: status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("execute_DRAFT_returns_409", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mockGetCutoverPlan(mock, "plan-001", "eng-001", models.CutoverStatusDraft,
			`[{"step_id":"step-1","label":"Stop","order":1,"type":"MANUAL","status":"PENDING"}]`)

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/cutover-plans/plan-001/execute", nil)

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
		_ = mock
	})

	t.Run("execute_EXECUTING_returns_409", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mockGetCutoverPlan(mock, "plan-001", "eng-001", models.CutoverStatusExecuting,
			`[{"step_id":"step-1","label":"Stop","order":1,"type":"MANUAL","status":"PENDING"}]`)

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/cutover-plans/plan-001/execute", nil)

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
		_ = mock
	})

	t.Run("step_update_completes_plan_and_goes_GOLIVE", func(t *testing.T) {
		h, mock := newTestHandler(t)

		// GetCutoverPlan: plan has one step in PENDING
		mockGetCutoverPlan(mock, "plan-001", "eng-001", models.CutoverStatusExecuting,
			`[{"step_id":"step-1","label":"Stop legacy","order":1,"type":"MANUAL","status":"PENDING"}]`)

		// UpdateCutoverPlanSteps (Exec, not Query)
		mock.ExpectExec("UPDATE migration.cutover_plan SET steps").
			WillReturnResult(sqlmock.NewResult(0, 1))

		// Auto-complete: UpdateCutoverPlanStatus to COMPLETED
		mockUpdateCutoverPlanStatus(mock, "plan-001", "eng-001", models.CutoverStatusCompleted)
		// Transition engagement to GO_LIVE
		mockUpdateEngagementStatus(mock, "eng-001", models.StatusGoLive)
		// Gate transition for GO_LIVE
		mockCreateGateTransition(mock)

		body, _ := json.Marshal(models.UpdateCutoverStepRequest{
			Status: models.StepStatusCompleted,
		})
		w := serve(h, "PATCH", "/api/v1/migration/engagements/eng-001/cutover-plans/plan-001/steps/step-1", body)

		if w.Code != http.StatusOK {
			t.Fatalf("step update: status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].(map[string]any)
		if data["status"] != "COMPLETED" {
			t.Errorf("plan status = %v, want COMPLETED", data["status"])
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("step_update_not_executing_returns_409", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mockGetCutoverPlan(mock, "plan-001", "eng-001", models.CutoverStatusDraft,
			`[{"step_id":"step-1","label":"Stop","order":1,"type":"MANUAL","status":"PENDING"}]`)

		body, _ := json.Marshal(models.UpdateCutoverStepRequest{
			Status: models.StepStatusCompleted,
		})
		w := serve(h, "PATCH", "/api/v1/migration/engagements/eng-001/cutover-plans/plan-001/steps/step-1", body)

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
		_ = mock
	})
}

// --- AC-5: TestCutoverRollback ---

func TestCutoverRollback(t *testing.T) {
	t.Run("rollback_executing_plan", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mockGetCutoverPlan(mock, "plan-001", "eng-001", models.CutoverStatusExecuting,
			`[{"step_id":"step-1","label":"Stop legacy","order":1,"type":"MANUAL","status":"IN_PROGRESS"}]`)
		// Get engagement for from_phase
		mockGetEngagement(mock, "eng-001", models.StatusCutoverInProgress)
		// Rollback plan status
		mockUpdateCutoverPlanStatus(mock, "plan-001", "eng-001", models.CutoverStatusRolledBack)
		// Transition engagement back to COMPLETE
		mockUpdateEngagementStatus(mock, "eng-001", models.StatusComplete)
		// Gate transition
		mockCreateGateTransition(mock)

		body, _ := json.Marshal(models.RollbackRequest{
			RollbackReason: "Critical issue found during cutover",
		})
		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/cutover-plans/plan-001/rollback", body)

		if w.Code != http.StatusOK {
			t.Fatalf("rollback: status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].(map[string]any)
		if data["status"] != "ROLLED_BACK" {
			t.Errorf("status = %v, want ROLLED_BACK", data["status"])
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("rollback_completed_plan_from_GOLIVE", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mockGetCutoverPlan(mock, "plan-001", "eng-001", models.CutoverStatusCompleted,
			`[{"step_id":"step-1","label":"Stop legacy","order":1,"type":"MANUAL","status":"COMPLETED"}]`)
		// Get engagement: in GO_LIVE
		mockGetEngagement(mock, "eng-001", models.StatusGoLive)
		// Rollback plan
		mockUpdateCutoverPlanStatus(mock, "plan-001", "eng-001", models.CutoverStatusRolledBack)
		// Transition engagement back to COMPLETE
		mockUpdateEngagementStatus(mock, "eng-001", models.StatusComplete)
		// Gate transition
		mockCreateGateTransition(mock)

		body, _ := json.Marshal(models.RollbackRequest{
			RollbackReason: "Post-go-live rollback required",
		})
		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/cutover-plans/plan-001/rollback", body)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("rollback_DRAFT_returns_409", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mockGetCutoverPlan(mock, "plan-001", "eng-001", models.CutoverStatusDraft,
			`[{"step_id":"step-1","label":"Stop","order":1,"type":"MANUAL","status":"PENDING"}]`)

		body, _ := json.Marshal(models.RollbackRequest{
			RollbackReason: "Not valid for draft",
		})
		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/cutover-plans/plan-001/rollback", body)

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
		_ = mock
	})

	t.Run("rollback_without_reason_returns_422", func(t *testing.T) {
		h, _ := newTestHandler(t)

		body, _ := json.Marshal(models.RollbackRequest{
			RollbackReason: "",
		})
		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/cutover-plans/plan-001/rollback", body)

		if w.Code != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422; body: %s", w.Code, w.Body.String())
		}
	})
}

// --- AC-6: TestCutoverPlanEndpoints ---

func TestCutoverPlanEndpoints(t *testing.T) {
	t.Run("list_cutover_plans", func(t *testing.T) {
		h, mock := newTestHandler(t)

		now := time.Now().UTC()
		mock.ExpectQuery("SELECT .+ FROM migration.cutover_plan WHERE engagement_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).
				AddRow("plan-002", "eng-001", "COMPLETED",
					`[{"step_id":"step-1","label":"Done","order":1,"type":"MANUAL","status":"COMPLETED"}]`,
					`[]`, nil, nil, nil, &now, now, now).
				AddRow("plan-001", "eng-001", "ROLLED_BACK",
					`[{"step_id":"step-1","label":"Old","order":1,"type":"MANUAL","status":"PENDING"}]`,
					`[]`, nil, nil, nil, nil, now, now))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/cutover-plans", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		data, ok := resp["data"].([]any)
		if !ok {
			t.Fatalf("expected data to be array, got %T", resp["data"])
		}
		if len(data) != 2 {
			t.Errorf("expected 2 plans, got %d", len(data))
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("get_single_cutover_plan", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mockGetCutoverPlan(mock, "plan-001", "eng-001", models.CutoverStatusDraft,
			`[{"step_id":"step-1","label":"Stop","order":1,"type":"MANUAL","status":"PENDING"}]`)

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/cutover-plans/plan-001", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].(map[string]any)
		if data["plan_id"] != "plan-001" {
			t.Errorf("plan_id = %v, want plan-001", data["plan_id"])
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("get_nonexistent_plan_returns_404", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mockGetCutoverPlanNotFound(mock, "plan-missing")

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/cutover-plans/plan-missing", nil)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404; body: %s", w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})
}
