package monitor

import "database/sql"

// MonitorAdapter provides database-specific query implementations for
// monitoring baselines and checks. Per CLAUDE.md: "Connector DB adapter
// must be swappable per target — no MariaDB-specific code in core
// connector logic."
type MonitorAdapter interface {
	// --- Baseline queries ---
	// Each returns rows with a single float64 column.

	QueryMonthlyEmployeeCount(db *sql.DB) (*sql.Rows, error)
	QueryMonthlyGrossTotal(db *sql.DB) (*sql.Rows, error)
	QueryMonthlyAvgGross(db *sql.DB) (*sql.Rows, error)
	QueryAvgLeaveAllocation(db *sql.DB) (*sql.Rows, error)
	QueryMonthlyPayrollRuns(db *sql.DB) (*sql.Rows, error)

	// --- Check queries ---

	// QuerySalarySlipMonths returns (employee_name, year, month) rows ordered by employee + date.
	QuerySalarySlipMonths(db *sql.DB) (*sql.Rows, error)

	// QueryNegativeLeaveBalances returns (employee_name, leave_type, total_leaves_allocated)
	// where total_leaves_allocated < 0.
	QueryNegativeLeaveBalances(db *sql.DB) (*sql.Rows, error)

	// QueryMissingTerminations returns (employee_id, employee_name) for employees
	// with status='Left' but no separation record.
	QueryMissingTerminations(db *sql.DB) (*sql.Rows, error)

	// QueryMissingPayrollRuns returns (year, month) for months with salary slips
	// but no payroll entry.
	QueryMissingPayrollRuns(db *sql.DB) (*sql.Rows, error)

	// QueryFutureHireDates returns (employee_id, employee_name, date_of_joining)
	// for employees with date_of_joining in the future.
	QueryFutureHireDates(db *sql.DB) (*sql.Rows, error)

	// QueryContributionImbalances returns (employee_name, slip_name, gross_pay,
	// expected_base, deviation_pct) for slips with >5% deviation from salary structure base.
	QueryContributionImbalances(db *sql.DB) (*sql.Rows, error)

	// --- Timeliness queries ---

	// QueryLatestSalarySlipDate returns a single row with the most recent salary slip
	// start_date as a string (YYYY-MM-DD format).
	QueryLatestSalarySlipDate(db *sql.DB) (*sql.Rows, error)

	// QueryLatestAttendanceDate returns a single row with the most recent attendance
	// date as a string (YYYY-MM-DD format).
	QueryLatestAttendanceDate(db *sql.DB) (*sql.Rows, error)
}

// NewMonitorAdapter returns the appropriate MonitorAdapter for the given driver.
func NewMonitorAdapter(driver string) MonitorAdapter {
	switch driver {
	case "postgres":
		return &PostgresMonitorAdapter{}
	case "mssql":
		return &MSSQLMonitorAdapter{}
	default:
		return &MySQLMonitorAdapter{}
	}
}
