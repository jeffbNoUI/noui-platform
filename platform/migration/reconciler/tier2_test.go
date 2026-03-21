package reconciler

import (
	"fmt"
	"math/big"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

// tier2Columns are the columns returned by the tier2Query.
var tier2Columns = []string{
	"member_id", "member_status", "gross_amount", "canonical_benefit",
}

func TestReconcileTier2_WithinTolerance(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Payment = 2300.00, canonical = 2291.67 → diff = 8.33, pct = 0.36% → MATCH
	rows := sqlmock.NewRows(tier2Columns).
		AddRow("M101", "RETIREE", "2300.00", "2291.67")

	mock.ExpectQuery("SELECT").WithArgs("batch-t2-001").WillReturnRows(rows)

	results, err := ReconcileTier2(db, "batch-t2-001")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	r := results[0]
	if r.Category != CategoryMatch {
		t.Errorf("expected MATCH, got %s (variance=%s)", r.Category, r.VarianceAmount)
	}
	if r.Tier != Tier2PaymentHist {
		t.Errorf("expected TIER2, got %s", r.Tier)
	}
	if r.MemberID != "M101" {
		t.Errorf("expected M101, got %s", r.MemberID)
	}
	if r.MemberStatus != StatusRetiree {
		t.Errorf("expected RETIREE, got %s", r.MemberStatus)
	}
	if r.SourceValue != "2300.00" {
		t.Errorf("expected source 2300.00, got %s", r.SourceValue)
	}
	if r.CanonicalValue != "2291.67" {
		t.Errorf("expected canonical 2291.67, got %s", r.CanonicalValue)
	}
	if r.VarianceAmount != "8.33" {
		t.Errorf("expected variance 8.33, got %s", r.VarianceAmount)
	}
}

func TestReconcileTier2_ExactMatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Payment exactly equals canonical → 0% variance → MATCH
	rows := sqlmock.NewRows(tier2Columns).
		AddRow("M102", "RETIREE", "2291.67", "2291.67")

	mock.ExpectQuery("SELECT").WithArgs("batch-t2-002").WillReturnRows(rows)

	results, err := ReconcileTier2(db, "batch-t2-002")
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
	if r.VarianceAmount != "0.00" {
		t.Errorf("expected variance 0.00, got %s", r.VarianceAmount)
	}
}

func TestReconcileTier2_MinorVariance(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// canonical=500.00, payment=515.00 → diff=15.00, pct=3% (>2%) → falls to ClassifyVariance
	// $15 is > $0.50 and < $25 → MINOR
	rows := sqlmock.NewRows(tier2Columns).
		AddRow("M103", "ACTIVE", "515.00", "500.00")

	mock.ExpectQuery("SELECT").WithArgs("batch-t2-003").WillReturnRows(rows)

	results, err := ReconcileTier2(db, "batch-t2-003")
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
	if r.VarianceAmount != "15.00" {
		t.Errorf("expected variance 15.00, got %s", r.VarianceAmount)
	}
}

func TestReconcileTier2_MajorVariance(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Payment = 2500.00, canonical = 2291.67 → diff = 208.33, pct = 9.1% → MAJOR ($208.33 ≥ $25)
	rows := sqlmock.NewRows(tier2Columns).
		AddRow("M104", "RETIREE", "2500.00", "2291.67")

	mock.ExpectQuery("SELECT").WithArgs("batch-t2-004").WillReturnRows(rows)

	results, err := ReconcileTier2(db, "batch-t2-004")
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
	if r.VarianceAmount != "208.33" {
		t.Errorf("expected variance 208.33, got %s", r.VarianceAmount)
	}
}

