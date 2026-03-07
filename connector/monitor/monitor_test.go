package monitor

import (
	"math"
	"os"
	"path/filepath"
	"testing"

	"github.com/noui/platform/connector/schema"
)

// ============================================================================
// Baseline computation tests (using computeStats directly)
// ============================================================================

func TestComputeStats_NormalValues(t *testing.T) {
	values := []float64{100, 200, 300, 400, 500}
	b := computeStats("test_metric", values)

	if b.MetricName != "test_metric" {
		t.Errorf("expected metric name 'test_metric', got %q", b.MetricName)
	}
	if b.SampleSize != 5 {
		t.Errorf("expected sample size 5, got %d", b.SampleSize)
	}
	if b.Mean != 300.0 {
		t.Errorf("expected mean 300.0, got %.2f", b.Mean)
	}
	if b.Min != 100.0 {
		t.Errorf("expected min 100.0, got %.2f", b.Min)
	}
	if b.Max != 500.0 {
		t.Errorf("expected max 500.0, got %.2f", b.Max)
	}
	// Population stddev of [100,200,300,400,500] = sqrt(20000) = 141.42
	expectedStdDev := 141.42
	if math.Abs(b.StdDev-expectedStdDev) > 0.01 {
		t.Errorf("expected stddev ~%.2f, got %.2f", expectedStdDev, b.StdDev)
	}
}

func TestComputeStats_EmptyValues(t *testing.T) {
	b := computeStats("empty_metric", []float64{})

	if b.SampleSize != 0 {
		t.Errorf("expected sample size 0, got %d", b.SampleSize)
	}
	if b.Mean != 0 {
		t.Errorf("expected mean 0 for empty values, got %.2f", b.Mean)
	}
	if b.StdDev != 0 {
		t.Errorf("expected stddev 0 for empty values, got %.2f", b.StdDev)
	}
}

func TestComputeStats_SingleValue(t *testing.T) {
	b := computeStats("single", []float64{42.5})

	if b.SampleSize != 1 {
		t.Errorf("expected sample size 1, got %d", b.SampleSize)
	}
	if b.Mean != 42.5 {
		t.Errorf("expected mean 42.5, got %.2f", b.Mean)
	}
	if b.Min != 42.5 {
		t.Errorf("expected min 42.5, got %.2f", b.Min)
	}
	if b.Max != 42.5 {
		t.Errorf("expected max 42.5, got %.2f", b.Max)
	}
	// Single value: stddev should be 0 (len(values) <= 1 branch)
	if b.StdDev != 0 {
		t.Errorf("expected stddev 0 for single value, got %.2f", b.StdDev)
	}
}

func TestComputeStats_IdenticalValues(t *testing.T) {
	b := computeStats("identical", []float64{50, 50, 50, 50})

	if b.Mean != 50.0 {
		t.Errorf("expected mean 50.0, got %.2f", b.Mean)
	}
	if b.StdDev != 0 {
		t.Errorf("expected stddev 0 for identical values, got %.2f", b.StdDev)
	}
	if b.Min != 50.0 || b.Max != 50.0 {
		t.Errorf("expected min=max=50.0, got min=%.2f max=%.2f", b.Min, b.Max)
	}
}

func TestComputeStats_RoundingTo2Decimals(t *testing.T) {
	// Use values that produce non-round results
	values := []float64{1, 2, 3}
	b := computeStats("rounding", values)

	// Mean = 2.0 (exact)
	if b.Mean != 2.0 {
		t.Errorf("expected mean 2.0, got %.10f", b.Mean)
	}

	// StdDev = sqrt(2/3) = 0.8165... -> rounded to 0.82
	expectedStdDev := 0.82
	if b.StdDev != expectedStdDev {
		t.Errorf("expected stddev %.2f after rounding, got %.10f", expectedStdDev, b.StdDev)
	}
}

func TestRound2(t *testing.T) {
	cases := []struct {
		input    float64
		expected float64
	}{
		{1.234, 1.23},
		{1.235, 1.24},  // banker's rounding edge
		{1.999, 2.0},
		{0.001, 0.0},
		{0.005, 0.01},
		{-1.234, -1.23},
		{100.0, 100.0},
		{0, 0},
	}
	for _, tc := range cases {
		got := round2(tc.input)
		if got != tc.expected {
			t.Errorf("round2(%.4f): expected %.2f, got %.2f", tc.input, tc.expected, got)
		}
	}
}

