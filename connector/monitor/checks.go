package monitor

import (
	"database/sql"
	"fmt"
	"math"
	"time"

	"github.com/noui/platform/connector/schema"
)

// CheckFunc is the signature for a monitoring check function.
// Each check queries the database and returns a schema.CheckResult with
// auditable evidence of what was found.
type CheckFunc func(db *sql.DB) schema.CheckResult

// AllChecks returns the ordered list of all monitoring check functions,
// using the given adapter for database-specific queries and thresholds
// for configurable pass/warn/fail boundaries.
func AllChecks(adapter MonitorAdapter, th Thresholds) []CheckFunc {
	checks := []CheckFunc{
		func(db *sql.DB) schema.CheckResult { return SalaryGapCheck(db, adapter, th) },
		func(db *sql.DB) schema.CheckResult { return NegativeLeaveBalanceCheck(db, adapter, th) },
		func(db *sql.DB) schema.CheckResult { return MissingTerminationCheck(db, adapter, th) },
		func(db *sql.DB) schema.CheckResult { return MissingPayrollRunCheck(db, adapter, th) },
		func(db *sql.DB) schema.CheckResult { return InvalidHireDateCheck(db, adapter, th) },
		func(db *sql.DB) schema.CheckResult { return ContributionImbalanceCheck(db, adapter, th) },
		func(db *sql.DB) schema.CheckResult { return StalePayrollCheck(db, adapter, th) },
		func(db *sql.DB) schema.CheckResult { return StaleAttendanceCheck(db, adapter, th) },
		// Pension-specific checks — gracefully skip for non-tag-driven adapters
		func(db *sql.DB) schema.CheckResult { return BeneficiaryAllocationCheck(db, adapter, th) },
		func(db *sql.DB) schema.CheckResult { return ServiceCreditOverlapCheck(db, adapter, th) },
		func(db *sql.DB) schema.CheckResult { return DROStatusConsistencyCheck(db, adapter, th) },
	}
	return checks
}

// SalaryGapCheck finds employees with gaps in their monthly salary slip sequence.
//
// Logic: For each employee, collect all salary slip months (YYYY-MM). Walk
// the sequence and flag any gap > 1 month. Fail if any employee has gaps.
//
// Category: completeness
// Evidence: employee name + missing month(s)
func SalaryGapCheck(db *sql.DB, adapter MonitorAdapter, th Thresholds) schema.CheckResult {
	now := time.Now().UTC().Format(time.RFC3339)
	result := schema.CheckResult{
		CheckName: "salary_gap_check",
		Category:  "completeness",
		Timestamp: now,
	}

	rows, err := adapter.QuerySalarySlipMonths(db)
	if err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("query error: %v", err)
		return result
	}
	defer rows.Close()

	// Build per-employee month lists
	type monthKey struct {
		year  int
		month int
	}
	empMonths := make(map[string][]monthKey)
	for rows.Next() {
		var name string
		var yr, mo int
		if err := rows.Scan(&name, &yr, &mo); err != nil {
			result.Status = "fail"
			result.Message = fmt.Sprintf("scan error: %v", err)
			return result
		}
		empMonths[name] = append(empMonths[name], monthKey{yr, mo})
	}
	if err := rows.Err(); err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("rows error: %v", err)
		return result
	}

	// Find gaps
	var details []string
	gapCount := 0
	for emp, months := range empMonths {
		if len(months) < 2 {
			continue
		}
		for i := 1; i < len(months); i++ {
			prev := months[i-1]
			curr := months[i]
			// Calculate expected next month
			expectedYear := prev.year
			expectedMonth := prev.month + 1
			if expectedMonth > 12 {
				expectedMonth = 1
				expectedYear++
			}
			if curr.year != expectedYear || curr.month != expectedMonth {
				gap := fmt.Sprintf("%s: gap between %d-%02d and %d-%02d",
					emp, prev.year, prev.month, curr.year, curr.month)
				details = append(details, gap)
				gapCount++
			}
		}
	}

	result.Expected = 0
	result.Actual = float64(gapCount)
	result.Details = details

	result.Status = evaluateCountThreshold(gapCount, th.SalaryGap)
	if gapCount > 0 {
		result.Message = fmt.Sprintf("found %d salary slip gap(s) across employees", gapCount)
		result.Deviation = 100.0
	} else {
		result.Message = "no salary slip gaps detected"
	}

	return result
}

