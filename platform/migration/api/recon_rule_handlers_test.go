package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

// reconRuleSetCols matches the 10-column RETURNING clause in recon_rules.go.
var reconRuleSetCols = []string{
	"ruleset_id", "engagement_id", "version", "label", "status",
	"rules", "created_by", "created_at", "activated_at", "superseded_at",
}

// --- AC-3: POST /api/v1/migration/engagements/{id}/recon-rules ---

func TestCreateReconRuleSet(t *testing.T) {
	t.Run("success_creates_draft_ruleset", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		rulesJSON := `[{"rule_id":"1_annual_benefit","tier":1,"calc_name":"annual_benefit","comparison_type":"TOLERANCE_ABS","tolerance_value":"0.01","priority_if_mismatch":"P1","enabled":true}]`

		mock.ExpectQuery("INSERT INTO migration.recon_rule_set").
			WithArgs(
				"eng-001",        // engagement_id
				"Initial Rules",  // label
				sqlmock.AnyArg(), // rules JSON
				defaultTenantID,  // created_by
			).
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).AddRow(
				"rs-001", "eng-001", 1, "Initial Rules", "DRAFT",
				rulesJSON, defaultTenantID, now, nil, nil,
			))

		body, _ := json.Marshal(map[string]interface{}{
			"label": "Initial Rules",
			"rules": []map[string]interface{}{
				{
					"tier":                 1,
					"calc_name":            "annual_benefit",
					"comparison_type":      "TOLERANCE_ABS",
					"tolerance_value":      "0.01",
					"priority_if_mismatch": "P1",
					"enabled":              true,
				},
			},
		})

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/recon-rules", body)

		if w.Code != http.StatusCreated {
			t.Fatalf("status = %d, want 201; body: %s", w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].(map[string]interface{})

		if data["ruleset_id"] != "rs-001" {
			t.Errorf("ruleset_id = %v, want rs-001", data["ruleset_id"])
		}
		if data["status"] != "DRAFT" {
			t.Errorf("status = %v, want DRAFT", data["status"])
		}
		if data["version"].(float64) != 1 {
			t.Errorf("version = %v, want 1", data["version"])
		}

		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("rejects_empty_rules_array", func(t *testing.T) {
		h, _ := newTestHandler(t)

		body, _ := json.Marshal(map[string]interface{}{
			"label": "Empty",
			"rules": []interface{}{},
		})

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/recon-rules", body)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("rejects_invalid_tier", func(t *testing.T) {
		h, _ := newTestHandler(t)

		body, _ := json.Marshal(map[string]interface{}{
			"label": "Bad tier",
			"rules": []map[string]interface{}{
				{
					"tier":                 5,
					"calc_name":            "annual_benefit",
					"comparison_type":      "EXACT",
					"tolerance_value":      "0",
					"priority_if_mismatch": "P1",
					"enabled":              true,
				},
			},
		})

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/recon-rules", body)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("rejects_invalid_comparison_type", func(t *testing.T) {
		h, _ := newTestHandler(t)

		body, _ := json.Marshal(map[string]interface{}{
			"label": "Bad comparison",
			"rules": []map[string]interface{}{
				{
					"tier":                 1,
					"calc_name":            "annual_benefit",
					"comparison_type":      "FUZZY_MATCH",
					"tolerance_value":      "0",
					"priority_if_mismatch": "P1",
					"enabled":              true,
				},
			},
		})

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/recon-rules", body)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("rejects_duplicate_rule_ids_422", func(t *testing.T) {
		h, _ := newTestHandler(t)

		body, _ := json.Marshal(map[string]interface{}{
			"label": "Dupe rules",
			"rules": []map[string]interface{}{
				{
					"tier":                 1,
					"calc_name":            "annual_benefit",
					"comparison_type":      "EXACT",
					"tolerance_value":      "0",
					"priority_if_mismatch": "P1",
					"enabled":              true,
				},
				{
					"tier":                 1,
					"calc_name":            "annual_benefit",
					"comparison_type":      "TOLERANCE_ABS",
					"tolerance_value":      "0.01",
					"priority_if_mismatch": "P2",
					"enabled":              true,
				},
			},
		})

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/recon-rules", body)

		if w.Code != http.StatusUnprocessableEntity {
			t.Fatalf("status = %d, want 422; body: %s", w.Code, w.Body.String())
		}
	})
}

