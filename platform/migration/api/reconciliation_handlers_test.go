package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

// tier1Cols matches the columns returned by the tier1Query in reconciler/tier1.go.
var tier1Cols = []string{
	"member_id", "member_status", "yos_used", "fas_used",
	"age_at_calc", "plan_code", "stored_benefit", "canonical_benefit",
}

// tier2Cols matches the columns returned by the tier2Query in reconciler/tier2.go.
var tier2Cols = []string{
	"member_id", "member_status", "gross_amount", "canonical_benefit",
}

func TestReconcileBatch_Success(t *testing.T) {
	h, mock := newTestHandler(t)

	// Tier 1 query: return one MATCH-worthy member (recomputed will match stored).
	// DB_MAIN: yos=25, fas=5000, age=65 -> gross = 25 * 0.20 * 5000 / 12 = 2083.33
	// No penalty at age 65. Final = 2083.33 (above $800 floor).
	mock.ExpectQuery("SELECT").
		WithArgs("batch-001").
		WillReturnRows(sqlmock.NewRows(tier1Cols).
			AddRow("M-001", "ACTIVE", "25", "5000.00", 65, "DB_MAIN", "2083.33", "2083.33"))

	// Tier 2 query: return empty (no payment-only members).
	mock.ExpectQuery("SELECT").
		WithArgs("batch-001").
		WillReturnRows(sqlmock.NewRows(tier2Cols))

	w := serve(h, "POST", "/api/v1/migration/batches/batch-001/reconcile", nil)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Parse the response envelope to verify GateResult fields.
	var resp struct {
		Data struct {
			WeightedScore float64 `json:"weighted_score"`
			GatePassed    bool    `json:"gate_passed"`
			TotalMembers  int     `json:"total_members"`
			MatchCount    int     `json:"match_count"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if !resp.Data.GatePassed {
		t.Error("expected gate to pass")
	}
	if resp.Data.TotalMembers != 1 {
		t.Errorf("expected 1 total member, got %d", resp.Data.TotalMembers)
	}
}

func TestReconcileBatch_MissingBatchID(t *testing.T) {
	h := NewHandler(nil)

	// Call the handler directly without setting path value to simulate missing id.
	req := httptest.NewRequest("POST", "/api/v1/migration/batches//reconcile", nil)
	w := httptest.NewRecorder()

	h.ReconcileBatch(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing batch ID, got %d", w.Code)
	}
}

func TestReconcileBatch_DBError(t *testing.T) {
	h, mock := newTestHandler(t)

	// Tier 1 query fails.
	mock.ExpectQuery("SELECT").
		WithArgs("batch-err").
		WillReturnError(sqlmock.ErrCancelled)

	w := serve(h, "POST", "/api/v1/migration/batches/batch-err/reconcile", nil)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetReconciliation_Placeholder(t *testing.T) {
	h := NewHandler(nil)

	w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/reconciliation", nil)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Data struct {
			EngagementID string `json:"engagement_id"`
			Status       string `json:"status"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if resp.Data.EngagementID != "eng-001" {
		t.Errorf("expected eng-001, got %q", resp.Data.EngagementID)
	}
	if resp.Data.Status != "not_yet_implemented" {
		t.Errorf("expected not_yet_implemented, got %q", resp.Data.Status)
	}
}

func TestGetP1Issues_Placeholder(t *testing.T) {
	h := NewHandler(nil)

	w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/reconciliation/p1", nil)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