// NegativeLeaveBalanceCheck finds leave allocations with negative total_leaves_allocated.
//
// Category: validity
// Evidence: employee name + negative amount
func NegativeLeaveBalanceCheck(db *sql.DB, adapter MonitorAdapter, th Thresholds) schema.CheckResult {
	now := time.Now().UTC().Format(time.RFC3339)
	result := schema.CheckResult{
		CheckName: "negative_leave_balance_check",
		Category:  "validity",
		Timestamp: now,
	}

	rows, err := adapter.QueryNegativeLeaveBalances(db)
	if err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("query error: %v", err)
		return result
	}
	defer rows.Close()

	var details []string
	count := 0
	for rows.Next() {
		var name, leaveType string
		var amount float64
		if err := rows.Scan(&name, &leaveType, &amount); err != nil {
			result.Status = "fail"
			result.Message = fmt.Sprintf("scan error: %v", err)
			return result
		}
		details = append(details, fmt.Sprintf("%s: %s = %.2f", name, leaveType, amount))
		count++
	}
	if err := rows.Err(); err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("rows error: %v", err)
		return result
	}

	result.Expected = 0
	result.Actual = float64(count)
	result.Details = details

	result.Status = evaluateCountThreshold(count, th.NegativeLeaveBalance)
	if count > 0 {
		result.Message = fmt.Sprintf("found %d leave allocation(s) with negative balance", count)
		result.Deviation = 100.0
	} else {
		result.Message = "no negative leave balances found"
	}

	return result
}

// MissingTerminationCheck finds employees with status='Left' but no Employee Separation record.
//
// Category: completeness
// Evidence: employee IDs missing separation records
func MissingTerminationCheck(db *sql.DB, adapter MonitorAdapter, th Thresholds) schema.CheckResult {
	now := time.Now().UTC().Format(time.RFC3339)
	result := schema.CheckResult{
		CheckName: "missing_termination_check",
		Category:  "completeness",
		Timestamp: now,
	}

	rows, err := adapter.QueryMissingTerminations(db)
	if err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("query error: %v", err)
		return result
	}
	defer rows.Close()

	var details []string
	count := 0
	for rows.Next() {
		var empID, empName string
		if err := rows.Scan(&empID, &empName); err != nil {
			result.Status = "fail"
			result.Message = fmt.Sprintf("scan error: %v", err)
			return result
		}
		details = append(details, fmt.Sprintf("%s (%s): status=Left, no Employee Separation record", empID, empName))
		count++
	}
	if err := rows.Err(); err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("rows error: %v", err)
		return result
	}

	result.Expected = 0
	result.Actual = float64(count)
	result.Details = details

	result.Status = evaluateCountThreshold(count, th.MissingTermination)
	if count > 0 {
		result.Message = fmt.Sprintf("found %d employee(s) with status=Left but no separation record", count)
		result.Deviation = 100.0
	} else {
		result.Message = "all terminated employees have separation records"
	}

	return result
}