func TestReconcileTier2_EmptyResultSet(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	rows := sqlmock.NewRows(tier2Columns)
	mock.ExpectQuery("SELECT").WithArgs("batch-t2-empty").WillReturnRows(rows)

	results, err := ReconcileTier2(db, "batch-t2-empty")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestReconcileTier2_RetireeWithMinorVariance(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Retiree with small variance outside 2% tolerance but < $25 → MINOR
	// canonical=800.00, payment=820.00 → diff=20.00, pct=2.5% → MINOR
	rows := sqlmock.NewRows(tier2Columns).
		AddRow("M105", "RETIREE", "820.00", "800.00")

	mock.ExpectQuery("SELECT").WithArgs("batch-t2-005").WillReturnRows(rows)

	results, err := ReconcileTier2(db, "batch-t2-005")
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
	if r.MemberStatus != StatusRetiree {
		t.Errorf("expected RETIREE status for P1 escalation scoring, got %s", r.MemberStatus)
	}
	if r.VarianceAmount != "20.00" {
		t.Errorf("expected variance 20.00, got %s", r.VarianceAmount)
	}
}

func TestReconcileTier2_ZeroCanonicalAmount(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// canonical = 0.00 → division by zero guard → ERROR
	rows := sqlmock.NewRows(tier2Columns).
		AddRow("M106", "DEFERRED", "500.00", "0.00")

	mock.ExpectQuery("SELECT").WithArgs("batch-t2-006").WillReturnRows(rows)

	results, err := ReconcileTier2(db, "batch-t2-006")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	r := results[0]
	if r.Category != CategoryError {
		t.Errorf("expected ERROR for zero canonical, got %s", r.Category)
	}
	if r.Details == "" {
		t.Error("expected non-empty Details for zero canonical ERROR")
	}
}

func TestReconcileTier2_InvalidGrossAmount(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Invalid gross_amount → parse error → ERROR result (not abort)
	rows := sqlmock.NewRows(tier2Columns).
		AddRow("M107", "RETIREE", "not-a-number", "2291.67")

	mock.ExpectQuery("SELECT").WithArgs("batch-t2-007").WillReturnRows(rows)

	results, err := ReconcileTier2(db, "batch-t2-007")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	r := results[0]
	if r.Category != CategoryError {
		t.Errorf("expected ERROR for invalid gross_amount, got %s", r.Category)
	}
	if r.Details == "" {
		t.Error("expected error details to be populated")
	}
	if r.Tier != Tier2PaymentHist {
		t.Errorf("expected TIER2, got %s", r.Tier)
	}
}

func TestReconcileTier2_InvalidCanonicalAmount(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	rows := sqlmock.NewRows(tier2Columns).
		AddRow("M108", "RETIREE", "2300.00", "bad-value")

	mock.ExpectQuery("SELECT").WithArgs("batch-t2-008").WillReturnRows(rows)

	results, err := ReconcileTier2(db, "batch-t2-008")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	r := results[0]
	if r.Category != CategoryError {
		t.Errorf("expected ERROR for invalid canonical, got %s", r.Category)
	}
	if r.Details == "" {
		t.Error("expected error details to be populated")
	}
}

func TestReconcileTier2_MultipleMembersMixedCategories(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	rows := sqlmock.NewRows(tier2Columns).
		AddRow("M201", "RETIREE", "2300.00", "2291.67").  // ~0.36% → MATCH
		AddRow("M202", "ACTIVE", "515.00", "500.00").     // 3% → MINOR ($15)
		AddRow("M203", "DEFERRED", "2500.00", "2291.67"). // 9.1% → MAJOR ($208.33)
		AddRow("M204", "RETIREE", "2291.67", "2291.67")   // exact → MATCH

	mock.ExpectQuery("SELECT").WithArgs("batch-t2-mix").WillReturnRows(rows)

	results, err := ReconcileTier2(db, "batch-t2-mix")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 4 {
		t.Fatalf("expected 4 results, got %d", len(results))
	}

	expected := []struct {
		memberID string
		status   MemberStatus
		category VarianceCategory
	}{
		{"M201", StatusRetiree, CategoryMatch},
		{"M202", StatusActive, CategoryMinor},
		{"M203", StatusDeferred, CategoryMajor},
		{"M204", StatusRetiree, CategoryMatch},
	}

	for i, exp := range expected {
		r := results[i]
		if r.MemberID != exp.memberID {
			t.Errorf("result[%d]: expected member %s, got %s", i, exp.memberID, r.MemberID)
		}
		if r.MemberStatus != exp.status {
			t.Errorf("result[%d] (%s): expected status %s, got %s", i, r.MemberID, exp.status, r.MemberStatus)
		}
		if r.Category != exp.category {
			t.Errorf("result[%d] (%s): expected %s, got %s (variance=%s)", i, r.MemberID, exp.category, r.Category, r.VarianceAmount)
		}
	}
}

func TestReconcileTier2_PaymentBelowCanonical(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Payment BELOW canonical but within 2% → still MATCH
	// canonical = 2291.67, payment = 2260.00 → diff = 31.67, pct = 1.38% → MATCH
	rows := sqlmock.NewRows(tier2Columns).
		AddRow("M109", "RETIREE", "2260.00", "2291.67")

	mock.ExpectQuery("SELECT").WithArgs("batch-t2-below").WillReturnRows(rows)

	results, err := ReconcileTier2(db, "batch-t2-below")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	r := results[0]
	if r.Category != CategoryMatch {
		t.Errorf("expected MATCH for underpayment within tolerance, got %s (variance=%s)", r.Category, r.VarianceAmount)
	}
	if r.VarianceAmount != "31.67" {
		t.Errorf("expected variance 31.67, got %s", r.VarianceAmount)
	}
}

func TestReconcileTier2_BoundaryAt2Percent(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Exactly at 2% boundary → should be MATCH (≤ 0.02)
	// canonical = 1000.00, payment = 1020.00 → diff = 20.00, pct = exactly 2% → MATCH
	rows := sqlmock.NewRows(tier2Columns).
		AddRow("M110", "ACTIVE", "1020.00", "1000.00")

	mock.ExpectQuery("SELECT").WithArgs("batch-t2-boundary").WillReturnRows(rows)

	results, err := ReconcileTier2(db, "batch-t2-boundary")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	r := results[0]
	if r.Category != CategoryMatch {
		t.Errorf("expected MATCH at exactly 2%% boundary, got %s", r.Category)
	}
}

func TestReconcileTier2_JustOver2Percent(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Just over 2% → falls through to dollar thresholds
	// canonical = 1000.00, payment = 1020.01 → diff = 20.01, pct = 2.001% → ClassifyVariance
	// $20.01 is > $0.50 and < $25 → MINOR
	rows := sqlmock.NewRows(tier2Columns).
		AddRow("M111", "ACTIVE", "1020.01", "1000.00")

	mock.ExpectQuery("SELECT").WithArgs("batch-t2-over").WillReturnRows(rows)

	results, err := ReconcileTier2(db, "batch-t2-over")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	r := results[0]
	if r.Category != CategoryMinor {
		t.Errorf("expected MINOR just over 2%% boundary, got %s (variance=%s)", r.Category, r.VarianceAmount)
	}
}

func TestClassifyTier2Variance_Unit(t *testing.T) {
	tests := []struct {
		name      string
		payment   string
		canonical string
		want      VarianceCategory
	}{
		{"exact match", "2291.67", "2291.67", CategoryMatch},
		{"within 2%", "2300.00", "2291.67", CategoryMatch},
		{"at 2% boundary", "1020.00", "1000.00", CategoryMatch},
		{"zero canonical", "500.00", "0", CategoryError},
		{"minor: 3% on small amount", "515.00", "500.00", CategoryMinor},
		{"major: large variance", "2500.00", "2291.67", CategoryMajor},
		{"negative variance within tolerance", "2260.00", "2291.67", CategoryMatch},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := new(big.Rat)
			if _, ok := p.SetString(tt.payment); !ok {
				t.Fatalf("invalid payment %q", tt.payment)
			}
			c := new(big.Rat)
			if _, ok := c.SetString(tt.canonical); !ok {
				t.Fatalf("invalid canonical %q", tt.canonical)
			}

			got := classifyTier2Variance(p, c)
			if got != tt.want {
				t.Errorf("classifyTier2Variance(%s, %s) = %s, want %s", tt.payment, tt.canonical, got, tt.want)
			}
		})
	}
}

func TestReconcileTier2_QueryError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT").WithArgs("batch-fail").
		WillReturnError(fmt.Errorf("connection refused"))

	results, err := ReconcileTier2(db, "batch-fail")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if results != nil {
		t.Errorf("expected nil results on query error, got %d", len(results))
	}
}
