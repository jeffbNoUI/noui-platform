package reconciler

import (
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

// tier1Columns are the columns returned by the tier1Query.
var tier1Columns = []string{
	"member_id", "member_status", "yos_used", "fas_used",
	"age_at_calc", "plan_code", "stored_benefit", "canonical_benefit",
}

func TestReconcileTier1_MatchCategory(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Member with stored benefit that matches recomputed value exactly.
	// DB_MAIN, yos=25, fas=5500, age=65 → recomputed = 2291.67
	rows := sqlmock.NewRows(tier1Columns).
		AddRow("M001", "RETIREE", "25.0000", "5500.00", 65, "DB_MAIN", "2291.67", "2291.67")

	mock.ExpectQuery("SELECT").WithArgs("batch-001").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-001")
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
	if r.RecomputedValue != "2291.67" {
		t.Errorf("expected recomputed 2291.67, got %s", r.RecomputedValue)
	}
}

func TestReconcileTier1_MinorVariance(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Stored benefit is $5 off from recomputed (2291.67).
	rows := sqlmock.NewRows(tier1Columns).
		AddRow("M002", "RETIREE", "25.0000", "5500.00", 65, "DB_MAIN", "2286.67", "2291.67")

	mock.ExpectQuery("SELECT").WithArgs("batch-001").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-001")
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

	// Stored benefit is $100 off from recomputed (2291.67).
	rows := sqlmock.NewRows(tier1Columns).
		AddRow("M003", "RETIREE", "25.0000", "5500.00", 65, "DB_MAIN", "2191.67", "2291.67")

	mock.ExpectQuery("SELECT").WithArgs("batch-001").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-001")
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

	rows := sqlmock.NewRows(tier1Columns)
	mock.ExpectQuery("SELECT").WithArgs("batch-empty").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-empty")
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

	rows := sqlmock.NewRows(tier1Columns).
		AddRow("M010", "RETIREE", "25.0000", "5500.00", 65, "DB_MAIN", "2291.67", "2291.67").
		AddRow("M011", "ACTIVE", "20.0000", "4800.00", 60, "DB_MAIN", "1120.00", "1120.00").
		AddRow("M012", "DEFERRED", "25.0000", "5500.00", 65, "DB_T2", "2062.50", "2062.50")

	mock.ExpectQuery("SELECT").WithArgs("batch-mix").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-mix")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}

	// All should match
	for i, r := range results {
		if r.Category != CategoryMatch {
			t.Errorf("result[%d] (%s): expected MATCH, got %s", i, r.MemberID, r.Category)
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

	// Invalid yos value that can't be parsed
	rows := sqlmock.NewRows(tier1Columns).
		AddRow("M099", "RETIREE", "not-a-number", "5500.00", 65, "DB_MAIN", "2291.67", "2291.67")

	mock.ExpectQuery("SELECT").WithArgs("batch-err").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-err")
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

	// yos=5, fas=2000, age=65 → gross=166.67, floor=800.00
	rows := sqlmock.NewRows(tier1Columns).
		AddRow("M020", "RETIREE", "5.0000", "2000.00", 65, "DB_MAIN", "800.00", "800.00")

	mock.ExpectQuery("SELECT").WithArgs("batch-floor").WillReturnRows(rows)

	results, err := ReconcileTier1(db, "batch-floor")
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