// MissingPayrollRunCheck finds months where salary slips exist but no Payroll Entry.
//
// Category: completeness
// Evidence: months with salary slips but no payroll entry
func MissingPayrollRunCheck(db *sql.DB, adapter MonitorAdapter, th Thresholds) schema.CheckResult {
	now := time.Now().UTC().Format(time.RFC3339)
	result := schema.CheckResult{
		CheckName: "missing_payroll_run_check",
		Category:  "completeness",
		Timestamp: now,
	}

	rows, err := adapter.QueryMissingPayrollRuns(db)
	if err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("query error: %v", err)
		return result
	}
	defer rows.Close()

	var details []string
	count := 0
	for rows.Next() {
		var yr, mo int
		if err := rows.Scan(&yr, &mo); err != nil {
			result.Status = "fail"
			result.Message = fmt.Sprintf("scan error: %v", err)
			return result
		}
		details = append(details, fmt.Sprintf("%d-%02d: salary slips exist but no Payroll Entry", yr, mo))
		count++
	}
	if err := rows.Err(); err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("rows error: %v", err)
		return result
	}

	result.Expected = 0
	result.Actual = float64(count)
	result.Details = details

	result.Status = evaluateCountThreshold(count, th.MissingPayrollRun)
	if count > 0 {
		result.Message = fmt.Sprintf("found %d month(s) with salary slips but no payroll entry", count)
		result.Deviation = 100.0
	} else {
		result.Message = "all months with salary slips have corresponding payroll entries"
	}

	return result
}

// InvalidHireDateCheck finds employees with date_of_joining in the future.
//
// Category: validity
// Evidence: employee IDs and future dates
func InvalidHireDateCheck(db *sql.DB, adapter MonitorAdapter, th Thresholds) schema.CheckResult {
	now := time.Now().UTC().Format(time.RFC3339)
	result := schema.CheckResult{
		CheckName: "invalid_hire_date_check",
		Category:  "validity",
		Timestamp: now,
	}

	rows, err := adapter.QueryFutureHireDates(db)
	if err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("query error: %v", err)
		return result
	}
	defer rows.Close()

	var details []string
	count := 0
	for rows.Next() {
		var empID, empName, dateStr string
		if err := rows.Scan(&empID, &empName, &dateStr); err != nil {
			result.Status = "fail"
			result.Message = fmt.Sprintf("scan error: %v", err)
			return result
		}
		details = append(details, fmt.Sprintf("%s (%s): date_of_joining=%s (future)", empID, empName, dateStr))
		count++
	}
	if err := rows.Err(); err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("rows error: %v", err)
		return result
	}

	result.Expected = 0
	result.Actual = float64(count)
	result.Details = details

	result.Status = evaluateCountThreshold(count, th.InvalidHireDate)
	if count > 0 {
		result.Message = fmt.Sprintf("found %d employee(s) with future hire dates", count)
		result.Deviation = 100.0
	} else {
		result.Message = "no employees with future hire dates"
	}

	return result
}

// ContributionImbalanceCheck finds employees where salary slip gross_pay deviates
// from their salary structure assignment base amount.
//
// Logic: JOIN salary slips with the most recent salary structure assignment for
// each employee. Compare gross_pay to the base amount. Warn if deviation is 5-10%,
// fail if >10%.
//
// Category: consistency
// Evidence: employee IDs, expected base, actual gross, deviation percentage
func ContributionImbalanceCheck(db *sql.DB, adapter MonitorAdapter, th Thresholds) schema.CheckResult {
	now := time.Now().UTC().Format(time.RFC3339)
	result := schema.CheckResult{
		CheckName: "contribution_imbalance_check",
		Category:  "consistency",
		Timestamp: now,
	}

	rows, err := adapter.QueryContributionImbalances(db)
	if err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("query error: %v", err)
		return result
	}
	defer rows.Close()

	var details []string
	warnCount := 0
	failCount := 0
	for rows.Next() {
		var empName, slipName string
		var grossPay, expectedBase, devPct float64
		if err := rows.Scan(&empName, &slipName, &grossPay, &expectedBase, &devPct); err != nil {
			result.Status = "fail"
			result.Message = fmt.Sprintf("scan error: %v", err)
			return result
		}
		devPct = round2(devPct)
		severity := "WARN"
		if devPct > th.ContributionFailPct {
			severity = "FAIL"
			failCount++
		} else {
			warnCount++
		}
		details = append(details, fmt.Sprintf("[%s] %s (slip %s): expected=%.2f actual=%.2f deviation=%.2f%%",
			severity, empName, slipName, expectedBase, grossPay, devPct))
	}
	if err := rows.Err(); err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("rows error: %v", err)
		return result
	}

	totalIssues := warnCount + failCount
	result.Expected = 0
	result.Actual = float64(totalIssues)
	result.Details = details

	if totalIssues > 0 {
		if failCount > 0 {
			result.Status = "fail"
			result.Message = fmt.Sprintf("found %d slip(s) with >10%% deviation, %d with 5-10%% deviation from salary structure base",
				failCount, warnCount)
		} else {
			result.Status = "warn"
			result.Message = fmt.Sprintf("found %d slip(s) with 5-10%% deviation from salary structure base", warnCount)
		}
		result.Deviation = round2(math.Max(float64(failCount), float64(warnCount)) / math.Max(result.Actual, 1) * 100)
	} else {
		result.Status = "pass"
		result.Message = "all salary slips are within 5% of salary structure base"
		result.Deviation = 0
	}

	return result
}

