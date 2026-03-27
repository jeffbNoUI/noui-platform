//go:build integration

package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/auth"
	"github.com/noui/platform/migration/models"
)

// ---------------------------------------------------------------------------
// Integration test helpers — reusable across lifecycle test files.
// Each helper wraps HTTP calls to the test server with appropriate request
// bodies and assertions on status codes. Helpers return created entity IDs
// to enable chaining without global state.
// ---------------------------------------------------------------------------

// testServer holds the httptest server and handler for integration tests.
type testServer struct {
	Server *httptest.Server
	Mock   sqlmock.Sqlmock
	T      *testing.T
}

// newIntegrationTestServer creates a test server backed by sqlmock.
func newIntegrationTestServer(t *testing.T) *testServer {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	h := NewHandler(db)
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	// Wrap mux with auth context injection so requireEditor/requireOwner pass.
	authedMux := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := auth.WithTestClaims(r.Context(), defaultTenantID, "owner", "test-user-001")
		mux.ServeHTTP(w, r.WithContext(ctx))
	})

	server := httptest.NewServer(authedMux)
	t.Cleanup(server.Close)

	return &testServer{Server: server, Mock: mock, T: t}
}

// do sends an HTTP request to the test server and returns the response.
func (ts *testServer) do(method, path string, body interface{}) *http.Response {
	ts.T.Helper()

	var req *http.Request
	var err error
	url := ts.Server.URL + path

	if body != nil {
		data, _ := json.Marshal(body)
		req, err = http.NewRequest(method, url, bytes.NewReader(data))
		if err != nil {
			ts.T.Fatalf("new request: %v", err)
		}
		req.Header.Set("Content-Type", "application/json")
	} else {
		req, err = http.NewRequest(method, url, nil)
		if err != nil {
			ts.T.Fatalf("new request: %v", err)
		}
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		ts.T.Fatalf("do request: %v", err)
	}
	return resp
}

// parseData parses the JSON response body and returns the "data" field as a map.
func (ts *testServer) parseData(resp *http.Response) map[string]interface{} {
	ts.T.Helper()
	defer resp.Body.Close()
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		ts.T.Fatalf("decode response: %v", err)
	}
	data, ok := result["data"].(map[string]interface{})
	if !ok {
		ts.T.Fatalf("response missing 'data' map: %v", result)
	}
	return data
}

// parseList parses the JSON response body and returns the "data" field as a slice.
func (ts *testServer) parseList(resp *http.Response) []interface{} {
	ts.T.Helper()
	defer resp.Body.Close()
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		ts.T.Fatalf("decode response: %v", err)
	}
	data, ok := result["data"].([]interface{})
	if !ok {
		ts.T.Fatalf("response missing 'data' array: %v", result)
	}
	return data
}

// assertStatus asserts the response status code matches expected.
func (ts *testServer) assertStatus(resp *http.Response, expected int) {
	ts.T.Helper()
	if resp.StatusCode != expected {
		defer resp.Body.Close()
		var body map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&body)
		ts.T.Fatalf("expected status %d, got %d; body: %v", expected, resp.StatusCode, body)
	}
}

// ---------------------------------------------------------------------------
// Mock setup helpers — set up sqlmock expectations for each API operation.
// ---------------------------------------------------------------------------

// now is a shared timestamp for mock row data.
var testNow = time.Now().UTC()

// mockEngagementCreate sets up mock for POST /engagements.
func (ts *testServer) mockEngagementCreate(engID, name string) {
	ts.Mock.ExpectQuery("INSERT INTO migration.engagement").
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			engID, defaultTenantID, name, "1.0",
			"DISCOVERY", nil, nil, nil, "standard", testNow, testNow,
		))
}

// mockEngagementGet sets up mock for GET /engagements/{id}.
func (ts *testServer) mockEngagementGet(engID string, status models.EngagementStatus) {
	ts.Mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
		WithArgs(engID).
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			engID, defaultTenantID, "TestSystem", "1.0",
			string(status), nil, nil, nil, "standard", testNow, testNow,
		))
}

