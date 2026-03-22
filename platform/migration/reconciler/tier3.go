package reconciler

import (
	"database/sql"
	"fmt"
	"math"
	"math/big"
	"time"
)

// PlanBenchmarks holds plan-level aggregate benchmarks for Tier 3 validation.
type PlanBenchmarks struct {
	AvgSalaryByYear     map[int]float64 // year -> expected avg salary
	TotalContributions  float64
	MemberCountByStatus map[string]int
}

// tier3 SQL queries — one per check, all parameterized by batch_id.
const (
	tier3SalaryQuery = `SELECT member_id, salary_year, salary_amount FROM migration.canonical_salaries WHERE batch_id = $1 ORDER BY salary_year, member_id`

	tier3ContributionQuery = `SELECT COALESCE(SUM(contribution_amount), 0)::TEXT FROM migration.canonical_contributions WHERE batch_id = $1`

	tier3ServiceCreditQuery = `SELECT member_id, service_credit_years, employment_start, employment_end FROM migration.canonical_members WHERE batch_id = $1`

	tier3StatusCountQuery = `SELECT member_status, COUNT(*) FROM migration.canonical_members WHERE batch_id = $1 GROUP BY member_status`
)

// stddevOutlierThreshold is the number of standard deviations beyond which a
// member's salary is flagged as an outlier.
const stddevOutlierThreshold = 2.0

// serviceDiscrepancyThreshold is the maximum acceptable percentage discrepancy
// between service credit years and employment span before a member is flagged.
const serviceDiscrepancyThreshold = 0.10

// ReconcileTier3 performs Tier 3 (aggregate) reconciliation for a batch,
// comparing plan-level statistics against provided benchmarks and flagging
// individual outlier members.
func ReconcileTier3(db *sql.DB, batchID string, benchmarks PlanBenchmarks) ([]ReconciliationResult, error) {
	var results []ReconciliationResult

	// Check 1: Salary outlier detection by year
	salaryResults, err := checkSalaryOutliers(db, batchID, benchmarks)
	if err != nil {
		return nil, fmt.Errorf("reconciler: tier3 salary check failed: %w", err)
	}
	results = append(results, salaryResults...)

	// Check 2: Total contribution balance
	contribResults, err := checkContributionTotal(db, batchID, benchmarks)
	if err != nil {
		return nil, fmt.Errorf("reconciler: tier3 contribution check failed: %w", err)
	}
	results = append(results, contribResults...)

	// Check 3: Service credit vs employment span
	serviceResults, err := checkServiceCreditSpan(db, batchID)
	if err != nil {
		return nil, fmt.Errorf("reconciler: tier3 service credit check failed: %w", err)
	}
	results = append(results, serviceResults...)

	// Check 4: Member count by status
	statusResults, err := checkMemberStatusCounts(db, batchID, benchmarks)
	if err != nil {
		return nil, fmt.Errorf("reconciler: tier3 status count check failed: %w", err)
	}
	results = append(results, statusResults...)

	return results, nil
}

// memberSalary pairs a member ID with a salary amount for statistical analysis.
type memberSalary struct {
	memberID string
	amount   float64
}

