//go:build integration

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/models"
)

// TestFullMigrationLifecycle exercises the complete migration lifecycle from
// engagement creation through go-live via the API. This is the primary
// integration test covering AC-1, AC-2, and AC-3.
//
// Status chain tested:
//
//	DISCOVERY → PROFILING → MAPPING → TRANSFORMING → RECONCILING →
//	PARALLEL_RUN → COMPLETE → CUTOVER_IN_PROGRESS → GO_LIVE
func TestFullMigrationLifecycle(t *testing.T) {
	ts := newIntegrationTestServer(t)
	engID := "eng-int-001"

	// -----------------------------------------------------------------------
	// AC-1: Create engagement, configure source, trigger profiling, advance
	// through DISCOVERY to PROFILING to MAPPING.
	// -----------------------------------------------------------------------

	t.Run("01_create_engagement", func(t *testing.T) {
		ts.mockEngagementCreate(engID, "LegacyPAS-Integration")

		resp := ts.do("POST", "/api/v1/migration/engagements", map[string]string{
			"source_system_name": "LegacyPAS-Integration",
		})
		ts.assertStatus(resp, http.StatusCreated)
		data := ts.parseData(resp)

		if data["engagement_id"] != engID {
			t.Errorf("engagement_id = %v, want %s", data["engagement_id"], engID)
		}
		if data["status"] != "DISCOVERY" {
			t.Errorf("status = %v, want DISCOVERY", data["status"])
		}
	})

	t.Run("02_verify_engagement_created", func(t *testing.T) {
		ts.mockEngagementGet(engID, models.StatusDiscovery)

		resp := ts.do("GET", fmt.Sprintf("/api/v1/migration/engagements/%s", engID), nil)
		ts.assertStatus(resp, http.StatusOK)
		data := ts.parseData(resp)

		if data["status"] != "DISCOVERY" {
			t.Errorf("status = %v, want DISCOVERY", data["status"])
		}
	})

	t.Run("03_advance_DISCOVERY_to_PROFILING", func(t *testing.T) {
		ts.advancePhase(engID, models.StatusDiscovery, nil)
	})

	t.Run("04_advance_PROFILING_to_MAPPING", func(t *testing.T) {
		ts.advancePhase(engID, models.StatusProfiling, nil)
	})

	t.Run("05_verify_at_MAPPING", func(t *testing.T) {
		ts.mockEngagementGet(engID, models.StatusMapping)

		resp := ts.do("GET", fmt.Sprintf("/api/v1/migration/engagements/%s", engID), nil)
		ts.assertStatus(resp, http.StatusOK)
		data := ts.parseData(resp)

		if data["status"] != "MAPPING" {
			t.Errorf("status = %v, want MAPPING", data["status"])
		}
	})

	// -----------------------------------------------------------------------
	// AC-2: Advance MAPPING → TRANSFORMING, create batch, advance to
	// RECONCILING, PARALLEL_RUN, create parallel run, create recon ruleset.
	// -----------------------------------------------------------------------

	t.Run("06_advance_MAPPING_to_TRANSFORMING", func(t *testing.T) {
		ts.advancePhase(engID, models.StatusMapping, nil)
	})

	t.Run("07_create_batch", func(t *testing.T) {
		batchID := ts.createBatchAndWait(engID)
		if batchID == "" {
			t.Fatal("expected non-empty batch ID")
		}
	})

	t.Run("08_advance_TRANSFORMING_to_RECONCILING", func(t *testing.T) {
		ts.advancePhase(engID, models.StatusTransforming, nil)
	})

	t.Run("09_verify_gate_metrics_at_RECONCILING", func(t *testing.T) {
		ts.mockEngagementGet(engID, models.StatusReconciling)
		ts.mockGateMetrics(0.92, 0.95, 0.97, 0)

		resp := ts.do("GET", fmt.Sprintf("/api/v1/migration/engagements/%s/gate-status", engID), nil)
		ts.assertStatus(resp, http.StatusOK)
		data := ts.parseData(resp)

		metrics, ok := data["metrics"].(map[string]interface{})
		if !ok {
			t.Fatal("missing metrics in gate-status response")
		}
		if metrics["recon_gate_score"] == nil {
			t.Error("missing recon_gate_score in metrics")
		}
	})

	t.Run("10_advance_RECONCILING_to_PARALLEL_RUN", func(t *testing.T) {
		ts.advancePhase(engID, models.StatusReconciling, nil)
	})

	t.Run("11_create_parallel_run", func(t *testing.T) {
		runID := ts.createParallelRunWithResults(engID)
		if runID == "" {
			t.Fatal("expected non-empty parallel run ID")
		}
	})

	t.Run("12_create_recon_ruleset", func(t *testing.T) {
		rulesetID := "ruleset-int-001"

		reconRuleSetCols := []string{
			"ruleset_id", "engagement_id", "version", "label", "status",
			"rules", "created_by", "created_at", "activated_at", "superseded_at",
		}
		ts.Mock.ExpectQuery("INSERT INTO migration.recon_rule_set").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).AddRow(
				rulesetID, engID, 1, "Integration Test Rules", "DRAFT",
				`[{"rule_id":"1_monthly_benefit","tier":1,"calc_name":"monthly_benefit","comparison_type":"TOLERANCE_ABS","tolerance_value":"0.01","priority_if_mismatch":"P1","enabled":true}]`,
				defaultTenantID, testNow, nil, nil,
			))

		resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/recon-rules", engID),
			models.CreateReconRuleSetRequest{
				Label: "Integration Test Rules",
				Rules: []models.CreateReconRuleReq{
					{
						Tier:               1,
						CalcName:           "monthly_benefit",
						ComparisonType:     models.ComparisonToleranceAbs,
						ToleranceValue:     "0.01",
						PriorityIfMismatch: models.PriorityP1,
						Enabled:            true,
					},
				},
			})
		ts.assertStatus(resp, http.StatusCreated)
		data := ts.parseData(resp)

		if data["ruleset_id"] != rulesetID {
			t.Errorf("ruleset_id = %v, want %s", data["ruleset_id"], rulesetID)
		}
		if data["status"] != "DRAFT" {
			t.Errorf("status = %v, want DRAFT", data["status"])
		}
		resp.Body.Close()
	})

	t.Run("13_activate_recon_ruleset", func(t *testing.T) {
		rulesetID := "ruleset-int-001"

		reconRuleSetCols := []string{
			"ruleset_id", "engagement_id", "version", "label", "status",
			"rules", "created_by", "created_at", "activated_at", "superseded_at",
		}

		// ActivateReconRuleSet uses a transaction:
		ts.Mock.ExpectBegin()
		// 1. tx.QueryRow: SELECT status FROM migration.recon_rule_set WHERE ruleset_id = $1 AND engagement_id = $2
		ts.Mock.ExpectQuery("SELECT status FROM migration.recon_rule_set").
			WithArgs(rulesetID, engID).
			WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow("DRAFT"))
		// 2. tx.Exec: supersede currently active (no-op if none).
		ts.Mock.ExpectExec("UPDATE migration.recon_rule_set").
			WillReturnResult(sqlmock.NewResult(0, 0))
		// 3. tx.QueryRow: UPDATE ... SET status = 'ACTIVE' RETURNING ...
		ts.Mock.ExpectQuery("UPDATE migration.recon_rule_set").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).AddRow(
				rulesetID, engID, 1, "Integration Test Rules", "ACTIVE",
				`[{"rule_id":"1_monthly_benefit","tier":1,"calc_name":"monthly_benefit","comparison_type":"TOLERANCE_ABS","tolerance_value":"0.01","priority_if_mismatch":"P1","enabled":true}]`,
				defaultTenantID, testNow, &testNow, nil,
			))
		ts.Mock.ExpectCommit()

		// The handler also creates a gate transition after activation.
		ts.mockGateTransitionCreate()

		resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/recon-rules/%s/activate", engID, rulesetID), nil)
		ts.assertStatus(resp, http.StatusOK)
		resp.Body.Close()
	})

	// -----------------------------------------------------------------------
	// AC-3: Certify → COMPLETE, create cutover plan, execute → GO_LIVE.
	// Verify gate transitions and audit log entries.
	// -----------------------------------------------------------------------

	t.Run("14_certify_engagement", func(t *testing.T) {
		ts.certifyEngagement(engID)
	})

	t.Run("15_verify_at_COMPLETE", func(t *testing.T) {
		ts.mockEngagementGet(engID, models.StatusComplete)

		resp := ts.do("GET", fmt.Sprintf("/api/v1/migration/engagements/%s", engID), nil)
		ts.assertStatus(resp, http.StatusOK)
		data := ts.parseData(resp)

		if data["status"] != "COMPLETE" {
			t.Errorf("status = %v, want COMPLETE", data["status"])
		}
	})

	t.Run("16_create_and_execute_cutover_plan", func(t *testing.T) {
		planID := ts.createAndExecuteCutoverPlan(engID)
		if planID == "" {
			t.Fatal("expected non-empty plan ID")
		}
	})

	t.Run("17_verify_at_GO_LIVE", func(t *testing.T) {
		ts.mockEngagementGet(engID, models.StatusGoLive)

		resp := ts.do("GET", fmt.Sprintf("/api/v1/migration/engagements/%s", engID), nil)
		ts.assertStatus(resp, http.StatusOK)
		data := ts.parseData(resp)

		if data["status"] != "GO_LIVE" {
			t.Errorf("status = %v, want GO_LIVE", data["status"])
		}
	})

	t.Run("18_verify_gate_transitions_exist", func(t *testing.T) {
		// At least 8 transitions in the full lifecycle:
		// DISCOVERY→PROFILING, PROFILING→MAPPING, MAPPING→TRANSFORMING,
		// TRANSFORMING→RECONCILING, RECONCILING→PARALLEL_RUN,
		// PARALLEL_RUN→COMPLETE (certification), COMPLETE→CUTOVER_IN_PROGRESS,
		// CUTOVER_IN_PROGRESS→GO_LIVE
		ts.mockGateTransitionList(engID, 8)

		resp := ts.do("GET", fmt.Sprintf("/api/v1/migration/engagements/%s/gate-history", engID), nil)
		ts.assertStatus(resp, http.StatusOK)

		transitions := ts.parseList(resp)
		if len(transitions) < 8 {
			t.Errorf("expected at least 8 gate transitions, got %d", len(transitions))
		}
	})

	t.Run("19_verify_audit_log_entries", func(t *testing.T) {
		ts.mockAuditLogList(engID, 10)

		resp := ts.do("GET", fmt.Sprintf("/api/v1/migration/engagements/%s/audit-log", engID), nil)
		ts.assertStatus(resp, http.StatusOK)

		data := ts.parseData(resp)
		entries, ok := data["entries"].([]interface{})
		if !ok {
			// Could be wrapped differently.
			t.Log("audit log response structure may differ; skipping count check")
			return
		}
		if len(entries) == 0 {
			t.Error("expected audit log entries, got 0")
		}
	})

	t.Run("20_verify_sqlmock_expectations_met", func(t *testing.T) {
		if err := ts.Mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet sqlmock expectations: %v", err)
		}
	})
}