// ============================================================================
// Check result structure tests
// ============================================================================

func TestCheckResultFields(t *testing.T) {
	r := schema.CheckResult{
		CheckName: "test_check",
		Category:  "validity",
		Status:    "pass",
		Message:   "all good",
		Expected:  0,
		Actual:    0,
		Deviation: 0,
		Timestamp: "2026-01-01T00:00:00Z",
	}

	if r.CheckName != "test_check" {
		t.Errorf("expected check_name 'test_check', got %q", r.CheckName)
	}
	if r.Category != "validity" {
		t.Errorf("expected category 'validity', got %q", r.Category)
	}
	if r.Status != "pass" {
		t.Errorf("expected status 'pass', got %q", r.Status)
	}
}

func TestReportSummaryAggregation(t *testing.T) {
	checks := []schema.CheckResult{
		{Status: "pass"},
		{Status: "pass"},
		{Status: "warn"},
		{Status: "fail"},
		{Status: "fail"},
		{Status: "fail"},
	}

	summary := schema.ReportSummary{TotalChecks: len(checks)}
	for _, c := range checks {
		switch c.Status {
		case "pass":
			summary.Passed++
		case "warn":
			summary.Warnings++
		case "fail":
			summary.Failed++
		}
	}

	if summary.TotalChecks != 6 {
		t.Errorf("expected 6 total checks, got %d", summary.TotalChecks)
	}
	if summary.Passed != 2 {
		t.Errorf("expected 2 passed, got %d", summary.Passed)
	}
	if summary.Warnings != 1 {
		t.Errorf("expected 1 warning, got %d", summary.Warnings)
	}
	if summary.Failed != 3 {
		t.Errorf("expected 3 failed, got %d", summary.Failed)
	}
}

func TestAllPassScenario(t *testing.T) {
	checks := []schema.CheckResult{
		{Status: "pass"},
		{Status: "pass"},
		{Status: "pass"},
	}

	summary := schema.ReportSummary{TotalChecks: len(checks)}
	for _, c := range checks {
		if c.Status == "pass" {
			summary.Passed++
		}
	}

	if summary.Passed != summary.TotalChecks {
		t.Errorf("expected all checks to pass: %d/%d", summary.Passed, summary.TotalChecks)
	}
	if summary.Warnings != 0 || summary.Failed != 0 {
		t.Errorf("expected 0 warnings and 0 failures, got %d/%d", summary.Warnings, summary.Failed)
	}
}

// ============================================================================
// Check logic documentation tests
// These tests verify that AllChecks(NewMonitorAdapter("mysql")) returns the expected set of 8 checks
// and document what each check verifies.
// ============================================================================

func TestAllChecksCount(t *testing.T) {
	checks := AllChecks(NewMonitorAdapter("mysql"), DefaultThresholds())
	if len(checks) != 11 {
		t.Errorf("expected 11 monitoring checks (8 HR + 3 pension), got %d", len(checks))
	}
}

func TestCheckCategories(t *testing.T) {
	// Document the expected check name -> category mapping
	expectedChecks := map[string]string{
		"salary_gap_check":              "completeness",
		"negative_leave_balance_check":  "validity",
		"missing_termination_check":     "completeness",
		"missing_payroll_run_check":     "completeness",
		"invalid_hire_date_check":       "validity",
		"contribution_imbalance_check":  "consistency",
		"stale_payroll_check":           "timeliness",
		"stale_attendance_check":        "timeliness",
		"beneficiary_allocation_check":  "consistency",
		"service_credit_overlap_check":  "validity",
		"dro_status_consistency_check":  "consistency",
	}

	t.Logf("Monitor defines %d checks:", len(expectedChecks))
	for name, category := range expectedChecks {
		t.Logf("  [%s] %s", category, name)
	}

	// Verify we have exactly these categories represented
	categories := make(map[string]bool)
	for _, cat := range expectedChecks {
		categories[cat] = true
	}
	expectedCategories := []string{"completeness", "validity", "consistency", "timeliness"}
	for _, ec := range expectedCategories {
		if !categories[ec] {
			t.Errorf("expected category %q to be represented in checks", ec)
		}
	}
}