// --- AC-4: POST .../recon-rules/{rulesetId}/activate ---

func TestActivateReconRuleSet(t *testing.T) {
	t.Run("success_activates_draft", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		rulesJSON := `[{"rule_id":"1_annual_benefit","tier":1,"calc_name":"annual_benefit","comparison_type":"EXACT","tolerance_value":"0","priority_if_mismatch":"P1","enabled":true}]`

		// Begin transaction
		mock.ExpectBegin()

		// Check status
		mock.ExpectQuery("SELECT status FROM migration.recon_rule_set").
			WithArgs("rs-001", "eng-001").
			WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow("DRAFT"))

		// Supersede currently active (no rows affected is fine)
		mock.ExpectExec("UPDATE migration.recon_rule_set").
			WithArgs("eng-001").
			WillReturnResult(sqlmock.NewResult(0, 0))

		// Activate the target
		mock.ExpectQuery("UPDATE migration.recon_rule_set").
			WithArgs("rs-001").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).AddRow(
				"rs-001", "eng-001", 1, "Initial Rules", "ACTIVE",
				rulesJSON, defaultTenantID, now, now, nil,
			))

		// Commit
		mock.ExpectCommit()

		// Gate transition insert
		mock.ExpectQuery("INSERT INTO migration.gate_transition").
			WithArgs(
				"eng-001",
				"RECON_RULES_DRAFT",
				"RECON_RULES_ACTIVE",
				"ADVANCE",
				sqlmock.AnyArg(), // gate_metrics JSON
				"",               // ai_recommendation
				sqlmock.AnyArg(), // overrides JSON
				defaultTenantID,  // authorized_by
				"",               // notes
			).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "engagement_id", "from_phase", "to_phase", "direction",
				"gate_metrics", "ai_recommendation", "overrides", "authorized_by",
				"authorized_at", "notes",
			}).AddRow(
				"gt-001", "eng-001", "RECON_RULES_DRAFT", "RECON_RULES_ACTIVE", "ADVANCE",
				`{"ruleset_version":1}`, "", `[]`, defaultTenantID, now, "",
			))

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/recon-rules/rs-001/activate", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].(map[string]interface{})

		if data["status"] != "ACTIVE" {
			t.Errorf("status = %v, want ACTIVE", data["status"])
		}

		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("returns_409_if_not_draft", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mock.ExpectBegin()
		mock.ExpectQuery("SELECT status FROM migration.recon_rule_set").
			WithArgs("rs-001", "eng-001").
			WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow("ACTIVE"))
		mock.ExpectRollback()

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/recon-rules/rs-001/activate", nil)

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("returns_404_if_not_found", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mock.ExpectBegin()
		mock.ExpectQuery("SELECT status FROM migration.recon_rule_set").
			WithArgs("rs-missing", "eng-001").
			WillReturnError(sql.ErrNoRows)
		mock.ExpectRollback()

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/recon-rules/rs-missing/activate", nil)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404; body: %s", w.Code, w.Body.String())
		}
	})
}

// --- AC-5: GET endpoints ---