// StalePayrollCheck detects if salary slip processing has fallen behind.
// Compares the most recent salary slip start_date to the current date.
// If the latest slip is > 2 months behind the current month: FAIL.
// If > 1 month behind: WARN. Otherwise: PASS.
//
// Category: timeliness
// Evidence: latest salary slip date and days since
func StalePayrollCheck(db *sql.DB, adapter MonitorAdapter, th Thresholds) schema.CheckResult {
	now := time.Now().UTC()
	result := schema.CheckResult{
		CheckName: "stale_payroll_check",
		Category:  "timeliness",
		Timestamp: now.Format(time.RFC3339),
	}

	rows, err := adapter.QueryLatestSalarySlipDate(db)
	if err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("query error: %v", err)
		return result
	}
	defer rows.Close()

	if !rows.Next() {
		result.Status = "fail"
		result.Message = "no salary slips found"
		return result
	}

	var latestDateStr sql.NullString
	if err := rows.Scan(&latestDateStr); err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("scan error: %v", err)
		return result
	}
	if err := rows.Err(); err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("rows error: %v", err)
		return result
	}

	if !latestDateStr.Valid || latestDateStr.String == "" {
		result.Status = "fail"
		result.Message = "no salary slips with valid dates found"
		return result
	}

	latestDate, err := time.Parse("2006-01-02", latestDateStr.String)
	if err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("date parse error: %v", err)
		return result
	}

	daysSince := int(now.Sub(latestDate).Hours() / 24)
	// Calculate month difference
	monthsSince := (now.Year()-latestDate.Year())*12 + int(now.Month()) - int(latestDate.Month())

	result.Expected = 0 // 0 months behind is the ideal
	result.Actual = float64(monthsSince)
	result.Details = []string{
		fmt.Sprintf("latest salary slip date: %s", latestDateStr.String),
		fmt.Sprintf("days since latest: %d", daysSince),
		fmt.Sprintf("months behind: %d", monthsSince),
	}

	if monthsSince > th.StalePayrollFailMonths {
		result.Status = "fail"
		result.Message = fmt.Sprintf("payroll processing is %d months behind (latest: %s)", monthsSince, latestDateStr.String)
		result.Deviation = float64(monthsSince)
	} else if monthsSince > th.StalePayrollWarnMonths {
		result.Status = "warn"
		result.Message = fmt.Sprintf("payroll processing is %d months behind (latest: %s)", monthsSince, latestDateStr.String)
		result.Deviation = float64(monthsSince)
	} else {
		result.Status = "pass"
		result.Message = fmt.Sprintf("payroll processing is current (latest: %s)", latestDateStr.String)
		result.Deviation = 0
	}

	return result
}