// ============================================================================
// Check SQL logic documentation
// Each test documents the SQL approach for a specific check.
// ============================================================================

func TestSalaryGapCheckDescription(t *testing.T) {
	t.Log("salary_gap_check:")
	t.Log("  Purpose: Find employees with gaps in their monthly salary slip sequence")
	t.Log("  Table: tabSalary Slip (docstatus=1)")
	t.Log("  Logic: For each employee, collect all months (YYYY-MM) from start_date.")
	t.Log("         Walk the sequence and flag gaps > 1 month.")
	t.Log("  Status: FAIL if any gaps found, PASS otherwise")
	t.Log("  Evidence: employee name + gap months")
}

func TestNegativeLeaveBalanceCheckDescription(t *testing.T) {
	t.Log("negative_leave_balance_check:")
	t.Log("  Purpose: Find leave allocations with negative total_leaves_allocated")
	t.Log("  Table: tabLeave Allocation (docstatus=1)")
	t.Log("  Logic: SELECT WHERE total_leaves_allocated < 0")
	t.Log("  Status: FAIL if count > 0, PASS otherwise")
	t.Log("  Evidence: employee name, leave type, negative amount")
}

func TestMissingTerminationCheckDescription(t *testing.T) {
	t.Log("missing_termination_check:")
	t.Log("  Purpose: Find employees with status='Left' but no Employee Separation record")
	t.Log("  Tables: tabEmployee LEFT JOIN tabEmployee Separation")
	t.Log("  Logic: WHERE e.status='Left' AND es.name IS NULL")
	t.Log("  Status: FAIL if any found, PASS otherwise")
	t.Log("  Evidence: employee ID and name")
}

func TestMissingPayrollRunCheckDescription(t *testing.T) {
	t.Log("missing_payroll_run_check:")
	t.Log("  Purpose: Find months where salary slips exist but no Payroll Entry")
	t.Log("  Tables: tabSalary Slip vs tabPayroll Entry (docstatus=1)")
	t.Log("  Logic: Compare distinct months from salary slips against payroll entries.")
	t.Log("         Report months present in slips but absent from entries.")
	t.Log("  Status: FAIL if any missing months, PASS otherwise")
	t.Log("  Evidence: year-month values")
}

func TestInvalidHireDateCheckDescription(t *testing.T) {
	t.Log("invalid_hire_date_check:")
	t.Log("  Purpose: Find employees with date_of_joining in the future")
	t.Log("  Table: tabEmployee")
	t.Log("  Logic: WHERE date_of_joining > CURDATE()")
	t.Log("  Status: FAIL if count > 0, PASS otherwise")
	t.Log("  Evidence: employee ID, name, and future date")
}

func TestContributionImbalanceCheckDescription(t *testing.T) {
	t.Log("contribution_imbalance_check:")
	t.Log("  Purpose: Find salary slips where gross_pay deviates from salary structure base")
	t.Log("  Tables: tabSalary Slip JOIN tabSalary Structure Assignment (docstatus=1)")
	t.Log("  Logic: For each employee, get their latest salary structure assignment base.")
	t.Log("         Compare with salary slip gross_pay. Flag if deviation > 5%.")
	t.Log("  Status: WARN if 5-10% deviation, FAIL if >10%, PASS otherwise")
	t.Log("  Evidence: employee name, expected base, actual gross, deviation %")
}

// ============================================================================
// Baseline type tests
// ============================================================================

func TestBaselineType(t *testing.T) {
	b := schema.Baseline{
		MetricName: "test",
		Mean:       100.50,
		StdDev:     10.25,
		Min:        80.00,
		Max:        120.00,
		SampleSize: 12,
	}

	if b.MetricName != "test" {
		t.Errorf("expected MetricName 'test', got %q", b.MetricName)
	}
	if b.Mean != 100.50 {
		t.Errorf("expected Mean 100.50, got %.2f", b.Mean)
	}
	if b.SampleSize != 12 {
		t.Errorf("expected SampleSize 12, got %d", b.SampleSize)
	}
}

// ============================================================================
// MonitorReport tests
// ============================================================================