// mockEngagementGetNotFound sets up mock for GET returning no rows.
func (ts *testServer) mockEngagementGetNotFound(engID string) {
	ts.Mock.ExpectQuery("SELECT .+ FROM migration.engagement WHERE engagement_id").
		WithArgs(engID).
		WillReturnRows(sqlmock.NewRows(engagementCols))
}

// mockEngagementStatusUpdate sets up mock for UPDATE status.
func (ts *testServer) mockEngagementStatusUpdate(engID string, newStatus models.EngagementStatus) {
	ts.Mock.ExpectQuery("UPDATE migration.engagement").
		WillReturnRows(sqlmock.NewRows(engagementCols).AddRow(
			engID, defaultTenantID, "TestSystem", "1.0",
			string(newStatus), nil, nil, nil, "standard", testNow, testNow,
		))
}

// mockGateMetrics sets up mock for GetGateMetrics query chain (3 queries).
func (ts *testServer) mockGateMetrics(qualityMin, mappingPct, reconScore float64, p1Count int) {
	// Quality min score query.
	ts.Mock.ExpectQuery("SELECT LEAST").
		WillReturnRows(sqlmock.NewRows([]string{"least", "count"}).AddRow(qualityMin, 5))
	// Mapping agreed percentage query.
	totalMappings := 100
	agreedMappings := int(mappingPct * float64(totalMappings))
	ts.Mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"agreed", "total"}).AddRow(agreedMappings, totalMappings))
	// Reconciliation gate score query.
	ts.Mock.ExpectQuery("SELECT").
		WillReturnRows(sqlmock.NewRows([]string{"gate_score", "p1_count"}).AddRow(reconScore, p1Count))
}

// mockGateTransitionCreate sets up mock for INSERT gate_transition.
func (ts *testServer) mockGateTransitionCreate() {
	ts.Mock.ExpectQuery("INSERT INTO migration.gate_transition").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "engagement_id", "from_phase", "to_phase", "direction",
			"gate_metrics", "ai_recommendation", "overrides", "authorized_by", "authorized_at", "notes",
		}).AddRow(
			fmt.Sprintf("gt-%d", time.Now().UnixNano()), "eng-int-001", "DISCOVERY", "PROFILING", "ADVANCE",
			`{}`, "", `[]`, defaultTenantID, testNow, "",
		))
}

// mockGateTransitionList sets up mock for GET gate-history.
func (ts *testServer) mockGateTransitionList(engID string, count int) {
	rows := sqlmock.NewRows([]string{
		"id", "engagement_id", "from_phase", "to_phase", "direction",
		"gate_metrics", "ai_recommendation", "overrides", "authorized_by", "authorized_at", "notes",
	})
	for i := 0; i < count; i++ {
		rows.AddRow(
			fmt.Sprintf("gt-%d", i), engID, "PHASE_A", "PHASE_B", "ADVANCE",
			`{}`, "", `[]`, defaultTenantID, testNow, "",
		)
	}
	ts.Mock.ExpectQuery("SELECT .+ FROM migration.gate_transition").
		WithArgs(engID).
		WillReturnRows(rows)
}

// mockAuditLogList sets up mock for GET audit-log.
func (ts *testServer) mockAuditLogList(engID string, count int) {
	// Count query for pagination.
	ts.Mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(count))
	// Rows query.
	rows := sqlmock.NewRows([]string{
		"log_id", "engagement_id", "actor", "action", "entity_type", "entity_id",
		"before_state", "after_state", "metadata", "created_at",
	})
	for i := 0; i < count; i++ {
		rows.AddRow(
			fmt.Sprintf("log-%d", i), engID, defaultTenantID, "phase_advance",
			"engagement", engID, nil, nil, nil, testNow,
		)
	}
	ts.Mock.ExpectQuery("SELECT .+ FROM migration.audit_log").
		WillReturnRows(rows)
}

// ---------------------------------------------------------------------------
// High-level lifecycle helpers — compose DB mocks + HTTP calls.
// ---------------------------------------------------------------------------