// StaleAttendanceCheck detects if attendance recording has gone stale.
// Compares the most recent attendance date to the current date.
// If > 30 days old: FAIL. If > 7 days old: WARN. Otherwise: PASS.
//
// Category: timeliness
// Evidence: latest attendance date and days since
func StaleAttendanceCheck(db *sql.DB, adapter MonitorAdapter, th Thresholds) schema.CheckResult {
	now := time.Now().UTC()
	result := schema.CheckResult{
		CheckName: "stale_attendance_check",
		Category:  "timeliness",
		Timestamp: now.Format(time.RFC3339),
	}

	rows, err := adapter.QueryLatestAttendanceDate(db)
	if err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("query error: %v", err)
		return result
	}
	defer rows.Close()

	if !rows.Next() {
		result.Status = "fail"
		result.Message = "no attendance records found"
		return result
	}

	var latestDateStr sql.NullString
	if err := rows.Scan(&latestDateStr); err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("scan error: %v", err)
		return result
	}
	if err := rows.Err(); err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("rows error: %v", err)
		return result
	}

	if !latestDateStr.Valid || latestDateStr.String == "" {
		result.Status = "fail"
		result.Message = "no attendance records with valid dates found"
		return result
	}

	latestDate, err := time.Parse("2006-01-02", latestDateStr.String)
	if err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("date parse error: %v", err)
		return result
	}

	daysSince := int(now.Sub(latestDate).Hours() / 24)

	result.Expected = 0 // 0 days behind is the ideal
	result.Actual = float64(daysSince)
	result.Details = []string{
		fmt.Sprintf("latest attendance date: %s", latestDateStr.String),
		fmt.Sprintf("days since latest: %d", daysSince),
	}

	if daysSince > th.StaleAttendFailDays {
		result.Status = "fail"
		result.Message = fmt.Sprintf("attendance recording is %d days stale (latest: %s)", daysSince, latestDateStr.String)
		result.Deviation = float64(daysSince)
	} else if daysSince > th.StaleAttendWarnDays {
		result.Status = "warn"
		result.Message = fmt.Sprintf("attendance recording is %d days behind (latest: %s)", daysSince, latestDateStr.String)
		result.Deviation = float64(daysSince)
	} else {
		result.Status = "pass"
		result.Message = fmt.Sprintf("attendance recording is current (latest: %s)", latestDateStr.String)
		result.Deviation = 0
	}

	return result
}

// ============================================================================
// Pension-specific checks (require TagDrivenAdapter)
// ============================================================================

// BeneficiaryAllocationCheck verifies that each member's beneficiary allocation
// percentages sum to exactly 100%.
//
// Category: consistency
// Evidence: member IDs and their total allocation percentages
func BeneficiaryAllocationCheck(db *sql.DB, adapter MonitorAdapter, th Thresholds) schema.CheckResult {
	now := time.Now().UTC().Format(time.RFC3339)
	result := schema.CheckResult{
		CheckName: "beneficiary_allocation_check",
		Category:  "consistency",
		Timestamp: now,
	}

	tda, ok := adapter.(*TagDrivenAdapter)
	if !ok {
		result.Status = "pass"
		result.Message = "skipped: requires tag-driven adapter"
		return result
	}

	if !tda.Resolver.HasTag("beneficiary-designation") {
		result.Status = "pass"
		result.Message = "skipped: beneficiary-designation concept not found in manifest"
		return result
	}

	rows, err := tda.QueryBeneficiaryAllocations(db)
	if err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("query error: %v", err)
		return result
	}
	defer rows.Close()

	var details []string
	count := 0
	for rows.Next() {
		var memberID interface{}
		var totalPct float64
		if err := rows.Scan(&memberID, &totalPct); err != nil {
			result.Status = "fail"
			result.Message = fmt.Sprintf("scan error: %v", err)
			return result
		}
		details = append(details, fmt.Sprintf("member %v: beneficiary allocation = %.1f%% (expected 100%%)", memberID, totalPct))
		count++
	}
	if err := rows.Err(); err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("rows error: %v", err)
		return result
	}

	result.Expected = 0
	result.Actual = float64(count)
	result.Details = details

	result.Status = evaluateCountThreshold(count, th.BeneficiaryAllocation)
	if count > 0 {
		result.Message = fmt.Sprintf("found %d member(s) with beneficiary allocations not summing to 100%%", count)
		result.Deviation = 100.0
	} else {
		result.Message = "all beneficiary allocations sum to 100%"
	}

	return result
}