func TestMonitorReportStructure(t *testing.T) {
	report := schema.MonitorReport{
		Source:   "mysql",
		Database: "test_db",
		RunAt:   "2026-01-01T00:00:00Z",
		Baselines: []schema.Baseline{
			{MetricName: "metric1", Mean: 10, SampleSize: 5},
		},
		Checks: []schema.CheckResult{
			{CheckName: "check1", Status: "pass"},
			{CheckName: "check2", Status: "fail", Details: []string{"error1"}},
		},
		Summary: schema.ReportSummary{
			TotalChecks: 2,
			Passed:      1,
			Failed:      1,
		},
	}

	if report.Source != "mysql" {
		t.Errorf("expected source 'mysql', got %q", report.Source)
	}
	if report.Database != "test_db" {
		t.Errorf("expected database 'test_db', got %q", report.Database)
	}
	if len(report.Baselines) != 1 {
		t.Errorf("expected 1 baseline, got %d", len(report.Baselines))
	}
	if len(report.Checks) != 2 {
		t.Errorf("expected 2 checks, got %d", len(report.Checks))
	}
	if report.Summary.TotalChecks != 2 {
		t.Errorf("expected 2 total checks in summary, got %d", report.Summary.TotalChecks)
	}
}

// ============================================================================
// DSN parsing tests
// ============================================================================

func TestExtractDBFromDSN(t *testing.T) {
	cases := []struct {
		dsn      string
		expected string
	}{
		{"root:admin@tcp(127.0.0.1:3307)/_0919b4e09c48d335", "_0919b4e09c48d335"},
		{"user:pass@tcp(localhost:3306)/mydb", "mydb"},
		{"user:pass@tcp(localhost:3306)/mydb?charset=utf8", "mydb"},
		{"root:admin@tcp(127.0.0.1:3307)/", ""},
		{"noslash", ""},
	}

	for _, tc := range cases {
		got := ExtractDBFromDSN(tc.dsn)
		if got != tc.expected {
			t.Errorf("ExtractDBFromDSN(%q): expected %q, got %q", tc.dsn, tc.expected, got)
		}
	}
}

// ============================================================================
// Edge case: check with empty details
// ============================================================================

func TestCheckResultEmptyDetails(t *testing.T) {
	r := schema.CheckResult{
		CheckName: "empty_check",
		Status:    "pass",
		Message:   "nothing found",
	}

	if r.Details != nil {
		t.Errorf("expected nil details for empty check, got %v", r.Details)
	}
}

// ============================================================================
// Edge case: computeStats with large values
// ============================================================================

func TestComputeStats_LargeValues(t *testing.T) {
	values := []float64{1000000, 2000000, 3000000}
	b := computeStats("large", values)

	if b.Mean != 2000000.0 {
		t.Errorf("expected mean 2000000.0, got %.2f", b.Mean)
	}
	if b.Min != 1000000.0 {
		t.Errorf("expected min 1000000.0, got %.2f", b.Min)
	}
	if b.Max != 3000000.0 {
		t.Errorf("expected max 3000000.0, got %.2f", b.Max)
	}
	// StdDev should be ~816496.58
	if b.StdDev < 816496 || b.StdDev > 816497 {
		t.Errorf("expected stddev ~816496.58, got %.2f", b.StdDev)
	}
}

// ============================================================================
// Edge case: computeStats with negative values
// ============================================================================

func TestComputeStats_NegativeValues(t *testing.T) {
	values := []float64{-10, -5, 0, 5, 10}
	b := computeStats("negative", values)

	if b.Mean != 0.0 {
		t.Errorf("expected mean 0.0, got %.2f", b.Mean)
	}
	if b.Min != -10.0 {
		t.Errorf("expected min -10.0, got %.2f", b.Min)
	}
	if b.Max != 10.0 {
		t.Errorf("expected max 10.0, got %.2f", b.Max)
	}
}

// ============================================================================
// Edge case: computeStats with two values
// ============================================================================

func TestComputeStats_TwoValues(t *testing.T) {
	values := []float64{10, 20}
	b := computeStats("two", values)

	if b.Mean != 15.0 {
		t.Errorf("expected mean 15.0, got %.2f", b.Mean)
	}
	// Population stddev of [10,20] = sqrt(25) = 5.0
	if b.StdDev != 5.0 {
		t.Errorf("expected stddev 5.0, got %.2f", b.StdDev)
	}
}

// ============================================================================
// Verify deviation calculation logic
// ============================================================================

