package monitor

import "database/sql"

// PostgresMonitorAdapter implements MonitorAdapter for PostgreSQL databases.
// Translates MySQL-specific syntax:
//   - YEAR(col)    → EXTRACT(YEAR FROM col)::int
//   - MONTH(col)   → EXTRACT(MONTH FROM col)::int
//   - CURDATE()    → CURRENT_DATE
//   - `tabName`    → "tabName" (identifier quoting)
type PostgresMonitorAdapter struct{}

// --- Baseline queries ---

func (a *PostgresMonitorAdapter) QueryMonthlyEmployeeCount(db *sql.DB) (*sql.Rows, error) {
	return db.Query(`
		SELECT COUNT(*) AS slip_count
		FROM "tabSalary Slip"
		WHERE docstatus = 1
		GROUP BY EXTRACT(YEAR FROM start_date)::int, EXTRACT(MONTH FROM start_date)::int
		ORDER BY EXTRACT(YEAR FROM start_date)::int, EXTRACT(MONTH FROM start_date)::int
	`)
}

func (a *PostgresMonitorAdapter) QueryMonthlyGrossTotal(db *sql.DB) (*sql.Rows, error) {
	return db.Query(`
		SELECT COALESCE(SUM(gross_pay), 0) AS total_gross
		FROM "tabSalary Slip"
		WHERE docstatus = 1
		GROUP BY EXTRACT(YEAR FROM start_date)::int, EXTRACT(MONTH FROM start_date)::int
		ORDER BY EXTRACT(YEAR FROM start_date)::int, EXTRACT(MONTH FROM start_date)::int
	`)
}

func (a *PostgresMonitorAdapter) QueryMonthlyAvgGross(db *sql.DB) (*sql.Rows, error) {
	return db.Query(`
		SELECT COALESCE(AVG(gross_pay), 0) AS avg_gross
		FROM "tabSalary Slip"
		WHERE docstatus = 1
		GROUP BY EXTRACT(YEAR FROM start_date)::int, EXTRACT(MONTH FROM start_date)::int
		ORDER BY EXTRACT(YEAR FROM start_date)::int, EXTRACT(MONTH FROM start_date)::int
	`)
}

func (a *PostgresMonitorAdapter) QueryAvgLeaveAllocation(db *sql.DB) (*sql.Rows, error) {
	return db.Query(`
		SELECT COALESCE(total_leaves_allocated, 0) AS leaves
		FROM "tabLeave Allocation"
		WHERE docstatus = 1
	`)
}

func (a *PostgresMonitorAdapter) QueryMonthlyPayrollRuns(db *sql.DB) (*sql.Rows, error) {
	return db.Query(`
		SELECT COUNT(*) AS run_count
		FROM "tabPayroll Entry"
		WHERE docstatus = 1
		GROUP BY EXTRACT(YEAR FROM start_date)::int, EXTRACT(MONTH FROM start_date)::int
		ORDER BY EXTRACT(YEAR FROM start_date)::int, EXTRACT(MONTH FROM start_date)::int
	`)
}

// --- Check queries ---

func (a *PostgresMonitorAdapter) QuerySalarySlipMonths(db *sql.DB) (*sql.Rows, error) {
	return db.Query(`
		SELECT employee_name,
		       EXTRACT(YEAR FROM start_date)::int AS yr,
		       EXTRACT(MONTH FROM start_date)::int AS mo
		FROM "tabSalary Slip"
		WHERE docstatus = 1
		ORDER BY employee_name, yr, mo
	`)
}

func (a *PostgresMonitorAdapter) QueryNegativeLeaveBalances(db *sql.DB) (*sql.Rows, error) {
	return db.Query(`
		SELECT employee_name, leave_type, total_leaves_allocated
		FROM "tabLeave Allocation"
		WHERE total_leaves_allocated < 0
		  AND docstatus = 1
	`)
}

func (a *PostgresMonitorAdapter) QueryMissingTerminations(db *sql.DB) (*sql.Rows, error) {
	return db.Query(`
		SELECT e.name, e.employee_name
		FROM "tabEmployee" e
		LEFT JOIN "tabEmployee Separation" es
		  ON e.name = es.employee
		WHERE e.status = 'Left'
		  AND es.name IS NULL
	`)
}

func (a *PostgresMonitorAdapter) QueryMissingPayrollRuns(db *sql.DB) (*sql.Rows, error) {
	return db.Query(`
		SELECT ss_months.yr, ss_months.mo
		FROM (
			SELECT DISTINCT EXTRACT(YEAR FROM start_date)::int AS yr,
			                EXTRACT(MONTH FROM start_date)::int AS mo
			FROM "tabSalary Slip"
			WHERE docstatus = 1
		) ss_months
		LEFT JOIN (
			SELECT DISTINCT EXTRACT(YEAR FROM start_date)::int AS yr,
			                EXTRACT(MONTH FROM start_date)::int AS mo
			FROM "tabPayroll Entry"
			WHERE docstatus = 1
		) pe_months
		  ON ss_months.yr = pe_months.yr AND ss_months.mo = pe_months.mo
		WHERE pe_months.yr IS NULL
		ORDER BY ss_months.yr, ss_months.mo
	`)
}

func (a *PostgresMonitorAdapter) QueryFutureHireDates(db *sql.DB) (*sql.Rows, error) {
	return db.Query(`
		SELECT name, employee_name, date_of_joining
		FROM "tabEmployee"
		WHERE date_of_joining > CURRENT_DATE
	`)
}

func (a *PostgresMonitorAdapter) QueryContributionImbalances(db *sql.DB) (*sql.Rows, error) {
	return db.Query(`
		SELECT
			ss.employee_name,
			ss.name AS slip_name,
			ss.gross_pay,
			ssa.base AS expected_base,
			ABS(ss.gross_pay - ssa.base) / NULLIF(ssa.base, 0) * 100 AS deviation_pct
		FROM "tabSalary Slip" ss
		INNER JOIN (
			SELECT employee, base,
			       ROW_NUMBER() OVER (PARTITION BY employee ORDER BY from_date DESC) AS rn
			FROM "tabSalary Structure Assignment"
			WHERE docstatus = 1
		) ssa ON ss.employee = ssa.employee AND ssa.rn = 1
		WHERE ss.docstatus = 1
		  AND ssa.base > 0
		  AND ABS(ss.gross_pay - ssa.base) / ssa.base * 100 > 5
		ORDER BY deviation_pct DESC
	`)
}

// --- Timeliness queries ---

func (a *PostgresMonitorAdapter) QueryLatestSalarySlipDate(db *sql.DB) (*sql.Rows, error) {
	return db.Query(`
		SELECT TO_CHAR(MAX(start_date), 'YYYY-MM-DD') AS latest_date
		FROM "tabSalary Slip"
		WHERE docstatus = 1
	`)
}

func (a *PostgresMonitorAdapter) QueryLatestAttendanceDate(db *sql.DB) (*sql.Rows, error) {
	return db.Query(`
		SELECT TO_CHAR(MAX(attendance_date), 'YYYY-MM-DD') AS latest_date
		FROM "tabAttendance"
		WHERE docstatus = 1
	`)
}