// ServiceCreditOverlapCheck detects overlapping date ranges in service credit periods.
//
// Category: validity
// Evidence: member IDs and overlapping date ranges
func ServiceCreditOverlapCheck(db *sql.DB, adapter MonitorAdapter, th Thresholds) schema.CheckResult {
	now := time.Now().UTC().Format(time.RFC3339)
	result := schema.CheckResult{
		CheckName: "service_credit_overlap_check",
		Category:  "validity",
		Timestamp: now,
	}

	tda, ok := adapter.(*TagDrivenAdapter)
	if !ok {
		result.Status = "pass"
		result.Message = "skipped: requires tag-driven adapter"
		return result
	}

	if !tda.Resolver.HasTag("service-credit") {
		result.Status = "pass"
		result.Message = "skipped: service-credit concept not found in manifest"
		return result
	}

	rows, err := tda.QueryServiceCreditOverlaps(db)
	if err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("query error: %v", err)
		return result
	}
	defer rows.Close()

	var details []string
	count := 0
	for rows.Next() {
		var memberID interface{}
		var begin1, end1, begin2, end2 string
		if err := rows.Scan(&memberID, &begin1, &end1, &begin2, &end2); err != nil {
			result.Status = "fail"
			result.Message = fmt.Sprintf("scan error: %v", err)
			return result
		}
		details = append(details, fmt.Sprintf("member %v: overlapping service credit [%s..%s] and [%s..%s]",
			memberID, begin1, end1, begin2, end2))
		count++
	}
	if err := rows.Err(); err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("rows error: %v", err)
		return result
	}

	result.Expected = 0
	result.Actual = float64(count)
	result.Details = details

	result.Status = evaluateCountThreshold(count, th.ServiceCreditOverlap)
	if count > 0 {
		result.Message = fmt.Sprintf("found %d overlapping service credit period(s)", count)
		result.Deviation = 100.0
	} else {
		result.Message = "no overlapping service credit periods found"
	}

	return result
}

// DROStatusConsistencyCheck detects DROs with active status but no corresponding
// benefit payment record.
//
// Category: consistency
// Evidence: member IDs and DRO status
func DROStatusConsistencyCheck(db *sql.DB, adapter MonitorAdapter, th Thresholds) schema.CheckResult {
	now := time.Now().UTC().Format(time.RFC3339)
	result := schema.CheckResult{
		CheckName: "dro_status_consistency_check",
		Category:  "consistency",
		Timestamp: now,
	}

	tda, ok := adapter.(*TagDrivenAdapter)
	if !ok {
		result.Status = "pass"
		result.Message = "skipped: requires tag-driven adapter"
		return result
	}

	if !tda.Resolver.HasTag("domestic-relations-order") || !tda.Resolver.HasTag("benefit-payment") {
		result.Status = "pass"
		result.Message = "skipped: domestic-relations-order or benefit-payment concept not found in manifest"
		return result
	}

	rows, err := tda.QueryDROStatusInconsistencies(db)
	if err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("query error: %v", err)
		return result
	}
	defer rows.Close()

	var details []string
	count := 0
	for rows.Next() {
		var memberID interface{}
		var status string
		if err := rows.Scan(&memberID, &status); err != nil {
			result.Status = "fail"
			result.Message = fmt.Sprintf("scan error: %v", err)
			return result
		}
		details = append(details, fmt.Sprintf("member %v: DRO status=%s but no benefit payment with DRO deduction", memberID, status))
		count++
	}
	if err := rows.Err(); err != nil {
		result.Status = "fail"
		result.Message = fmt.Sprintf("rows error: %v", err)
		return result
	}

	result.Expected = 0
	result.Actual = float64(count)
	result.Details = details

	result.Status = evaluateCountThreshold(count, th.DROStatusConsistency)
	if count > 0 {
		result.Message = fmt.Sprintf("found %d DRO(s) with active status but no corresponding benefit payment", count)
		result.Deviation = 100.0
	} else {
		result.Message = "all active DROs have corresponding benefit payments"
	}

	return result
}