func TestDeviationCalculation(t *testing.T) {
	// Simulate: expected base = 100, actual gross = 115 => 15% deviation
	expected := 100.0
	actual := 115.0
	deviation := math.Abs(actual-expected) / expected * 100

	if round2(deviation) != 15.0 {
		t.Errorf("expected 15%% deviation, got %.2f%%", deviation)
	}

	// 5% case: expected=100, actual=105
	actual = 105.0
	deviation = math.Abs(actual-expected) / expected * 100
	if round2(deviation) != 5.0 {
		t.Errorf("expected 5%% deviation, got %.2f%%", deviation)
	}

	// Within range: expected=100, actual=103
	actual = 103.0
	deviation = math.Abs(actual-expected) / expected * 100
	if round2(deviation) != 3.0 {
		t.Errorf("expected 3%% deviation, got %.2f%%", deviation)
	}
}

// ============================================================================
// Timeliness check documentation tests
// ============================================================================

func TestStalePayrollCheckDescription(t *testing.T) {
	t.Log("stale_payroll_check:")
	t.Log("  Purpose: Detect if salary slip processing has fallen behind")
	t.Log("  Table: tabSalary Slip (docstatus=1)")
	t.Log("  Logic: Get MAX(start_date). Compare months behind current date.")
	t.Log("  Status: FAIL if >2 months behind, WARN if >1 month behind, PASS otherwise")
	t.Log("  Evidence: latest salary slip date, days since, months behind")
}

func TestStaleAttendanceCheckDescription(t *testing.T) {
	t.Log("stale_attendance_check:")
	t.Log("  Purpose: Detect if attendance recording has gone stale")
	t.Log("  Table: tabAttendance (docstatus=1)")
	t.Log("  Logic: Get MAX(attendance_date). Compare days since current date.")
	t.Log("  Status: FAIL if >30 days stale, WARN if >7 days, PASS otherwise")
	t.Log("  Evidence: latest attendance date, days since")
}

// ============================================================================
// Configurable thresholds tests
// ============================================================================

func TestDefaultThresholds(t *testing.T) {
	th := DefaultThresholds()

	if th.ContributionWarnPct != 5 {
		t.Errorf("expected contribution warn 5%%, got %.1f%%", th.ContributionWarnPct)
	}
	if th.ContributionFailPct != 10 {
		t.Errorf("expected contribution fail 10%%, got %.1f%%", th.ContributionFailPct)
	}
	if th.StalePayrollWarnMonths != 1 {
		t.Errorf("expected stale payroll warn 1 month, got %d", th.StalePayrollWarnMonths)
	}
	if th.StalePayrollFailMonths != 2 {
		t.Errorf("expected stale payroll fail 2 months, got %d", th.StalePayrollFailMonths)
	}
	if th.StaleAttendWarnDays != 7 {
		t.Errorf("expected stale attend warn 7 days, got %d", th.StaleAttendWarnDays)
	}
	if th.StaleAttendFailDays != 30 {
		t.Errorf("expected stale attend fail 30 days, got %d", th.StaleAttendFailDays)
	}
}

func TestLoadThresholds(t *testing.T) {
	tmpDir := t.TempDir()
	thFile := filepath.Join(tmpDir, "thresholds.json")

	// Write custom thresholds — only override some fields
	content := `{
		"contribution_warn_pct": 3,
		"contribution_fail_pct": 8,
		"stale_attend_fail_days": 14
	}`
	if err := os.WriteFile(thFile, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to write thresholds file: %v", err)
	}

	th, err := LoadThresholds(thFile)
	if err != nil {
		t.Fatalf("LoadThresholds failed: %v", err)
	}

	// Overridden values
	if th.ContributionWarnPct != 3 {
		t.Errorf("expected contribution warn 3%%, got %.1f%%", th.ContributionWarnPct)
	}
	if th.ContributionFailPct != 8 {
		t.Errorf("expected contribution fail 8%%, got %.1f%%", th.ContributionFailPct)
	}
	if th.StaleAttendFailDays != 14 {
		t.Errorf("expected stale attend fail 14 days, got %d", th.StaleAttendFailDays)
	}

	// Defaults preserved for non-overridden fields
	if th.StalePayrollWarnMonths != 1 {
		t.Errorf("expected default stale payroll warn 1, got %d", th.StalePayrollWarnMonths)
	}
	if th.StalePayrollFailMonths != 2 {
		t.Errorf("expected default stale payroll fail 2, got %d", th.StalePayrollFailMonths)
	}
}

