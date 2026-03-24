package reconciler

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

// tier3 column sets for sqlmock
var (
	tier3SalaryColumns        = []string{"member_id", "salary_year", "salary_amount"}
	tier3ContributionColumns  = []string{"sum"}
	tier3ServiceCreditColumns = []string{"member_id", "service_credit_years", "employment_start", "employment_end"}
	tier3StatusCountColumns   = []string{"member_status", "count"}
)

// expectAllTier3Queries sets up mock expectations for all 4 tier3 queries
// returning empty results, for use in tests that only care about one check.
func expectEmptyTier3Queries(mock sqlmock.Sqlmock, batchID string) {
	// Query 1: salary
	mock.ExpectQuery("SELECT member_id, salary_year, salary_amount").
		WithArgs(batchID).
		WillReturnRows(sqlmock.NewRows(tier3SalaryColumns))
	// Query 2: contribution
	mock.ExpectQuery("SELECT COALESCE").
		WithArgs(batchID).
		WillReturnRows(sqlmock.NewRows(tier3ContributionColumns).AddRow("0"))
	// Query 3: service credit
	mock.ExpectQuery("SELECT member_id, COALESCE").
		WithArgs(batchID).
		WillReturnRows(sqlmock.NewRows(tier3ServiceCreditColumns))
	// Query 4: status count
	mock.ExpectQuery("SELECT member_status, COUNT").
		WithArgs(batchID).
		WillReturnRows(sqlmock.NewRows(tier3StatusCountColumns))
}