// checkSalaryOutliers queries salary data, computes mean and standard deviation
// per year, and flags members whose salary is >2σ from the mean.
func checkSalaryOutliers(db *sql.DB, batchID string, benchmarks PlanBenchmarks) ([]ReconciliationResult, error) {
	rows, err := db.Query(tier3SalaryQuery, batchID)
	if err != nil {
		return nil, fmt.Errorf("salary query failed: %w", err)
	}
	defer rows.Close()

	// Group salaries by year
	byYear := make(map[int][]memberSalary)

	for rows.Next() {
		var memberID string
		var year int
		var amount float64
		if err := rows.Scan(&memberID, &year, &amount); err != nil {
			return nil, fmt.Errorf("salary scan failed: %w", err)
		}
		byYear[year] = append(byYear[year], memberSalary{
			memberID: memberID,
			amount:   amount,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("salary rows iteration error: %w", err)
	}

	var results []ReconciliationResult

	// For each year in benchmarks, compute stats and flag outliers.
	// The benchmark map keys gate which years are checked; the outlier threshold
	// is computed from the batch data itself (peer-based detection).
	for year := range benchmarks.AvgSalaryByYear {
		salaries, ok := byYear[year]
		if !ok || len(salaries) == 0 {
			continue
		}

		mean, stddev := computeMeanStddev(salaries)

		// Flag members >2σ from mean
		for _, s := range salaries {
			if stddev == 0 {
				continue // all identical — no outliers possible
			}
			devsFromMean := math.Abs(s.amount-mean) / stddev
			if devsFromMean > stddevOutlierThreshold {
				diff := new(big.Rat).SetFloat64(s.amount - mean)
				category := ClassifyVariance(diff)

				results = append(results, ReconciliationResult{
					MemberID:        s.memberID,
					BatchID:         batchID,
					Tier:            Tier3Aggregate,
					Category:        category,
					SuspectedDomain: "SALARY",
					Details:         fmt.Sprintf("salary %.2f is %.1f std devs from mean %.2f in year %d", s.amount, devsFromMean, mean, year),
				})
			}
		}
	}

	return results, nil
}

// computeMeanStddev computes population mean and standard deviation for a slice
// of member salaries. Uses float64 since this is statistical, not monetary.
func computeMeanStddev(salaries []memberSalary) (mean, stddev float64) {
	n := float64(len(salaries))
	if n == 0 {
		return 0, 0
	}

	var sum float64
	for _, s := range salaries {
		sum += s.amount
	}
	mean = sum / n

	var varianceSum float64
	for _, s := range salaries {
		diff := s.amount - mean
		varianceSum += diff * diff
	}
	stddev = math.Sqrt(varianceSum / n)

	return mean, stddev
}

// checkContributionTotal compares the sum of contributions in canonical against
// the benchmark total. If mismatch > $0.01, produces an AGGREGATE result.
func checkContributionTotal(db *sql.DB, batchID string, benchmarks PlanBenchmarks) ([]ReconciliationResult, error) {
	var totalStr string
	err := db.QueryRow(tier3ContributionQuery, batchID).Scan(&totalStr)
	if err != nil {
		return nil, fmt.Errorf("contribution query failed: %w", err)
	}

	actual := new(big.Rat)
	if _, ok := actual.SetString(totalStr); !ok {
		return nil, fmt.Errorf("invalid contribution total %q", totalStr)
	}

	expected := new(big.Rat).SetFloat64(benchmarks.TotalContributions)
	diff := new(big.Rat).Sub(actual, expected)
	absDiff := new(big.Rat).Abs(diff)

	// threshold: $0.01
	threshold := new(big.Rat).SetFrac64(1, 100)

	if absDiff.Cmp(threshold) > 0 {
		category := ClassifyVariance(diff)
		return []ReconciliationResult{{
			MemberID:        "AGGREGATE",
			BatchID:         batchID,
			Tier:            Tier3Aggregate,
			SourceValue:     RoundHalfUp(expected),
			CanonicalValue:  RoundHalfUp(actual),
			VarianceAmount:  RoundHalfUp(absDiff),
			Category:        category,
			SuspectedDomain: "CONTRIBUTION",
			Details:         fmt.Sprintf("total contributions %s vs benchmark %s", RoundHalfUp(actual), RoundHalfUp(expected)),
		}}, nil
	}

	return nil, nil
}

// serviceCreditRow represents a member's service credit and employment dates.
type serviceCreditRow struct {
	MemberID      string
	ServiceCredit float64
	EmployStart   time.Time
	EmployEnd     time.Time
}

// checkServiceCreditSpan compares each member's service_credit_years against
// their employment span (end - start). Flags members with >10% discrepancy.
func checkServiceCreditSpan(db *sql.DB, batchID string) ([]ReconciliationResult, error) {
	rows, err := db.Query(tier3ServiceCreditQuery, batchID)
	if err != nil {
		return nil, fmt.Errorf("service credit query failed: %w", err)
	}
	defer rows.Close()

	var results []ReconciliationResult

	for rows.Next() {
		var r serviceCreditRow
		if err := rows.Scan(&r.MemberID, &r.ServiceCredit, &r.EmployStart, &r.EmployEnd); err != nil {
			return nil, fmt.Errorf("service credit scan failed: %w", err)
		}

		// Compute employment span in years
		spanYears := r.EmployEnd.Sub(r.EmployStart).Hours() / (365.25 * 24)
		if spanYears <= 0 {
			continue // skip invalid or zero-span records
		}

		// Compute discrepancy percentage
		discrepancy := math.Abs(r.ServiceCredit-spanYears) / spanYears
		if discrepancy > serviceDiscrepancyThreshold {
			diff := new(big.Rat).SetFloat64(r.ServiceCredit - spanYears)
			category := ClassifyVariance(diff)

			results = append(results, ReconciliationResult{
				MemberID:        r.MemberID,
				BatchID:         batchID,
				Tier:            Tier3Aggregate,
				Category:        category,
				SuspectedDomain: "SERVICE_CREDIT",
				Details:         fmt.Sprintf("service credit %.2f years vs employment span %.2f years (%.0f%% discrepancy)", r.ServiceCredit, spanYears, discrepancy*100),
			})
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("service credit rows iteration error: %w", err)
	}

	return results, nil
}

// checkMemberStatusCounts compares canonical member counts by status against
// benchmark expectations. Produces an AGGREGATE result if any status mismatches.
func checkMemberStatusCounts(db *sql.DB, batchID string, benchmarks PlanBenchmarks) ([]ReconciliationResult, error) {
	if len(benchmarks.MemberCountByStatus) == 0 {
		return nil, nil
	}

	rows, err := db.Query(tier3StatusCountQuery, batchID)
	if err != nil {
		return nil, fmt.Errorf("status count query failed: %w", err)
	}
	defer rows.Close()

	actual := make(map[string]int)
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, fmt.Errorf("status count scan failed: %w", err)
		}
		actual[status] = count
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("status count rows iteration error: %w", err)
	}

	// Compare each expected status count
	var mismatches []string
	for status, expectedCount := range benchmarks.MemberCountByStatus {
		actualCount := actual[status]
		if actualCount != expectedCount {
			mismatches = append(mismatches, fmt.Sprintf("%s: expected %d, got %d", status, expectedCount, actualCount))
		}
	}

	if len(mismatches) > 0 {
		details := "member count mismatches: "
		for i, m := range mismatches {
			if i > 0 {
				details += "; "
			}
			details += m
		}

		return []ReconciliationResult{{
			MemberID:        "AGGREGATE",
			BatchID:         batchID,
			Tier:            Tier3Aggregate,
			Category:        CategoryMajor,
			SuspectedDomain: "MEMBER_COUNT",
			Details:         details,
		}}, nil
	}

	return nil, nil
}