func TestReconRuleSetEndpoints(t *testing.T) {
	t.Run("list_returns_all_rulesets_newest_first", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		rulesJSON := `[]`
		mock.ExpectQuery("SELECT ruleset_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).
				AddRow("rs-002", "eng-001", 2, "V2", "DRAFT", rulesJSON, defaultTenantID, now, nil, nil).
				AddRow("rs-001", "eng-001", 1, "V1", "ACTIVE", rulesJSON, defaultTenantID, now, now, nil),
			)

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/recon-rules", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		data, ok := resp["data"].([]interface{})
		if !ok {
			t.Fatalf("data is not an array: %s", w.Body.String())
		}
		if len(data) != 2 {
			t.Errorf("expected 2 rulesets, got %d", len(data))
		}
	})

	t.Run("list_with_status_filter", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		rulesJSON := `[]`
		mock.ExpectQuery("SELECT ruleset_id").
			WithArgs("eng-001", "DRAFT").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).
				AddRow("rs-002", "eng-001", 2, "V2", "DRAFT", rulesJSON, defaultTenantID, now, nil, nil),
			)

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/recon-rules?status=DRAFT", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("get_active_returns_active_ruleset", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		rulesJSON := `[{"rule_id":"1_benefit","tier":1,"calc_name":"benefit","comparison_type":"EXACT","tolerance_value":"0","priority_if_mismatch":"P1","enabled":true}]`
		mock.ExpectQuery("SELECT ruleset_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).
				AddRow("rs-001", "eng-001", 1, "V1", "ACTIVE", rulesJSON, defaultTenantID, now, now, nil),
			)

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/recon-rules/active", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].(map[string]interface{})
		if data["status"] != "ACTIVE" {
			t.Errorf("status = %v, want ACTIVE", data["status"])
		}
	})

	t.Run("get_active_returns_404_if_none", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mock.ExpectQuery("SELECT ruleset_id").
			WithArgs("eng-001").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/recon-rules/active", nil)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("get_single_ruleset", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		rulesJSON := `[]`
		mock.ExpectQuery("SELECT ruleset_id").
			WithArgs("rs-001").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).
				AddRow("rs-001", "eng-001", 1, "V1", "DRAFT", rulesJSON, defaultTenantID, now, nil, nil),
			)

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/recon-rules/rs-001", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("get_single_returns_404", func(t *testing.T) {
		h, mock := newTestHandler(t)

		mock.ExpectQuery("SELECT ruleset_id").
			WithArgs("rs-missing").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols))

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/recon-rules/rs-missing", nil)

		if w.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("patch_updates_draft_only", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		rulesJSON := `[{"rule_id":"1_annual_benefit","tier":1,"calc_name":"annual_benefit","comparison_type":"EXACT","tolerance_value":"0","priority_if_mismatch":"P1","enabled":true}]`

		// GetReconRuleSet (for status check in UpdateReconRuleSet)
		mock.ExpectQuery("SELECT ruleset_id").
			WithArgs("rs-001").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).
				AddRow("rs-001", "eng-001", 1, "Old Label", "DRAFT", rulesJSON, defaultTenantID, now, nil, nil),
			)

		// Update
		mock.ExpectQuery("UPDATE migration.recon_rule_set").
			WithArgs("rs-001", "New Label", sqlmock.AnyArg()).
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).
				AddRow("rs-001", "eng-001", 1, "New Label", "DRAFT", rulesJSON, defaultTenantID, now, nil, nil),
			)

		body, _ := json.Marshal(map[string]interface{}{
			"label": "New Label",
		})

		w := serve(h, "PATCH", "/api/v1/migration/engagements/eng-001/recon-rules/rs-001", body)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("patch_returns_409_if_not_draft", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		rulesJSON := `[]`
		mock.ExpectQuery("SELECT ruleset_id").
			WithArgs("rs-001").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).
				AddRow("rs-001", "eng-001", 1, "V1", "ACTIVE", rulesJSON, defaultTenantID, now, now, nil),
			)

		body, _ := json.Marshal(map[string]interface{}{
			"label": "New Label",
		})

		w := serve(h, "PATCH", "/api/v1/migration/engagements/eng-001/recon-rules/rs-001", body)

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
	})
}

// --- AC-6: Archive + Audit + Diff ---