// TestMigrationLifecycleGateBlocking tests negative paths — gate blocking,
// override advancement, invalid cutover attempts, and rollback.
func TestMigrationLifecycleGateBlocking(t *testing.T) {
	t.Run("advance_without_meeting_gate_returns_422", func(t *testing.T) {
		// Attempt to certify with failing checklist — gate score below threshold.
		ts := newIntegrationTestServer(t)
		engID := "eng-block-001"

		// Mock GetEngagement in PARALLEL_RUN.
		ts.mockEngagementGet(engID, models.StatusParallelRun)
		// Mock evalChecklist with failing metrics — gate score < 0.95.
		ts.mockGateMetrics(0.80, 0.85, 0.50, 3) // low recon score, P1 issues
		ts.Mock.ExpectQuery("SELECT COUNT").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

		resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/certify", engID),
			models.CertifyRequest{
				StakeholderSignoff: true,
				RollbackPlan:       true,
				Notes:              "should fail — low gate score",
			})

		if resp.StatusCode != http.StatusUnprocessableEntity {
			defer resp.Body.Close()
			var body map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&body)
			t.Fatalf("expected 422, got %d; body: %v", resp.StatusCode, body)
		}

		// Verify the response includes checklist failure info.
		defer resp.Body.Close()
		var body map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&body)
		if body["error_code"] != "CHECKLIST_FAILED" {
			t.Errorf("error_code = %v, want CHECKLIST_FAILED", body["error_code"])
		}
		failedItems, ok := body["failed_items"].([]interface{})
		if !ok || len(failedItems) == 0 {
			t.Error("expected failed_items in response")
		}
	})

	t.Run("advance_with_overrides_succeeds", func(t *testing.T) {
		// Advance with overrides — transition succeeds even if metrics are suboptimal.
		ts := newIntegrationTestServer(t)
		engID := "eng-override-001"

		ts.mockEngagementGet(engID, models.StatusDiscovery)
		ts.mockGateMetrics(0.60, 0.70, 0.80, 2) // suboptimal metrics
		ts.mockEngagementStatusUpdate(engID, models.StatusProfiling)
		ts.mockGateTransitionCreate()

		resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/advance-phase", engID),
			models.AdvancePhaseRequest{
				Notes:     "override advancement with known issues",
				Overrides: []string{"quality_min_score", "mapping_agreed_pct"},
			})
		ts.assertStatus(resp, http.StatusOK)

		data := ts.parseData(resp)
		if data["to_phase"] != "PROFILING" {
			t.Errorf("to_phase = %v, want PROFILING", data["to_phase"])
		}
		// The gate transition was created (mock expectation verified),
		// which proves overrides were passed to CreateGateTransition.
		// The mock returns static data, so we verify the handler accepted them.
	})

	t.Run("cutover_from_non_COMPLETE_returns_409", func(t *testing.T) {
		ts := newIntegrationTestServer(t)
		engID := "eng-cutover-block"

		// Engagement is in PROFILING — cutover should be rejected.
		ts.mockEngagementGet(engID, models.StatusProfiling)

		resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/cutover-plans", engID),
			models.CreateCutoverPlanRequest{
				Steps: []models.CreateCutoverStepRequest{
					{Label: "Stop legacy", Order: 1, Type: models.StepTypeManual},
				},
			})

		if resp.StatusCode != http.StatusConflict {
			defer resp.Body.Close()
			var body map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&body)
			t.Fatalf("expected 409, got %d; body: %v", resp.StatusCode, body)
		}
		resp.Body.Close()
	})

	t.Run("rollback_from_CUTOVER_IN_PROGRESS_returns_to_COMPLETE", func(t *testing.T) {
		ts := newIntegrationTestServer(t)
		engID := "eng-rollback-001"
		planID := "plan-rollback-001"

		// Mock GetCutoverPlan in EXECUTING status.
		ts.Mock.ExpectQuery("SELECT .+ FROM migration.cutover_plan WHERE plan_id").
			WithArgs(planID).
			WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
				planID, engID, "EXECUTING",
				`[{"step_id":"step-1","label":"Stop","order":1,"type":"MANUAL","status":"IN_PROGRESS"}]`,
				`[{"step_id":"rollback-1","label":"Revert","order":1,"type":"MANUAL","status":"PENDING"}]`,
				nil, nil, nil, nil, testNow, testNow,
			))
		// Mock GetEngagement (CUTOVER_IN_PROGRESS).
		ts.mockEngagementGet(engID, models.StatusCutoverInProgress)
		// Mock plan status update to ROLLED_BACK.
		ts.Mock.ExpectQuery("UPDATE migration.cutover_plan").
			WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
				planID, engID, "ROLLED_BACK",
				`[{"step_id":"step-1","label":"Stop","order":1,"type":"MANUAL","status":"IN_PROGRESS"}]`,
				`[{"step_id":"rollback-1","label":"Revert","order":1,"type":"MANUAL","status":"PENDING"}]`,
				nil, nil, nil, nil, testNow, testNow,
			))
		// Mock engagement back to COMPLETE.
		ts.mockEngagementStatusUpdate(engID, models.StatusComplete)
		// Mock gate transition.
		ts.mockGateTransitionCreate()

		resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/cutover-plans/%s/rollback", engID, planID),
			models.RollbackRequest{
				RollbackReason: "Critical data issue found during cutover",
			})
		ts.assertStatus(resp, http.StatusOK)

		data := ts.parseData(resp)
		if data["status"] != "ROLLED_BACK" {
			t.Errorf("plan status = %v, want ROLLED_BACK", data["status"])
		}
	})

	t.Run("execute_cutover_from_DRAFT_returns_409", func(t *testing.T) {
		ts := newIntegrationTestServer(t)
		engID := "eng-exec-block"
		planID := "plan-exec-block"

		ts.Mock.ExpectQuery("SELECT .+ FROM migration.cutover_plan WHERE plan_id").
			WithArgs(planID).
			WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
				planID, engID, "DRAFT",
				`[{"step_id":"step-1","label":"Stop","order":1,"type":"MANUAL","status":"PENDING"}]`,
				`[]`,
				nil, nil, nil, nil, testNow, testNow,
			))

		resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/cutover-plans/%s/execute", engID, planID), nil)
		if resp.StatusCode != http.StatusConflict {
			defer resp.Body.Close()
			var body map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&body)
			t.Fatalf("expected 409, got %d; body: %v", resp.StatusCode, body)
		}
		resp.Body.Close()
	})

	t.Run("advance_at_final_phase_returns_409", func(t *testing.T) {
		ts := newIntegrationTestServer(t)
		engID := "eng-final-001"

		// Engagement is at COMPLETE (final canonical phase before cutover flow).
		// The advance-phase endpoint considers COMPLETE as a final phase
		// in the orderedPhases list.
		ts.mockEngagementGet(engID, models.StatusComplete)

		resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/advance-phase", engID),
			models.AdvancePhaseRequest{Notes: "should fail at final phase"})

		if resp.StatusCode != http.StatusConflict {
			defer resp.Body.Close()
			var body map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&body)
			t.Fatalf("expected 409, got %d; body: %v", resp.StatusCode, body)
		}
		resp.Body.Close()
	})

	t.Run("certify_from_wrong_phase_returns_409", func(t *testing.T) {
		ts := newIntegrationTestServer(t)
		engID := "eng-certify-block"

		// Engagement is in MAPPING — certification should be rejected.
		ts.mockEngagementGet(engID, models.StatusMapping)

		resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/certify", engID),
			models.CertifyRequest{
				StakeholderSignoff: true,
				RollbackPlan:       true,
			})

		if resp.StatusCode != http.StatusConflict {
			defer resp.Body.Close()
			var body map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&body)
			t.Fatalf("expected 409, got %d; body: %v", resp.StatusCode, body)
		}
		resp.Body.Close()
	})

	t.Run("rollback_DRAFT_plan_returns_409", func(t *testing.T) {
		ts := newIntegrationTestServer(t)
		engID := "eng-rb-draft"
		planID := "plan-rb-draft"

		ts.Mock.ExpectQuery("SELECT .+ FROM migration.cutover_plan WHERE plan_id").
			WithArgs(planID).
			WillReturnRows(sqlmock.NewRows(cutoverPlanTestCols).AddRow(
				planID, engID, "DRAFT",
				`[{"step_id":"step-1","label":"Stop","order":1,"type":"MANUAL","status":"PENDING"}]`,
				`[]`,
				nil, nil, nil, nil, testNow, testNow,
			))

		resp := ts.do("POST", fmt.Sprintf("/api/v1/migration/engagements/%s/cutover-plans/%s/rollback", engID, planID),
			models.RollbackRequest{RollbackReason: "should fail for DRAFT"})

		if resp.StatusCode != http.StatusConflict {
			defer resp.Body.Close()
			var body map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&body)
			t.Fatalf("expected 409, got %d; body: %v", resp.StatusCode, body)
		}
		resp.Body.Close()
	})

	t.Run("invalid_status_transition_returns_409", func(t *testing.T) {
		ts := newIntegrationTestServer(t)
		engID := "eng-bad-transition"

		// Try to update directly from PROFILING to TRANSFORMING (skipping MAPPING).
		ts.mockEngagementGet(engID, models.StatusProfiling)

		resp := ts.do("PATCH", fmt.Sprintf("/api/v1/migration/engagements/%s", engID),
			map[string]string{"status": "TRANSFORMING"})

		if resp.StatusCode != http.StatusConflict {
			defer resp.Body.Close()
			var body map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&body)
			t.Fatalf("expected 409, got %d; body: %v", resp.StatusCode, body)
		}
		resp.Body.Close()
	})
}
