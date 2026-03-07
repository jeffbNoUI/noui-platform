package monitor

import (
	"database/sql"
	"fmt"
	"math"

	"github.com/noui/platform/connector/schema"
)

// round2 rounds a float64 to 2 decimal places.
func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

// ComputeBaselines queries the database via the adapter and establishes
// statistical baselines for key HR/payroll metrics. All numeric outputs
// are rounded to 2 decimal places.
func ComputeBaselines(db *sql.DB, adapter MonitorAdapter) ([]schema.Baseline, error) {
	type baselineQuery struct {
		name    string
		queryFn func(*sql.DB) (*sql.Rows, error)
	}

	queries := []baselineQuery{
		{"monthly_employee_count", adapter.QueryMonthlyEmployeeCount},
		{"monthly_gross_total", adapter.QueryMonthlyGrossTotal},
		{"monthly_avg_gross", adapter.QueryMonthlyAvgGross},
		{"avg_leave_allocation", adapter.QueryAvgLeaveAllocation},
		{"monthly_payroll_runs", adapter.QueryMonthlyPayrollRuns},
	}

	var baselines []schema.Baseline
	for _, q := range queries {
		rows, err := q.queryFn(db)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", q.name, err)
		}
		values, err := scanFloatRows(rows)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", q.name, err)
		}
		baselines = append(baselines, computeStats(q.name, values))
	}

	return baselines, nil
}

// scanFloatRows reads all rows from a result set, extracting the first column
// as float64. Closes the rows when done.
func scanFloatRows(rows *sql.Rows) ([]float64, error) {
	defer rows.Close()
	var values []float64
	for rows.Next() {
		var v float64
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		values = append(values, v)
	}
	return values, rows.Err()
}

// computeStats calculates mean, standard deviation, min, max from a slice of values.
// All outputs are rounded to 2 decimal places.
func computeStats(name string, values []float64) schema.Baseline {
	b := schema.Baseline{
		MetricName: name,
		SampleSize: len(values),
	}

	if len(values) == 0 {
		return b
	}

	// Mean
	var sum float64
	for _, v := range values {
		sum += v
	}
	mean := sum / float64(len(values))
	b.Mean = round2(mean)

	// Min / Max
	minVal := values[0]
	maxVal := values[0]
	for _, v := range values[1:] {
		if v < minVal {
			minVal = v
		}
		if v > maxVal {
			maxVal = v
		}
	}
	b.Min = round2(minVal)
	b.Max = round2(maxVal)

	// Standard deviation (population)
	if len(values) > 1 {
		var sumSqDiff float64
		for _, v := range values {
			diff := v - mean
			sumSqDiff += diff * diff
		}
		b.StdDev = round2(math.Sqrt(sumSqDiff / float64(len(values))))
	}

	return b
}
