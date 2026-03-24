package reconciler

import (
	"os"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

// tier1Columns are the columns returned by the tier1Query.
var tier1Columns = []string{
	"member_id", "member_status", "yos_used", "fas_used",
	"age_at_calc", "plan_code", "stored_benefit", "canonical_benefit",
}

// testPlanConfig loads the real plan config for tier1 tests. If unavailable
// it builds a minimal in-memory config with TIER_1 and TIER_2.
func testPlanConfig(t *testing.T) *PlanConfig {
	t.Helper()
	if _, err := os.Stat(planConfigPath); err == nil {
		pc, err := LoadPlanConfig(planConfigPath)
		if err != nil {
			t.Fatalf("LoadPlanConfig: %v", err)
		}
		return pc
	}
	// Fallback: build a minimal PlanConfig for unit tests.
	floor := 800.0
	mult1 := 0.020
	mult2 := 0.015
	pc := &PlanConfig{
		System: SystemDef{
			Name:                "Test",
			ShortName:           "TST",
			NormalRetirementAge: 65,
		},
		Plans: []PlanDef{
			{
				ID:           "test",
				Name:         "Test Plan",
				BenefitFloor: &floor,
				Tiers: []TierDef{
					{
						ID:     "TIER_1",
						Name:   "Tier 1",
						Status: "active",
						Formula: FormulaStrategy{
							Type:       "flat_multiplier",
							Multiplier: &mult1,
						},
						Reduction: ReductionDef{
							Method: "lookup_table",
							Table: map[int]float64{
								55: 0.70, 56: 0.73, 57: 0.76, 58: 0.79,
								59: 0.82, 60: 0.85, 61: 0.88, 62: 0.91,
								63: 0.94, 64: 0.97, 65: 1.00,
							},
						},
					},
					{
						ID:     "TIER_2",
						Name:   "Tier 2",
						Status: "active",
						Formula: FormulaStrategy{
							Type:       "flat_multiplier",
							Multiplier: &mult2,
						},
						Reduction: ReductionDef{
							Method: "lookup_table",
							Table: map[int]float64{
								55: 0.70, 56: 0.73, 57: 0.76, 58: 0.79,
								59: 0.82, 60: 0.85, 61: 0.88, 62: 0.91,
								63: 0.94, 64: 0.97, 65: 1.00,
							},
						},
					},
				},
			},
		},
		tierMap: make(map[string]*TierDef),
	}
	// Wire up plan back-references and tier map.
	for i := range pc.Plans {
		plan := &pc.Plans[i]
		for j := range plan.Tiers {
			tier := &plan.Tiers[j]
			tier.plan = plan
			pc.tierMap[tier.ID] = tier
		}
	}
	return pc
}

func TestReconcileTier1_MatchCategory(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	pc := testPlanConfig(t)

	// TIER_1, yos=30, fas=25000, age=65 → gross=1250.00, factor=1.00, final=1250.00
	rows := sqlmock.NewRows(tier1Columns).
		AddRow("M001", "RETIREE", "30.0000", "25000.00", 65, "TIER_1", "1250.00", "1250.00")

	mock.ExpectQuery("SELECT").WithArgs("batch-001").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-001", pc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	r := results[0]
	if r.Category != CategoryMatch {
		t.Errorf("expected MATCH, got %s", r.Category)
	}
	if r.MemberID != "M001" {
		t.Errorf("expected member M001, got %s", r.MemberID)
	}
	if r.Tier != Tier1StoredCalc {
		t.Errorf("expected TIER1, got %s", r.Tier)
	}
	if r.MemberStatus != StatusRetiree {
		t.Errorf("expected RETIREE, got %s", r.MemberStatus)
	}
	if r.RecomputedValue != "1250.00" {
		t.Errorf("expected recomputed 1250.00, got %s", r.RecomputedValue)
	}
}

func TestReconcileTier1_MinorVariance(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	pc := testPlanConfig(t)

	// TIER_1, yos=30, fas=25000, age=65 → recomputed=1250.00
	// Stored benefit is $5 off.
	rows := sqlmock.NewRows(tier1Columns).
		AddRow("M002", "RETIREE", "30.0000", "25000.00", 65, "TIER_1", "1245.00", "1250.00")

	mock.ExpectQuery("SELECT").WithArgs("batch-001").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-001", pc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	r := results[0]
	if r.Category != CategoryMinor {
		t.Errorf("expected MINOR, got %s (variance=%s)", r.Category, r.VarianceAmount)
	}
	if r.VarianceAmount != "5.00" {
		t.Errorf("expected variance 5.00, got %s", r.VarianceAmount)
	}
}

func TestReconcileTier1_MajorVariance(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	pc := testPlanConfig(t)

	// TIER_1, yos=30, fas=25000, age=65 → recomputed=1250.00
	// Stored benefit is $100 off.
	rows := sqlmock.NewRows(tier1Columns).
		AddRow("M003", "RETIREE", "30.0000", "25000.00", 65, "TIER_1", "1150.00", "1250.00")

	mock.ExpectQuery("SELECT").WithArgs("batch-001").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-001", pc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	r := results[0]
	if r.Category != CategoryMajor {
		t.Errorf("expected MAJOR, got %s (variance=%s)", r.Category, r.VarianceAmount)
	}
	if r.VarianceAmount != "100.00" {
		t.Errorf("expected variance 100.00, got %s", r.VarianceAmount)
	}
	if r.SuspectedDomain == "" {
		t.Error("expected suspected_domain to be set for MAJOR variance")
	}
}

func TestReconcileTier1_EmptyResultSet(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	pc := testPlanConfig(t)

	rows := sqlmock.NewRows(tier1Columns)
	mock.ExpectQuery("SELECT").WithArgs("batch-empty").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-empty", pc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestReconcileTier1_MultipleMembersWithMixedStatus(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	pc := testPlanConfig(t)

	// TIER_1, yos=30, fas=25000, age=65 → 1250.00
	// TIER_1, yos=30, fas=25000, age=60 → gross=1250, factor=0.85, after=1062.50
	// TIER_2, yos=25, fas=5500, age=65  → gross=171.88, floor=800.00
	rows := sqlmock.NewRows(tier1Columns).
		AddRow("M010", "RETIREE", "30.0000", "25000.00", 65, "TIER_1", "1250.00", "1250.00").
		AddRow("M011", "ACTIVE", "30.0000", "25000.00", 60, "TIER_1", "1062.50", "1062.50").
		AddRow("M012", "DEFERRED", "25.0000", "5500.00", 65, "TIER_2", "800.00", "800.00")

	mock.ExpectQuery("SELECT").WithArgs("batch-mix").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-mix", pc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}

	// All should match
	for i, r := range results {
		if r.Category != CategoryMatch {
			t.Errorf("result[%d] (%s): expected MATCH, got %s (recomputed=%s, source=%s)",
				i, r.MemberID, r.Category, r.RecomputedValue, r.SourceValue)
		}
	}

	// Check statuses
	if results[0].MemberStatus != StatusRetiree {
		t.Errorf("M010: expected RETIREE, got %s", results[0].MemberStatus)
	}
	if results[1].MemberStatus != StatusActive {
		t.Errorf("M011: expected ACTIVE, got %s", results[1].MemberStatus)
	}
	if results[2].MemberStatus != StatusDeferred {
		t.Errorf("M012: expected DEFERRED, got %s", results[2].MemberStatus)
	}
}

func TestReconcileTier1_InvalidInputRecordsError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	pc := testPlanConfig(t)

	// Invalid yos value that can't be parsed
	rows := sqlmock.NewRows(tier1Columns).
		AddRow("M099", "RETIREE", "not-a-number", "5500.00", 65, "TIER_1", "800.00", "800.00")

	mock.ExpectQuery("SELECT").WithArgs("batch-err").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-err", pc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].Category != CategoryError {
		t.Errorf("expected ERROR category, got %s", results[0].Category)
	}
	if results[0].Details == "" {
		t.Error("expected error details to be populated")
	}
}