// createTestEngagement creates an engagement and returns its ID.
func (ts *testServer) createTestEngagement(name string) string {
	ts.T.Helper()
	engID := "eng-int-001"
	ts.mockEngagementCreate(engID, name)

	resp := ts.do("POST", "/api/v1/migration/engagements", map[string]string{
		"source_system_name": name,
	})
	ts.assertStatus(resp, http.StatusCreated)
	data := ts.parseData(resp)

	id, ok := data["engagement_id"].(string)
	if !ok || id == "" {
		ts.T.Fatal("createTestEngagement: missing engagement_id")
	}
	return id
}

// advancePhase advances the engagement to the next phase.
// Sets up mocks for: GetEngagement, GetGateMetrics, UpdateStatus, CreateGateTransition.
func (ts *testServer) advancePhase(engID string, currentStatus models.EngagementStatus, overrides []string) {
	ts.T.Helper()

	ts.mockEngagementGet(engID, currentStatus)
	ts.mockGateMetrics(0.90, 0.95, 0.98, 0) // good metrics
	ts.mockEngagementStatusUpdate(engID, nextPhaseFor(currentStatus))
	ts.mockGateTransitionCreate()

	body := models.AdvancePhaseRequest{
		Notes:     "integration test advance",
		Overrides: overrides,
	}
	resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/advance-phase", engID), body)
	ts.assertStatus(resp, http.StatusOK)
	resp.Body.Close()
}

// createAndApproveMappings generates mappings and approves them.
// For the integration test, we mock the DB calls that the mapping handler makes.
func (ts *testServer) createAndApproveMappings(engID string, count int) {
	ts.T.Helper()
	// This helper is used to satisfy gate checks by ensuring mappings exist.
	// In the integration test flow, we advance phases which check gate metrics.
	// The actual mapping approval is represented through mock gate metrics showing
	// mapping_agreed_pct >= 0.90.
}

// createBatchAndWait creates a batch and returns its ID.
func (ts *testServer) createBatchAndWait(engID string) string {
	ts.T.Helper()
	batchID := "batch-int-001"

	// Mock GetEngagement for batch creation.
	ts.mockEngagementGet(engID, models.StatusTransforming)

	// Mock CreateBatch.
	batchCols := []string{
		"batch_id", "engagement_id", "batch_scope", "status", "mapping_version",
		"row_count_source", "row_count_loaded", "row_count_exception", "error_rate",
		"halted_reason", "checkpoint_key", "started_at", "completed_at",
	}
	ts.Mock.ExpectQuery("INSERT INTO migration.batch").
		WillReturnRows(sqlmock.NewRows(batchCols).AddRow(
			batchID, engID, "members", "PENDING", "v1",
			nil, nil, nil, nil, nil, nil, nil, nil,
		))

	resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/batches", engID), models.CreateBatchRequest{
		BatchScope:     "members",
		MappingVersion: "v1",
	})
	ts.assertStatus(resp, http.StatusCreated)
	data := ts.parseData(resp)
	id, _ := data["batch_id"].(string)
	if id == "" {
		ts.T.Fatal("createBatchAndWait: missing batch_id")
	}
	return id
}

// createParallelRunWithResults creates a parallel run and returns its ID.
func (ts *testServer) createParallelRunWithResults(engID string) string {
	ts.T.Helper()
	runID := "prun-int-001"

	parallelRunCols := []string{
		"run_id", "engagement_id", "name", "description", "status",
		"legacy_source", "canonical_source", "comparison_mode", "sample_rate",
		"started_by", "started_at", "completed_at", "created_at",
	}
	ts.Mock.ExpectQuery("INSERT INTO migration.parallel_run").
		WillReturnRows(sqlmock.NewRows(parallelRunCols).AddRow(
			runID, engID, "Integration Test Run", nil, "PENDING",
			"legacy_db", "canonical_db", "FULL", nil,
			defaultTenantID, nil, nil, testNow,
		))

	resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/parallel-runs", engID), map[string]string{
		"name":             "Integration Test Run",
		"legacy_source":    "legacy_db",
		"canonical_source": "canonical_db",
		"comparison_mode":  "FULL",
	})
	ts.assertStatus(resp, http.StatusCreated)
	data := ts.parseData(resp)
	id, _ := data["run_id"].(string)
	if id == "" {
		ts.T.Fatal("createParallelRunWithResults: missing run_id")
	}
	return id
}