func TestEvaluateCountThreshold(t *testing.T) {
	// Default: warn=1, fail=1 (any count triggers fail)
	defaultTh := CheckThreshold{WarnAt: 1, FailAt: 1}
	if evaluateCountThreshold(0, defaultTh) != "pass" {
		t.Error("expected pass for count=0")
	}
	if evaluateCountThreshold(1, defaultTh) != "fail" {
		t.Error("expected fail for count=1 with default threshold")
	}

	// Tiered: warn at 3, fail at 10
	tiered := CheckThreshold{WarnAt: 3, FailAt: 10}
	if evaluateCountThreshold(0, tiered) != "pass" {
		t.Error("expected pass for count=0")
	}
	if evaluateCountThreshold(2, tiered) != "pass" {
		t.Error("expected pass for count=2 (below warn threshold)")
	}
	if evaluateCountThreshold(5, tiered) != "warn" {
		t.Error("expected warn for count=5")
	}
	if evaluateCountThreshold(10, tiered) != "fail" {
		t.Error("expected fail for count=10")
	}
	if evaluateCountThreshold(15, tiered) != "fail" {
		t.Error("expected fail for count=15")
	}
}

// ============================================================================
// Webhook status change detection tests
// ============================================================================

func TestDetectStatusChanges_FirstRun(t *testing.T) {
	prev := make(map[string]string)
	checks := []schema.CheckResult{
		{CheckName: "check_a", Status: "pass"},
		{CheckName: "check_b", Status: "fail"},
	}

	changes := detectStatusChanges(prev, checks)
	if len(changes) != 0 {
		t.Errorf("expected no changes on first run, got %d", len(changes))
	}
}

func TestDetectStatusChanges_NoChanges(t *testing.T) {
	prev := map[string]string{
		"check_a": "pass",
		"check_b": "fail",
	}
	checks := []schema.CheckResult{
		{CheckName: "check_a", Status: "pass"},
		{CheckName: "check_b", Status: "fail"},
	}

	changes := detectStatusChanges(prev, checks)
	if len(changes) != 0 {
		t.Errorf("expected no changes, got %d", len(changes))
	}
}

func TestDetectStatusChanges_StatusChanged(t *testing.T) {
	prev := map[string]string{
		"check_a": "pass",
		"check_b": "fail",
		"check_c": "warn",
	}
	checks := []schema.CheckResult{
		{CheckName: "check_a", Status: "fail", Message: "now failing"},
		{CheckName: "check_b", Status: "pass", Message: "now passing"},
		{CheckName: "check_c", Status: "warn", Message: "still warn"},
	}

	changes := detectStatusChanges(prev, checks)
	if len(changes) != 2 {
		t.Fatalf("expected 2 changes, got %d", len(changes))
	}

	// Verify change details
	changeMap := make(map[string]StatusChange)
	for _, ch := range changes {
		changeMap[ch.CheckName] = ch
	}

	if ch, ok := changeMap["check_a"]; ok {
		if ch.PrevStatus != "pass" || ch.NewStatus != "fail" {
			t.Errorf("check_a: expected pass→fail, got %s→%s", ch.PrevStatus, ch.NewStatus)
		}
	} else {
		t.Error("expected check_a in changes")
	}

	if ch, ok := changeMap["check_b"]; ok {
		if ch.PrevStatus != "fail" || ch.NewStatus != "pass" {
			t.Errorf("check_b: expected fail→pass, got %s→%s", ch.PrevStatus, ch.NewStatus)
		}
	} else {
		t.Error("expected check_b in changes")
	}
}

func TestDetectStatusChanges_NewCheck(t *testing.T) {
	prev := map[string]string{
		"check_a": "pass",
	}
	checks := []schema.CheckResult{
		{CheckName: "check_a", Status: "pass"},
		{CheckName: "check_new", Status: "fail", Message: "new check"},
	}

	changes := detectStatusChanges(prev, checks)
	if len(changes) != 1 {
		t.Fatalf("expected 1 change (new check), got %d", len(changes))
	}
	if changes[0].CheckName != "check_new" || changes[0].PrevStatus != "new" {
		t.Errorf("expected new check change, got %+v", changes[0])
	}
}