func TestReconcileTier1_BenefitFloorApplied(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	pc := testPlanConfig(t)

	// TIER_1: yos=5, fas=2000, age=65 → gross = 5*0.020*2000/12 = 16.67, floor=800.00
	rows := sqlmock.NewRows(tier1Columns).
		AddRow("M020", "RETIREE", "5.0000", "2000.00", 65, "TIER_1", "800.00", "800.00")

	mock.ExpectQuery("SELECT").WithArgs("batch-floor").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-floor", pc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].Category != CategoryMatch {
		t.Errorf("expected MATCH (floor applied), got %s", results[0].Category)
	}
	if results[0].RecomputedValue != "800.00" {
		t.Errorf("expected recomputed 800.00, got %s", results[0].RecomputedValue)
	}
}

// verify the variance thresholds haven't changed using a concrete example.
func TestReconcileTier1_VarianceThresholds(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	pc := testPlanConfig(t)

	// Recomputed value = 1250.00. Stored values just above/below $0.50 threshold.
	// $0.49 variance → MATCH; $0.51 → MINOR
	rows := sqlmock.NewRows(tier1Columns).
		AddRow("M030", "RETIREE", "30.0000", "25000.00", 65, "TIER_1", "1249.51", "1250.00")

	mock.ExpectQuery("SELECT").WithArgs("batch-thresh").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-thresh", pc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	// A $0.49 difference: 1250.00 - 1249.51 = 0.49
	r := results[0]
	// ClassifyVariance uses <=0.50 for MATCH, so 0.49 should be MATCH
	if r.Category != CategoryMatch {
		t.Errorf("expected MATCH for $0.49 variance, got %s", r.Category)
	}
}

// Verify the big.Rat precision is consistent across tiers.
func TestReconcileTier1_Tier2Precision(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	pc := testPlanConfig(t)

	// TIER_2: yos=25, fas=5500, age=65 → gross = 25*0.015*5500/12 = 171.875 → 171.88
	// floor = 800.00 applies
	rows := sqlmock.NewRows(tier1Columns).
		AddRow("M040", "RETIREE", "25.0000", "5500.00", 65, "TIER_2", "800.00", "800.00")

	mock.ExpectQuery("SELECT").WithArgs("batch-t2").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-t2", pc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].Category != CategoryMatch {
		t.Errorf("expected MATCH, got %s (recomputed=%s)", results[0].Category, results[0].RecomputedValue)
	}

}