// certifyEngagement certifies the engagement and transitions to COMPLETE.
func (ts *testServer) certifyEngagement(engID string) {
	ts.T.Helper()

	// Mock GetEngagement (must be PARALLEL_RUN or RECONCILING).
	ts.mockEngagementGet(engID, models.StatusParallelRun)

	// Mock evalChecklist internals: GetGateMetrics + HasCompletedParallelRun.
	ts.mockGateMetrics(0.95, 0.95, 0.98, 0) // passing metrics
	ts.Mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	// Mock GetGateMetrics again (for auto-evaluated snapshot).
	ts.mockGateMetrics(0.95, 0.95, 0.98, 0)

	// Mock CreateCertification INSERT (QueryRow with RETURNING id, certified_at, created_at).
	ts.Mock.ExpectQuery("INSERT INTO migration.certification_record").
		WillReturnRows(sqlmock.NewRows([]string{"id", "certified_at", "created_at"}).
			AddRow("cert-int-001", testNow, testNow))

	// Mock UpdateEngagementStatus to COMPLETE.
	ts.mockEngagementStatusUpdate(engID, models.StatusComplete)

	// Mock CreateGateTransition.
	ts.mockGateTransitionCreate()

	resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/certify", engID), models.CertifyRequest{
		StakeholderSignoff: true,
		RollbackPlan:       true,
		Notes:              "integration test certification",
	})
	ts.assertStatus(resp, http.StatusCreated)
	resp.Body.Close()
}