func TestReconRuleSetAuditAndDiff(t *testing.T) {
	t.Run("archive_transitions_superseded_to_archived", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		rulesJSON := `[]`

		// GetReconRuleSet (status check)
		mock.ExpectQuery("SELECT ruleset_id").
			WithArgs("rs-001").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).
				AddRow("rs-001", "eng-001", 1, "V1", "SUPERSEDED", rulesJSON, defaultTenantID, now, now, now),
			)

		// Update to ARCHIVED
		mock.ExpectQuery("UPDATE migration.recon_rule_set").
			WithArgs("rs-001").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).
				AddRow("rs-001", "eng-001", 1, "V1", "ARCHIVED", rulesJSON, defaultTenantID, now, now, now),
			)

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/recon-rules/rs-001/archive", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].(map[string]interface{})
		if data["status"] != "ARCHIVED" {
			t.Errorf("status = %v, want ARCHIVED", data["status"])
		}

		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("archive_returns_409_if_not_superseded", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		rulesJSON := `[]`
		mock.ExpectQuery("SELECT ruleset_id").
			WithArgs("rs-001").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).
				AddRow("rs-001", "eng-001", 1, "V1", "DRAFT", rulesJSON, defaultTenantID, now, nil, nil),
			)

		w := serve(h, "POST", "/api/v1/migration/engagements/eng-001/recon-rules/rs-001/archive", nil)

		if w.Code != http.StatusConflict {
			t.Fatalf("status = %d, want 409; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("diff_returns_structured_comparison", func(t *testing.T) {
		h, mock := newTestHandler(t)
		now := time.Now().UTC()

		fromRulesJSON := `[{"rule_id":"1_annual_benefit","tier":1,"calc_name":"annual_benefit","comparison_type":"EXACT","tolerance_value":"0","priority_if_mismatch":"P1","enabled":true},{"rule_id":"2_service_credit","tier":2,"calc_name":"service_credit","comparison_type":"TOLERANCE_ABS","tolerance_value":"0.01","priority_if_mismatch":"P2","enabled":true}]`
		toRulesJSON := `[{"rule_id":"1_annual_benefit","tier":1,"calc_name":"annual_benefit","comparison_type":"TOLERANCE_ABS","tolerance_value":"0.01","priority_if_mismatch":"P1","enabled":true},{"rule_id":"3_address_match","tier":3,"calc_name":"address_match","comparison_type":"EXACT","tolerance_value":"0","priority_if_mismatch":"P3","enabled":true}]`

		// Get "from" ruleset
		mock.ExpectQuery("SELECT ruleset_id").
			WithArgs("rs-001").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).
				AddRow("rs-001", "eng-001", 1, "V1", "SUPERSEDED", fromRulesJSON, defaultTenantID, now, now, now),
			)

		// Get "to" ruleset
		mock.ExpectQuery("SELECT ruleset_id").
			WithArgs("rs-002").
			WillReturnRows(sqlmock.NewRows(reconRuleSetCols).
				AddRow("rs-002", "eng-001", 2, "V2", "ACTIVE", toRulesJSON, defaultTenantID, now, now, nil),
			)

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/recon-rules/rs-001/diff?compare_to=rs-002", nil)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &resp)
		data := resp["data"].(map[string]interface{})

		added, _ := data["added"].([]interface{})
		removed, _ := data["removed"].([]interface{})
		modified, _ := data["modified"].([]interface{})

		// 3_address_match is added (in to but not from)
		if len(added) != 1 {
			t.Errorf("expected 1 added rule, got %d; body: %s", len(added), w.Body.String())
		}

		// 2_service_credit is removed (in from but not to)
		if len(removed) != 1 {
			t.Errorf("expected 1 removed rule, got %d; body: %s", len(removed), w.Body.String())
		}

		// 1_annual_benefit is modified (comparison_type changed from EXACT to TOLERANCE_ABS)
		if len(modified) != 1 {
			t.Errorf("expected 1 modified rule, got %d; body: %s", len(modified), w.Body.String())
		}

		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	})

	t.Run("diff_returns_400_if_same_id", func(t *testing.T) {
		h, _ := newTestHandler(t)

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/recon-rules/rs-001/diff?compare_to=rs-001", nil)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400; body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("diff_returns_400_if_missing_compare_to", func(t *testing.T) {
		h, _ := newTestHandler(t)

		w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/recon-rules/rs-001/diff", nil)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400; body: %s", w.Code, w.Body.String())
		}
	})
}