func TestReconcileTier3_SalaryOutlierDetected(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// 10 members around 65000, one outlier at 95000
	salaryRows := sqlmock.NewRows(tier3SalaryColumns)
	for i := 1; i <= 10; i++ {
		salaryRows.AddRow(fmt.Sprintf("M%03d", i), 2023, 64000.0+float64(i)*200) // 64200..66000
	}
	salaryRows.AddRow("M099", 2023, 95000.0) // outlier

	mock.ExpectQuery("SELECT member_id, salary_year, salary_amount").
		WithArgs("batch-t3-001").
		WillReturnRows(salaryRows)

	// Contribution — match
	mock.ExpectQuery("SELECT COALESCE").
		WithArgs("batch-t3-001").
		WillReturnRows(sqlmock.NewRows(tier3ContributionColumns).AddRow("50000.00"))

	// Service credit — empty
	mock.ExpectQuery("SELECT member_id, COALESCE").
		WithArgs("batch-t3-001").
		WillReturnRows(sqlmock.NewRows(tier3ServiceCreditColumns))

	// Status count — empty benchmarks
	mock.ExpectQuery("SELECT member_status, COUNT").
		WithArgs("batch-t3-001").
		WillReturnRows(sqlmock.NewRows(tier3StatusCountColumns))

	benchmarks := PlanBenchmarks{
		AvgSalaryByYear:    map[int]float64{2023: 65000.0},
		TotalContributions: 50000.0,
	}

	results, err := ReconcileTier3(db, "batch-t3-001", benchmarks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should flag M099 as outlier
	var outliers []ReconciliationResult
	for _, r := range results {
		if r.SuspectedDomain == "SALARY" {
			outliers = append(outliers, r)
		}
	}

	if len(outliers) != 1 {
		t.Fatalf("expected 1 salary outlier, got %d", len(outliers))
	}

	r := outliers[0]
	if r.MemberID != "M099" {
		t.Errorf("expected outlier M099, got %s", r.MemberID)
	}
	if r.Tier != Tier3Aggregate {
		t.Errorf("expected TIER3, got %s", r.Tier)
	}
	if r.SuspectedDomain != "SALARY" {
		t.Errorf("expected domain SALARY, got %s", r.SuspectedDomain)
	}
	if !strings.Contains(r.Details, "95000.00") {
		t.Errorf("expected details to mention 95000.00, got %s", r.Details)
	}
	if !strings.Contains(r.Details, "std devs") {
		t.Errorf("expected details to mention std devs, got %s", r.Details)
	}
}

func TestReconcileTier3_NoSalaryOutliers(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// All salaries within a tight range — no outliers
	salaryRows := sqlmock.NewRows(tier3SalaryColumns)
	for i := 1; i <= 5; i++ {
		salaryRows.AddRow(fmt.Sprintf("M%03d", i), 2023, 64000.0+float64(i)*500) // 64500..66500
	}

	mock.ExpectQuery("SELECT member_id, salary_year, salary_amount").
		WithArgs("batch-t3-002").
		WillReturnRows(salaryRows)

	mock.ExpectQuery("SELECT COALESCE").
		WithArgs("batch-t3-002").
		WillReturnRows(sqlmock.NewRows(tier3ContributionColumns).AddRow("10000.00"))

	mock.ExpectQuery("SELECT member_id, COALESCE").
		WithArgs("batch-t3-002").
		WillReturnRows(sqlmock.NewRows(tier3ServiceCreditColumns))

	mock.ExpectQuery("SELECT member_status, COUNT").
		WithArgs("batch-t3-002").
		WillReturnRows(sqlmock.NewRows(tier3StatusCountColumns))

	benchmarks := PlanBenchmarks{
		AvgSalaryByYear:    map[int]float64{2023: 65000.0},
		TotalContributions: 10000.0,
	}

	results, err := ReconcileTier3(db, "batch-t3-002", benchmarks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for _, r := range results {
		if r.SuspectedDomain == "SALARY" {
			t.Errorf("expected no salary outliers, got result for %s", r.MemberID)
		}
	}
}

func TestReconcileTier3_ContributionTotalMatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Empty salary data
	mock.ExpectQuery("SELECT member_id, salary_year, salary_amount").
		WithArgs("batch-t3-003").
		WillReturnRows(sqlmock.NewRows(tier3SalaryColumns))

	// Contribution total matches benchmark exactly
	mock.ExpectQuery("SELECT COALESCE").
		WithArgs("batch-t3-003").
		WillReturnRows(sqlmock.NewRows(tier3ContributionColumns).AddRow("125000.50"))

	mock.ExpectQuery("SELECT member_id, COALESCE").
		WithArgs("batch-t3-003").
		WillReturnRows(sqlmock.NewRows(tier3ServiceCreditColumns))

	mock.ExpectQuery("SELECT member_status, COUNT").
		WithArgs("batch-t3-003").
		WillReturnRows(sqlmock.NewRows(tier3StatusCountColumns))

	benchmarks := PlanBenchmarks{
		TotalContributions: 125000.50,
	}

	results, err := ReconcileTier3(db, "batch-t3-003", benchmarks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for _, r := range results {
		if r.SuspectedDomain == "CONTRIBUTION" {
			t.Errorf("expected no contribution mismatch, got result: %s", r.Details)
		}
	}
}

func TestReconcileTier3_ContributionTotalMismatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT member_id, salary_year, salary_amount").
		WithArgs("batch-t3-004").
		WillReturnRows(sqlmock.NewRows(tier3SalaryColumns))

	// Contribution total differs by $500
	mock.ExpectQuery("SELECT COALESCE").
		WithArgs("batch-t3-004").
		WillReturnRows(sqlmock.NewRows(tier3ContributionColumns).AddRow("125500.00"))

	mock.ExpectQuery("SELECT member_id, COALESCE").
		WithArgs("batch-t3-004").
		WillReturnRows(sqlmock.NewRows(tier3ServiceCreditColumns))

	mock.ExpectQuery("SELECT member_status, COUNT").
		WithArgs("batch-t3-004").
		WillReturnRows(sqlmock.NewRows(tier3StatusCountColumns))

	benchmarks := PlanBenchmarks{
		TotalContributions: 125000.00,
	}

	results, err := ReconcileTier3(db, "batch-t3-004", benchmarks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var contribResults []ReconciliationResult
	for _, r := range results {
		if r.SuspectedDomain == "CONTRIBUTION" {
			contribResults = append(contribResults, r)
		}
	}

	if len(contribResults) != 1 {
		t.Fatalf("expected 1 contribution result, got %d", len(contribResults))
	}

	r := contribResults[0]
	if r.MemberID != "AGGREGATE" {
		t.Errorf("expected AGGREGATE member ID, got %s", r.MemberID)
	}
	if r.Tier != Tier3Aggregate {
		t.Errorf("expected TIER3, got %s", r.Tier)
	}
	if r.VarianceAmount != "500.00" {
		t.Errorf("expected variance 500.00, got %s", r.VarianceAmount)
	}
	if r.SuspectedDomain != "CONTRIBUTION" {
		t.Errorf("expected domain CONTRIBUTION, got %s", r.SuspectedDomain)
	}
}

func TestReconcileTier3_ServiceCreditDiscrepancy(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT member_id, salary_year, salary_amount").
		WithArgs("batch-t3-005").
		WillReturnRows(sqlmock.NewRows(tier3SalaryColumns))

	mock.ExpectQuery("SELECT COALESCE").
		WithArgs("batch-t3-005").
		WillReturnRows(sqlmock.NewRows(tier3ContributionColumns).AddRow("0"))

	// Member with 10 years credit but only ~8 years employment span (25% discrepancy)
	start := time.Date(2015, 1, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC) // ~8 years
	mock.ExpectQuery("SELECT member_id, COALESCE").
		WithArgs("batch-t3-005").
		WillReturnRows(sqlmock.NewRows(tier3ServiceCreditColumns).
			AddRow("M050", 10.0, start, end))

	mock.ExpectQuery("SELECT member_status, COUNT").
		WithArgs("batch-t3-005").
		WillReturnRows(sqlmock.NewRows(tier3StatusCountColumns))

	benchmarks := PlanBenchmarks{
		TotalContributions: 0,
	}

	results, err := ReconcileTier3(db, "batch-t3-005", benchmarks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var serviceResults []ReconciliationResult
	for _, r := range results {
		if r.SuspectedDomain == "SERVICE_CREDIT" {
			serviceResults = append(serviceResults, r)
		}
	}

	if len(serviceResults) != 1 {
		t.Fatalf("expected 1 service credit result, got %d", len(serviceResults))
	}

	r := serviceResults[0]
	if r.MemberID != "M050" {
		t.Errorf("expected M050, got %s", r.MemberID)
	}
	if r.Tier != Tier3Aggregate {
		t.Errorf("expected TIER3, got %s", r.Tier)
	}
	if r.SuspectedDomain != "SERVICE_CREDIT" {
		t.Errorf("expected domain SERVICE_CREDIT, got %s", r.SuspectedDomain)
	}
	if !strings.Contains(r.Details, "10.00") {
		t.Errorf("expected details to mention 10.00 years credit, got %s", r.Details)
	}
	if !strings.Contains(r.Details, "discrepancy") {
		t.Errorf("expected details to mention discrepancy, got %s", r.Details)
	}
}

func TestReconcileTier3_MemberCountMismatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT member_id, salary_year, salary_amount").
		WithArgs("batch-t3-006").
		WillReturnRows(sqlmock.NewRows(tier3SalaryColumns))

	mock.ExpectQuery("SELECT COALESCE").
		WithArgs("batch-t3-006").
		WillReturnRows(sqlmock.NewRows(tier3ContributionColumns).AddRow("0"))

	mock.ExpectQuery("SELECT member_id, COALESCE").
		WithArgs("batch-t3-006").
		WillReturnRows(sqlmock.NewRows(tier3ServiceCreditColumns))

	// Actual counts differ from benchmarks
	mock.ExpectQuery("SELECT member_status, COUNT").
		WithArgs("batch-t3-006").
		WillReturnRows(sqlmock.NewRows(tier3StatusCountColumns).
			AddRow("ACTIVE", 100).
			AddRow("RETIREE", 45))

	benchmarks := PlanBenchmarks{
		TotalContributions: 0,
		MemberCountByStatus: map[string]int{
			"ACTIVE":  120, // expected 120, got 100
			"RETIREE": 45,  // matches
		},
	}

	results, err := ReconcileTier3(db, "batch-t3-006", benchmarks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var statusResults []ReconciliationResult
	for _, r := range results {
		if r.SuspectedDomain == "MEMBER_COUNT" {
			statusResults = append(statusResults, r)
		}
	}

	if len(statusResults) != 1 {
		t.Fatalf("expected 1 status count result, got %d", len(statusResults))
	}

	r := statusResults[0]
	if r.MemberID != "AGGREGATE" {
		t.Errorf("expected AGGREGATE member ID, got %s", r.MemberID)
	}
	if r.Tier != Tier3Aggregate {
		t.Errorf("expected TIER3, got %s", r.Tier)
	}
	if r.Category != CategoryMajor {
		t.Errorf("expected MAJOR category, got %s", r.Category)
	}
	if !strings.Contains(r.Details, "ACTIVE") {
		t.Errorf("expected details to mention ACTIVE, got %s", r.Details)
	}
	if !strings.Contains(r.Details, "expected 120") {
		t.Errorf("expected details to mention expected 120, got %s", r.Details)
	}
}

func TestReconcileTier3_EmptyBatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	expectEmptyTier3Queries(mock, "batch-t3-empty")

	benchmarks := PlanBenchmarks{
		AvgSalaryByYear:    map[int]float64{2023: 65000.0},
		TotalContributions: 0,
	}

	results, err := ReconcileTier3(db, "batch-t3-empty", benchmarks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results for empty batch, got %d", len(results))
	}
}

func TestReconcileTier3_AllChecksClean(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	// Salaries all within range for year 2023
	salaryRows := sqlmock.NewRows(tier3SalaryColumns)
	for i := 1; i <= 5; i++ {
		salaryRows.AddRow(fmt.Sprintf("M%03d", i), 2023, 64000.0+float64(i)*500)
	}
	mock.ExpectQuery("SELECT member_id, salary_year, salary_amount").
		WithArgs("batch-t3-clean").
		WillReturnRows(salaryRows)

	// Contributions match
	mock.ExpectQuery("SELECT COALESCE").
		WithArgs("batch-t3-clean").
		WillReturnRows(sqlmock.NewRows(tier3ContributionColumns).AddRow("50000.00"))

	// Service credit matches employment span (~10 years each, within 10%)
	start := time.Date(2013, 6, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2023, 6, 1, 0, 0, 0, 0, time.UTC) // ~10 years
	mock.ExpectQuery("SELECT member_id, COALESCE").
		WithArgs("batch-t3-clean").
		WillReturnRows(sqlmock.NewRows(tier3ServiceCreditColumns).
			AddRow("M001", 10.0, start, end).
			AddRow("M002", 9.5, start, end)) // 9.5 vs ~10 = 5% discrepancy, within 10%

	// Status counts match
	mock.ExpectQuery("SELECT member_status, COUNT").
		WithArgs("batch-t3-clean").
		WillReturnRows(sqlmock.NewRows(tier3StatusCountColumns).
			AddRow("ACTIVE", 3).
			AddRow("RETIREE", 2))

	benchmarks := PlanBenchmarks{
		AvgSalaryByYear:    map[int]float64{2023: 65000.0},
		TotalContributions: 50000.00,
		MemberCountByStatus: map[string]int{
			"ACTIVE":  3,
			"RETIREE": 2,
		},
	}

	results, err := ReconcileTier3(db, "batch-t3-clean", benchmarks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results when all checks clean, got %d", len(results))
		for _, r := range results {
			t.Logf("  unexpected result: domain=%s member=%s details=%s", r.SuspectedDomain, r.MemberID, r.Details)
		}
	}
}

func TestReconcileTier3_SalaryQueryError(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT member_id, salary_year, salary_amount").
		WithArgs("batch-fail").
		WillReturnError(fmt.Errorf("connection refused"))

	benchmarks := PlanBenchmarks{
		AvgSalaryByYear: map[int]float64{2023: 65000.0},
	}

	results, err := ReconcileTier3(db, "batch-fail", benchmarks)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if results != nil {
		t.Errorf("expected nil results on query error, got %d", len(results))
	}
	if !strings.Contains(err.Error(), "salary check failed") {
		t.Errorf("expected salary check failed in error, got: %v", err)
	}
}

func TestReconcileTier3_ServiceCreditNoDiscrepancy(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT member_id, salary_year, salary_amount").
		WithArgs("batch-t3-svc").
		WillReturnRows(sqlmock.NewRows(tier3SalaryColumns))

	mock.ExpectQuery("SELECT COALESCE").
		WithArgs("batch-t3-svc").
		WillReturnRows(sqlmock.NewRows(tier3ContributionColumns).AddRow("0"))

	// Member with matching service credit and employment span
	start := time.Date(2013, 1, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC) // ~10 years
	mock.ExpectQuery("SELECT member_id, COALESCE").
		WithArgs("batch-t3-svc").
		WillReturnRows(sqlmock.NewRows(tier3ServiceCreditColumns).
			AddRow("M060", 10.0, start, end))

	mock.ExpectQuery("SELECT member_status, COUNT").
		WithArgs("batch-t3-svc").
		WillReturnRows(sqlmock.NewRows(tier3StatusCountColumns))

	benchmarks := PlanBenchmarks{
		TotalContributions: 0,
	}

	results, err := ReconcileTier3(db, "batch-t3-svc", benchmarks)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for _, r := range results {
		if r.SuspectedDomain == "SERVICE_CREDIT" {
			t.Errorf("expected no service credit flagging, got result for %s", r.MemberID)
		}
	}
}