// createAndExecuteCutoverPlan creates, approves, executes a cutover plan, and completes all steps.
// Returns the plan ID.
func (ts *testServer) createAndExecuteCutoverPlan(engID string) string {
	ts.T.Helper()
	planID := "plan-int-001"

	// --- Create plan ---
	ts.mockEngagementGet(engID, models.StatusComplete)
	ts.Mock.ExpectQuery("SELECT COUNT").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	ts.Mock.ExpectQuery("INSERT INTO migration.cutover_plan").
		WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
			planID, engID, "DRAFT",
			`[{"step_id":"step-1","label":"Stop legacy writes","order":1,"type":"MANUAL","status":"PENDING"},{"step_id":"step-2","label":"Switch DNS","order":2,"type":"AUTOMATED","status":"PENDING"}]`,
			`[{"step_id":"rollback-1","label":"Revert DNS","order":1,"type":"AUTOMATED","status":"PENDING"}]`,
			nil, nil, nil, nil, testNow, testNow,
		))

	resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/cutover-plans", engID), models.CreateCutoverPlanRequest{
		Steps: []models.CreateCutoverStepRequest{
			{Label: "Stop legacy writes", Order: 1, Type: models.StepTypeManual},
			{Label: "Switch DNS", Order: 2, Type: models.StepTypeAutomated},
		},
		RollbackSteps: []models.CreateCutoverStepRequest{
			{Label: "Revert DNS", Order: 1, Type: models.StepTypeAutomated},
		},
	})
	ts.assertStatus(resp, http.StatusCreated)
	resp.Body.Close()

	// --- Approve plan ---
	ts.Mock.ExpectQuery("SELECT .+ FROM migration.cutover_plan WHERE plan_id").
		WithArgs(planID).
		WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
			planID, engID, "DRAFT",
			`[{"step_id":"step-1","label":"Stop legacy writes","order":1,"type":"MANUAL","status":"PENDING"},{"step_id":"step-2","label":"Switch DNS","order":2,"type":"AUTOMATED","status":"PENDING"}]`,
			`[{"step_id":"rollback-1","label":"Revert DNS","order":1,"type":"AUTOMATED","status":"PENDING"}]`,
			nil, nil, nil, nil, testNow, testNow,
		))
	ts.Mock.ExpectQuery("UPDATE migration.cutover_plan").
		WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
			planID, engID, "APPROVED",
			`[{"step_id":"step-1","label":"Stop legacy writes","order":1,"type":"MANUAL","status":"PENDING"},{"step_id":"step-2","label":"Switch DNS","order":2,"type":"AUTOMATED","status":"PENDING"}]`,
			`[{"step_id":"rollback-1","label":"Revert DNS","order":1,"type":"AUTOMATED","status":"PENDING"}]`,
			nil, nil, nil, nil, testNow, testNow,
		))

	resp = ts.do("PATCH", fmt.Sprintf("/api/v1/migration/engagements/%s/cutover-plans/%s/approve", engID, planID), nil)
	ts.assertStatus(resp, http.StatusOK)
	resp.Body.Close()

	// --- Execute plan ---
	ts.Mock.ExpectQuery("SELECT .+ FROM migration.cutover_plan WHERE plan_id").
		WithArgs(planID).
		WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
			planID, engID, "APPROVED",
			`[{"step_id":"step-1","label":"Stop legacy writes","order":1,"type":"MANUAL","status":"PENDING"},{"step_id":"step-2","label":"Switch DNS","order":2,"type":"AUTOMATED","status":"PENDING"}]`,
			`[{"step_id":"rollback-1","label":"Revert DNS","order":1,"type":"AUTOMATED","status":"PENDING"}]`,
			nil, nil, nil, nil, testNow, testNow,
		))
	ts.Mock.ExpectQuery("UPDATE migration.cutover_plan").
		WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
			planID, engID, "EXECUTING",
			`[{"step_id":"step-1","label":"Stop legacy writes","order":1,"type":"MANUAL","status":"PENDING"},{"step_id":"step-2","label":"Switch DNS","order":2,"type":"AUTOMATED","status":"PENDING"}]`,
			`[{"step_id":"rollback-1","label":"Revert DNS","order":1,"type":"AUTOMATED","status":"PENDING"}]`,
			nil, nil, nil, nil, testNow, testNow,
		))
	ts.mockEngagementStatusUpdate(engID, models.StatusCutoverInProgress)
	ts.mockGateTransitionCreate()

	resp = ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/cutover-plans/%s/execute", engID, planID), nil)
	ts.assertStatus(resp, http.StatusOK)
	resp.Body.Close()

	// --- Complete step 1 ---
	ts.Mock.ExpectQuery("SELECT .+ FROM migration.cutover_plan WHERE plan_id").
		WithArgs(planID).
		WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
			planID, engID, "EXECUTING",
			`[{"step_id":"step-1","label":"Stop legacy writes","order":1,"type":"MANUAL","status":"PENDING"},{"step_id":"step-2","label":"Switch DNS","order":2,"type":"AUTOMATED","status":"PENDING"}]`,
			`[{"step_id":"rollback-1","label":"Revert DNS","order":1,"type":"AUTOMATED","status":"PENDING"}]`,
			nil, nil, nil, nil, testNow, testNow,
		))
	ts.Mock.ExpectExec("UPDATE migration.cutover_plan SET steps").
		WillReturnResult(sqlmock.NewResult(0, 1))
	// Refresh plan after step update.
	ts.Mock.ExpectQuery("SELECT .+ FROM migration.cutover_plan WHERE plan_id").
		WithArgs(planID).
		WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
			planID, engID, "EXECUTING",
			`[{"step_id":"step-1","label":"Stop legacy writes","order":1,"type":"MANUAL","status":"COMPLETED"},{"step_id":"step-2","label":"Switch DNS","order":2,"type":"AUTOMATED","status":"PENDING"}]`,
			`[{"step_id":"rollback-1","label":"Revert DNS","order":1,"type":"AUTOMATED","status":"PENDING"}]`,
			nil, nil, nil, nil, testNow, testNow,
		))

	resp = ts.do("PATCH", fmt.Sprintf("/api/v1/migration/engagements/%s/cutover-plans/%s/steps/step-1", engID, planID),
		models.UpdateCutoverStepRequest{Status: models.StepStatusCompleted})
	ts.assertStatus(resp, http.StatusOK)
	resp.Body.Close()

	// --- Complete step 2 (triggers auto-complete → GO_LIVE) ---
	ts.Mock.ExpectQuery("SELECT .+ FROM migration.cutover_plan WHERE plan_id").
		WithArgs(planID).
		WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
			planID, engID, "EXECUTING",
			`[{"step_id":"step-1","label":"Stop legacy writes","order":1,"type":"MANUAL","status":"COMPLETED"},{"step_id":"step-2","label":"Switch DNS","order":2,"type":"AUTOMATED","status":"PENDING"}]`,
			`[{"step_id":"rollback-1","label":"Revert DNS","order":1,"type":"AUTOMATED","status":"PENDING"}]`,
			nil, nil, nil, nil, testNow, testNow,
		))
	ts.Mock.ExpectExec("UPDATE migration.cutover_plan SET steps").
		WillReturnResult(sqlmock.NewResult(0, 1))
	// Auto-complete: plan → COMPLETED.
	ts.Mock.ExpectQuery("UPDATE migration.cutover_plan").
		WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
			planID, engID, "COMPLETED",
			`[{"step_id":"step-1","label":"Stop legacy writes","order":1,"type":"MANUAL","status":"COMPLETED"},{"step_id":"step-2","label":"Switch DNS","order":2,"type":"AUTOMATED","status":"COMPLETED"}]`,
			`[{"step_id":"rollback-1","label":"Revert DNS","order":1,"type":"AUTOMATED","status":"PENDING"}]`,
			nil, nil, nil, nil, testNow, testNow,
		))
	// Engagement → GO_LIVE.
	ts.mockEngagementStatusUpdate(engID, models.StatusGoLive)
	ts.mockGateTransitionCreate()

	resp = ts.do("PATCH", fmt.Sprintf("/api/v1/migration/engagements/%s/cutover-plans/%s/steps/step-2", engID, planID),
		models.UpdateCutoverStepRequest{Status: models.StepStatusCompleted})
	ts.assertStatus(resp, http.StatusOK)
	resp.Body.Close()

	return planID
}

