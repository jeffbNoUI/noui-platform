package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/migration/reconciler"
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

// tier3SalaryCols matches the columns returned by tier3SalaryQuery.
var tier3SalaryCols = []string{"member_id", "salary_year", "salary_amount"}

// tier3ContribCols matches the columns returned by tier3ContributionQuery.
var tier3ContribCols = []string{"sum"}

// tier3ServiceCols matches the columns returned by tier3ServiceCreditQuery.
var tier3ServiceCols = []string{"member_id", "service_credit_years", "employment_start", "employment_end"}

// planConfigTestPath is the relative path from the api/ test dir to plan-config.yaml.
const planConfigTestPath = "../../../domains/pension/plan-config.yaml"

// loadTestPlanConfig attempts to load PlanConfig for tests. Returns nil if unavailable.
func loadTestPlanConfig(t *testing.T) *reconciler.PlanConfig {
	t.Helper()
	if _, err := os.Stat(planConfigTestPath); os.IsNotExist(err) {
		t.Log("plan-config.yaml not found; using nil PlanConfig")
		return nil
	}
	pc, err := reconciler.LoadPlanConfig(planConfigTestPath)
	if err != nil {
		t.Fatalf("LoadPlanConfig: %v", err)
	}
	return pc
}

func TestReconcileBatch_Success(t *testing.T) {
	h, mock := newTestHandler(t)
	h.PlanConfig = loadTestPlanConfig(t)

	// Tier 1 query: return one MATCH-worthy member (recomputed will match stored).
	// TIER_1: yos=30, fas=25000, age=65 -> gross = 30 * 0.020 * 25000 / 12 = 1250.00
	// No reduction at age 65. Final = 1250.00 (above $800 floor).
	mock.ExpectQuery("SELECT").
		WithArgs("batch-001").
		WillReturnRows(sqlmock.NewRows(tier1Cols).
			AddRow("M-001", "ACTIVE", "30", "25000.00", 65, "TIER_1", "1250.00", "1250.00"))

	// Tier 2 query: return empty (no payment-only members).
	mock.ExpectQuery("SELECT").
		WithArgs("batch-001").
		WillReturnRows(sqlmock.NewRows(tier2Cols))

	// computeBenchmarks queries (run before Tier 3):
	// Benchmark 1: avg salary by year — return empty
	benchSalaryCols := []string{"yr", "avg"}
	mock.ExpectQuery("SELECT").
		WithArgs("batch-001").
		WillReturnRows(sqlmock.NewRows(benchSalaryCols))
	// Benchmark 2: total contributions — return "0"
	benchContribCols := []string{"coalesce"}
	mock.ExpectQuery("SELECT").
		WithArgs("batch-001").
		WillReturnRows(sqlmock.NewRows(benchContribCols).AddRow("0"))
	// Benchmark 3: member count by status — return empty
	benchStatusCols := []string{"member_status", "count"}
	mock.ExpectQuery("SELECT").
		WithArgs("batch-001").
		WillReturnRows(sqlmock.NewRows(benchStatusCols))

	// Tier 3 queries (with computed benchmarks):
	// 3a: salary outliers — return empty rows
	mock.ExpectQuery("SELECT").
		WithArgs("batch-001").
		WillReturnRows(sqlmock.NewRows(tier3SalaryCols))
	// 3b: contribution total — return "0"
	mock.ExpectQuery("SELECT").
		WithArgs("batch-001").
		WillReturnRows(sqlmock.NewRows(tier3ContribCols).AddRow("0"))
	// 3c: service credit span — return empty rows
	mock.ExpectQuery("SELECT").
		WithArgs("batch-001").
		WillReturnRows(sqlmock.NewRows(tier3ServiceCols))

	// Persistence: DELETE + INSERT (non-fatal if they fail, but mock expects them).
	mock.ExpectBegin()
	mock.ExpectExec("DELETE FROM migration.reconciliation").
		WithArgs("batch-001").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec("INSERT INTO migration.reconciliation").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

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

func TestGetReconciliation_Empty(t *testing.T) {
	h, mock := newTestHandler(t)

	reconCols := []string{
		"recon_id", "batch_id", "member_id", "tier", "category", "priority",
		"legacy_value", "recomputed_value", "variance_amount", "suspected_domain", "details",
	}

	mock.ExpectQuery("SELECT").
		WithArgs("eng-001").
		WillReturnRows(sqlmock.NewRows(reconCols))

	w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/reconciliation", nil)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Data struct {
			EngagementID string `json:"engagement_id"`
			Count        int    `json:"count"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if resp.Data.EngagementID != "eng-001" {
		t.Errorf("expected eng-001, got %q", resp.Data.EngagementID)
	}
}

func TestGetP1Issues_Empty(t *testing.T) {
	h, mock := newTestHandler(t)

	p1Cols := []string{
		"recon_id", "batch_id", "member_id", "tier", "category",
		"legacy_value", "recomputed_value", "variance_amount", "suspected_domain", "details",
	}

	mock.ExpectQuery("SELECT").
		WithArgs("eng-001").
		WillReturnRows(sqlmock.NewRows(p1Cols))

	w := serve(h, "GET", "/api/v1/migration/engagements/eng-001/reconciliation/p1", nil)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