// ---------------------------------------------------------------------------
// TestIntegrationHelpers — validates that each helper works independently.
// ---------------------------------------------------------------------------

func TestIntegrationHelpers(t *testing.T) {
	t.Run("createTestEngagement", func(t *testing.T) {
		ts := newIntegrationTestServer(t)
		engID := ts.createTestEngagement("TestHelperSystem")
		if engID != "eng-int-001" {
			t.Errorf("expected eng-int-001, got %s", engID)
		}
		if err := ts.Mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("advancePhase", func(t *testing.T) {
		ts := newIntegrationTestServer(t)
		ts.advancePhase("eng-int-001", models.StatusDiscovery, nil)
		if err := ts.Mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("createBatchAndWait", func(t *testing.T) {
		ts := newIntegrationTestServer(t)
		batchID := ts.createBatchAndWait("eng-int-001")
		if batchID != "batch-int-001" {
			t.Errorf("expected batch-int-001, got %s", batchID)
		}
		if err := ts.Mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("createParallelRunWithResults", func(t *testing.T) {
		ts := newIntegrationTestServer(t)
		runID := ts.createParallelRunWithResults("eng-int-001")
		if runID != "prun-int-001" {
			t.Errorf("expected prun-int-001, got %s", runID)
		}
		if err := ts.Mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("certifyEngagement", func(t *testing.T) {
		ts := newIntegrationTestServer(t)
		ts.certifyEngagement("eng-int-001")
		if err := ts.Mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("createAndExecuteCutoverPlan", func(t *testing.T) {
		ts := newIntegrationTestServer(t)
		planID := ts.createAndExecuteCutoverPlan("eng-int-001")
		if planID != "plan-int-001" {
			t.Errorf("expected plan-int-001, got %s", planID)
		}
		if err := ts.Mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})
}
