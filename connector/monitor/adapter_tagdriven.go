package monitor

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/noui/platform/connector/schema"
)

// TagDrivenAdapter implements MonitorAdapter by resolving table and column
// names from a tagged SchemaManifest at runtime. This enables monitoring
// against any schema that the tagger can understand — ERPNext HR, DERP
// pension, or any future target.
//
// When a required concept tag is absent from the manifest, query methods
// return an empty result set rather than failing, allowing checks to
// gracefully skip.
//
// SQL dialect is PostgreSQL. For MySQL/MSSQL schemas, use the dedicated
// adapters (adapter_mysql.go, adapter_mssql.go).
type TagDrivenAdapter struct {
	Resolver *SchemaResolver
	Driver   string // "postgres", "mysql", or "mssql" — for SQL dialect
}

// NewTagDrivenAdapter creates a TagDrivenAdapter from a tagged manifest.
func NewTagDrivenAdapter(manifest schema.SchemaManifest, driver string) *TagDrivenAdapter {
	return &TagDrivenAdapter{
		Resolver: NewSchemaResolver(manifest),
		Driver:   driver,
	}
}

// emptyRows returns a single-row result with NULL, which check code can handle.
// This is used when a required concept tag is missing.
func emptyRows(db *sql.DB) (*sql.Rows, error) {
	return db.Query("SELECT 1 WHERE FALSE")
}

// quote wraps an identifier in the appropriate quoting for the SQL dialect.
func (a *TagDrivenAdapter) quote(name string) string {
	switch a.Driver {
	case "mysql":
		return "`" + name + "`"
	case "mssql":
		return "[" + name + "]"
	default: // postgres
		return `"` + name + `"`
	}
}

// yearExpr returns the SQL expression for extracting year from a date column.
func (a *TagDrivenAdapter) yearExpr(col string) string {
	switch a.Driver {
	case "postgres":
		return fmt.Sprintf("EXTRACT(YEAR FROM %s)::int", col)
	case "mssql":
		return fmt.Sprintf("YEAR(%s)", col)
	default: // mysql
		return fmt.Sprintf("YEAR(%s)", col)
	}
}

// monthExpr returns the SQL expression for extracting month from a date column.
func (a *TagDrivenAdapter) monthExpr(col string) string {
	switch a.Driver {
	case "postgres":
		return fmt.Sprintf("EXTRACT(MONTH FROM %s)::int", col)
	case "mssql":
		return fmt.Sprintf("MONTH(%s)", col)
	default: // mysql
		return fmt.Sprintf("MONTH(%s)", col)
	}
}

// currentDateExpr returns the SQL expression for the current date.
func (a *TagDrivenAdapter) currentDateExpr() string {
	switch a.Driver {
	case "postgres":
		return "CURRENT_DATE"
	case "mssql":
		return "CAST(GETDATE() AS DATE)"
	default: // mysql
		return "CURDATE()"
	}
}

// maxDateExpr returns the SQL expression for formatting MAX(col) as YYYY-MM-DD.
func (a *TagDrivenAdapter) maxDateExpr(col string) string {
	switch a.Driver {
	case "postgres":
		return fmt.Sprintf("TO_CHAR(MAX(%s), 'YYYY-MM-DD')", col)
	case "mssql":
		return fmt.Sprintf("FORMAT(MAX(%s), 'yyyy-MM-dd')", col)
	default: // mysql
		return fmt.Sprintf("DATE_FORMAT(MAX(%s), '%%Y-%%m-%%d')", col)
	}
}

// absExpr returns the SQL absolute value expression.
func (a *TagDrivenAdapter) absExpr(expr string) string {
	return fmt.Sprintf("ABS(%s)", expr)
}

// nullifExpr returns NULLIF expression.
func (a *TagDrivenAdapter) nullifExpr(expr string, val string) string {
	return fmt.Sprintf("NULLIF(%s, %s)", expr, val)
}

// docstatusFilter returns a WHERE clause fragment for docstatus filtering.
// ERPNext uses docstatus=1 for submitted records. Non-ERPNext schemas
// typically don't have docstatus — returns empty string in that case.
func (a *TagDrivenAdapter) docstatusFilter(tag string) string {
	ti, ok := a.Resolver.TagToTableInfo(tag)
	if !ok {
		return ""
	}
	for _, col := range ti.Columns {
		if strings.EqualFold(col.Name, "docstatus") {
			return fmt.Sprintf("%s = 1", a.quote("docstatus"))
		}
	}
	return ""
}

// whereClause builds a WHERE clause from non-empty conditions.
func whereClause(conditions ...string) string {
	var active []string
	for _, c := range conditions {
		if c != "" {
			active = append(active, c)
		}
	}
	if len(active) == 0 {
		return ""
	}
	return "WHERE " + strings.Join(active, " AND ")
}

// --- Baseline queries ---

func (a *TagDrivenAdapter) QueryMonthlyEmployeeCount(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("salary-history") {
		return emptyRows(db)
	}
	tbl := a.Resolver.QuotedTable("salary-history")
	startCol := a.resolveStartDate("salary-history")
	if startCol == "" {
		return emptyRows(db)
	}
	qStartCol := a.quote(startCol)
	ds := a.docstatusFilter("salary-history")
	w := whereClause(ds)

	q := fmt.Sprintf(`SELECT COUNT(*) AS slip_count FROM %s %s GROUP BY %s, %s ORDER BY %s, %s`,
		tbl, w,
		a.yearExpr(qStartCol), a.monthExpr(qStartCol),
		a.yearExpr(qStartCol), a.monthExpr(qStartCol))
	return db.Query(q)
}

func (a *TagDrivenAdapter) QueryMonthlyGrossTotal(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("salary-history") {
		return emptyRows(db)
	}
	tbl := a.Resolver.QuotedTable("salary-history")
	startCol := a.resolveStartDate("salary-history")
	grossCol := a.resolveGrossPay("salary-history")
	if startCol == "" || grossCol == "" {
		return emptyRows(db)
	}
	qStartCol := a.quote(startCol)
	qGrossCol := a.quote(grossCol)
	ds := a.docstatusFilter("salary-history")
	w := whereClause(ds)

	q := fmt.Sprintf(`SELECT COALESCE(SUM(%s), 0) AS total_gross FROM %s %s GROUP BY %s, %s ORDER BY %s, %s`,
		qGrossCol, tbl, w,
		a.yearExpr(qStartCol), a.monthExpr(qStartCol),
		a.yearExpr(qStartCol), a.monthExpr(qStartCol))
	return db.Query(q)
}

func (a *TagDrivenAdapter) QueryMonthlyAvgGross(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("salary-history") {
		return emptyRows(db)
	}
	tbl := a.Resolver.QuotedTable("salary-history")
	startCol := a.resolveStartDate("salary-history")
	grossCol := a.resolveGrossPay("salary-history")
	if startCol == "" || grossCol == "" {
		return emptyRows(db)
	}
	qStartCol := a.quote(startCol)
	qGrossCol := a.quote(grossCol)
	ds := a.docstatusFilter("salary-history")
	w := whereClause(ds)

	q := fmt.Sprintf(`SELECT COALESCE(AVG(%s), 0) AS avg_gross FROM %s %s GROUP BY %s, %s ORDER BY %s, %s`,
		qGrossCol, tbl, w,
		a.yearExpr(qStartCol), a.monthExpr(qStartCol),
		a.yearExpr(qStartCol), a.monthExpr(qStartCol))
	return db.Query(q)
}

func (a *TagDrivenAdapter) QueryAvgLeaveAllocation(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("leave-balance") {
		return emptyRows(db)
	}
	tbl := a.Resolver.QuotedTable("leave-balance")
	allocCol := a.Resolver.ColumnRole("leave-balance", []string{
		"total_leaves_allocated", "leaves_allocated", "leave_balance",
		"total_leave", "new_leaves",
	})
	if allocCol == "" {
		return emptyRows(db)
	}
	qAllocCol := a.quote(allocCol)
	ds := a.docstatusFilter("leave-balance")
	w := whereClause(ds)

	q := fmt.Sprintf(`SELECT COALESCE(%s, 0) AS leaves FROM %s %s`,
		qAllocCol, tbl, w)
	return db.Query(q)
}

func (a *TagDrivenAdapter) QueryMonthlyPayrollRuns(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("payroll-run") {
		return emptyRows(db)
	}
	tbl := a.Resolver.QuotedTable("payroll-run")
	startCol := a.resolveStartDate("payroll-run")
	if startCol == "" {
		return emptyRows(db)
	}
	qStartCol := a.quote(startCol)
	ds := a.docstatusFilter("payroll-run")
	w := whereClause(ds)

	q := fmt.Sprintf(`SELECT COUNT(*) AS run_count FROM %s %s GROUP BY %s, %s ORDER BY %s, %s`,
		tbl, w,
		a.yearExpr(qStartCol), a.monthExpr(qStartCol),
		a.yearExpr(qStartCol), a.monthExpr(qStartCol))
	return db.Query(q)
}

// --- Check queries ---

func (a *TagDrivenAdapter) QuerySalarySlipMonths(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("salary-history") {
		return emptyRows(db)
	}
	tbl := a.Resolver.QuotedTable("salary-history")
	startCol := a.resolveStartDate("salary-history")
	nameCol := a.resolveEmployeeName("salary-history")
	if startCol == "" || nameCol == "" {
		return emptyRows(db)
	}
	qStartCol := a.quote(startCol)
	qNameCol := a.quote(nameCol)
	ds := a.docstatusFilter("salary-history")
	w := whereClause(ds)

	q := fmt.Sprintf(`SELECT %s, %s AS yr, %s AS mo FROM %s %s ORDER BY %s, yr, mo`,
		qNameCol,
		a.yearExpr(qStartCol), a.monthExpr(qStartCol),
		tbl, w, qNameCol)
	return db.Query(q)
}

func (a *TagDrivenAdapter) QueryNegativeLeaveBalances(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("leave-balance") {
		return emptyRows(db)
	}
	tbl := a.Resolver.QuotedTable("leave-balance")
	nameCol := a.Resolver.ColumnRole("leave-balance", []string{
		"employee_name", "employee", "member_id", "name",
	})
	typeCol := a.Resolver.ColumnRole("leave-balance", []string{
		"leave_type",
	})
	allocCol := a.Resolver.ColumnRole("leave-balance", []string{
		"total_leaves_allocated", "leaves_allocated", "leave_balance",
	})
	if nameCol == "" || typeCol == "" || allocCol == "" {
		return emptyRows(db)
	}

	qNameCol := a.quote(nameCol)
	qTypeCol := a.quote(typeCol)
	qAllocCol := a.quote(allocCol)
	ds := a.docstatusFilter("leave-balance")
	w := whereClause(ds, fmt.Sprintf("%s < 0", qAllocCol))

	q := fmt.Sprintf(`SELECT %s, %s, %s FROM %s %s`,
		qNameCol, qTypeCol, qAllocCol, tbl, w)
	return db.Query(q)
}

func (a *TagDrivenAdapter) QueryMissingTerminations(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("employee-master") || !a.Resolver.HasTag("employment-timeline") {
		return emptyRows(db)
	}
	empTbl := a.Resolver.QuotedTable("employee-master")
	sepTbl := a.Resolver.QuotedTable("employment-timeline")

	// Resolve columns
	empPK := a.Resolver.PrimaryKeyColumn("employee-master")
	empNameCol := a.resolveEmployeeName("employee-master")
	statusCol := a.Resolver.ColumnRole("employee-master", []string{
		"status", "status_cd",
	})
	if empPK == "" || empNameCol == "" || statusCol == "" {
		return emptyRows(db)
	}

	// The employment-timeline table needs a member/employee link column
	// and a separation indicator
	sepMemberCol := a.Resolver.MemberIDColumn("employment-timeline")
	sepTypeCol := a.Resolver.ColumnRole("employment-timeline", []string{
		"separation_cd", "event_type", "boarding_status",
	})
	if sepMemberCol == "" {
		return emptyRows(db)
	}

	qEmpPK := a.quote(empPK)
	qEmpName := a.quote(empNameCol)
	qStatus := a.quote(statusCol)
	qSepMember := a.quote(sepMemberCol)

	// Determine the "terminated" status value and separation filter
	// ERPNext: status = 'Left', employment-timeline has separation records as separate table rows
	// DERP pension: status_cd = 'T', employment_hist has event_type = 'SEPARATION'
	statusValue := "'Left'"
	sepFilter := ""

	// If there's a separation type column, filter on separation events
	if sepTypeCol != "" {
		qSepType := a.quote(sepTypeCol)
		// Check if the separation column looks like event_type (DERP style)
		if strings.Contains(strings.ToLower(sepTypeCol), "event_type") {
			statusValue = "'T'"
			sepFilter = fmt.Sprintf("AND es.%s = 'SEPARATION'", qSepType)
		} else if strings.Contains(strings.ToLower(sepTypeCol), "separation") {
			// DERP: separation_cd is non-null for separation events
			statusValue = "'T'"
			sepFilter = fmt.Sprintf("AND es.%s IS NOT NULL", qSepType)
		}
	}

	q := fmt.Sprintf(`SELECT e.%s, e.%s FROM %s e LEFT JOIN %s es ON e.%s = es.%s %s WHERE e.%s = %s AND es.%s IS NULL`,
		qEmpPK, qEmpName, empTbl, sepTbl,
		qEmpPK, qSepMember, sepFilter,
		qStatus, statusValue,
		qSepMember)
	return db.Query(q)
}

func (a *TagDrivenAdapter) QueryMissingPayrollRuns(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("salary-history") || !a.Resolver.HasTag("payroll-run") {
		return emptyRows(db)
	}
	ssTbl := a.Resolver.QuotedTable("salary-history")
	peTbl := a.Resolver.QuotedTable("payroll-run")

	ssStartCol := a.resolveStartDate("salary-history")
	peStartCol := a.resolveStartDate("payroll-run")
	if ssStartCol == "" || peStartCol == "" {
		return emptyRows(db)
	}

	qSSStart := a.quote(ssStartCol)
	qPEStart := a.quote(peStartCol)
	ssDS := a.docstatusFilter("salary-history")
	peDS := a.docstatusFilter("payroll-run")
	ssW := whereClause(ssDS)
	peW := whereClause(peDS)

	q := fmt.Sprintf(`SELECT ss_months.yr, ss_months.mo FROM (SELECT DISTINCT %s AS yr, %s AS mo FROM %s %s) ss_months LEFT JOIN (SELECT DISTINCT %s AS yr, %s AS mo FROM %s %s) pe_months ON ss_months.yr = pe_months.yr AND ss_months.mo = pe_months.mo WHERE pe_months.yr IS NULL ORDER BY ss_months.yr, ss_months.mo`,
		a.yearExpr(qSSStart), a.monthExpr(qSSStart), ssTbl, ssW,
		a.yearExpr(qPEStart), a.monthExpr(qPEStart), peTbl, peW)
	return db.Query(q)
}

func (a *TagDrivenAdapter) QueryFutureHireDates(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("employee-master") {
		return emptyRows(db)
	}
	tbl := a.Resolver.QuotedTable("employee-master")
	pkCol := a.Resolver.PrimaryKeyColumn("employee-master")
	nameCol := a.resolveEmployeeName("employee-master")
	hireCol := a.Resolver.ColumnRole("employee-master", []string{
		"date_of_joining", "joining_date", "hire_date", "hire_dt",
	})
	if pkCol == "" || nameCol == "" || hireCol == "" {
		return emptyRows(db)
	}

	qPK := a.quote(pkCol)
	qName := a.quote(nameCol)
	qHire := a.quote(hireCol)

	q := fmt.Sprintf(`SELECT %s, %s, %s FROM %s WHERE %s > %s`,
		qPK, qName, qHire, tbl, qHire, a.currentDateExpr())
	return db.Query(q)
}

func (a *TagDrivenAdapter) QueryContributionImbalances(db *sql.DB) (*sql.Rows, error) {
	// This check requires both salary-history and salary-structure assignment data.
	// The salary-structure concept maps to a separate table in ERPNext but doesn't
	// exist in pension schemas. When absent, we skip gracefully.
	if !a.Resolver.HasTag("salary-history") {
		return emptyRows(db)
	}

	// Look for a salary structure table — could be tagged salary-history (2nd table)
	// or have a specific naming pattern
	ssTbl := a.Resolver.QuotedTable("salary-history")
	nameCol := a.resolveEmployeeName("salary-history")
	grossCol := a.resolveGrossPay("salary-history")
	if nameCol == "" || grossCol == "" {
		return emptyRows(db)
	}

	// We need a salary structure assignment table for comparison.
	// In ERPNext this is "tabSalary Structure Assignment" — look for it by name
	var ssaTbl string
	var ssaBaseCol, ssaFromDateCol, ssaEmpCol string
	for _, t := range a.Resolver.manifest.Tables {
		lower := strings.ToLower(t.Name)
		if strings.Contains(lower, "salary") && strings.Contains(lower, "structure") && strings.Contains(lower, "assignment") {
			ssaTbl = a.quote(t.Name)
			ssaBaseCol = resolveColumn(t, []string{"base"})
			ssaFromDateCol = resolveColumn(t, []string{"from_date"})
			ssaEmpCol = resolveColumn(t, []string{"employee", "member_id"})
			break
		}
	}
	if ssaTbl == "" || ssaBaseCol == "" || ssaEmpCol == "" {
		return emptyRows(db)
	}

	qNameCol := a.quote(nameCol)
	qGrossCol := a.quote(grossCol)
	empLinkCol := a.Resolver.MemberIDColumn("salary-history")
	if empLinkCol == "" {
		empLinkCol = resolveColumn(a.Resolver.tagToTableInfo["salary-history"], []string{"employee", "member_id"})
	}
	if empLinkCol == "" {
		return emptyRows(db)
	}
	qEmpLink := a.quote(empLinkCol)
	qSSABase := a.quote(ssaBaseCol)
	qSSAEmp := a.quote(ssaEmpCol)
	pkCol := a.Resolver.PrimaryKeyColumn("salary-history")
	if pkCol == "" {
		pkCol = "name" // ERPNext default
	}
	qPK := a.quote(pkCol)

	ds := a.docstatusFilter("salary-history")
	w := ""
	if ds != "" {
		w = "WHERE ss." + ds
	}

	var rowNumExpr string
	switch a.Driver {
	case "mssql":
		rowNumExpr = fmt.Sprintf("ROW_NUMBER() OVER (PARTITION BY %s ORDER BY %s DESC)",
			qSSAEmp, a.quote(ssaFromDateCol))
	default:
		rowNumExpr = fmt.Sprintf("ROW_NUMBER() OVER (PARTITION BY %s ORDER BY %s DESC)",
			qSSAEmp, a.quote(ssaFromDateCol))
	}

	// Find docstatus for SSA table too
	ssaDS := ""
	for _, t := range a.Resolver.manifest.Tables {
		if a.quote(t.Name) == ssaTbl {
			for _, col := range t.Columns {
				if strings.EqualFold(col.Name, "docstatus") {
					ssaDS = fmt.Sprintf("WHERE %s = 1", a.quote("docstatus"))
					break
				}
			}
		}
	}

	q := fmt.Sprintf(`SELECT ss.%s, ss.%s AS slip_name, ss.%s, ssa.%s AS expected_base, %s / %s * 100 AS deviation_pct FROM %s ss INNER JOIN (SELECT %s, %s, %s AS rn FROM %s %s) ssa ON ss.%s = ssa.%s AND ssa.rn = 1 %s AND ssa.%s > 0 AND %s / ssa.%s * 100 > 5 ORDER BY deviation_pct DESC`,
		qNameCol, qPK, qGrossCol, qSSABase,
		a.absExpr(fmt.Sprintf("ss.%s - ssa.%s", qGrossCol, qSSABase)),
		a.nullifExpr("ssa."+qSSABase, "0"),
		ssTbl,
		qSSAEmp, qSSABase, rowNumExpr, ssaTbl, ssaDS,
		qEmpLink, qSSAEmp,
		w,
		qSSABase,
		a.absExpr(fmt.Sprintf("ss.%s - ssa.%s", qGrossCol, qSSABase)),
		qSSABase)
	return db.Query(q)
}

// --- Timeliness queries ---

func (a *TagDrivenAdapter) QueryLatestSalarySlipDate(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("salary-history") {
		return emptyRows(db)
	}
	tbl := a.Resolver.QuotedTable("salary-history")
	startCol := a.resolveStartDate("salary-history")
	if startCol == "" {
		return emptyRows(db)
	}
	qStartCol := a.quote(startCol)
	ds := a.docstatusFilter("salary-history")
	w := whereClause(ds)

	q := fmt.Sprintf(`SELECT %s AS latest_date FROM %s %s`,
		a.maxDateExpr(qStartCol), tbl, w)
	return db.Query(q)
}

func (a *TagDrivenAdapter) QueryLatestAttendanceDate(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("attendance") {
		return emptyRows(db)
	}
	tbl := a.Resolver.QuotedTable("attendance")
	dateCol := a.Resolver.ColumnRole("attendance", []string{
		"attendance_date", "check_in", "date",
	})
	if dateCol == "" {
		return emptyRows(db)
	}
	qDateCol := a.quote(dateCol)
	ds := a.docstatusFilter("attendance")
	w := whereClause(ds)

	q := fmt.Sprintf(`SELECT %s AS latest_date FROM %s %s`,
		a.maxDateExpr(qDateCol), tbl, w)
	return db.Query(q)
}

// --- Pension-specific check queries ---

// QueryBeneficiaryAllocations returns (member_id, sum_alloc_pct) for members
// whose beneficiary allocations don't sum to 100%.
func (a *TagDrivenAdapter) QueryBeneficiaryAllocations(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("beneficiary-designation") {
		return emptyRows(db)
	}
	tbl := a.Resolver.QuotedTable("beneficiary-designation")
	memberCol := a.Resolver.MemberIDColumn("beneficiary-designation")
	allocCol := a.Resolver.ColumnRole("beneficiary-designation", []string{
		"alloc_pct", "percentage", "share", "allocation",
	})
	// Only consider active designations (no end_dt or end_dt is null/in future)
	endCol := a.Resolver.ColumnRole("beneficiary-designation", []string{
		"end_dt", "end_date", "terminated_date",
	})

	if memberCol == "" || allocCol == "" {
		return emptyRows(db)
	}

	qMember := a.quote(memberCol)
	qAlloc := a.quote(allocCol)

	activeFilter := ""
	if endCol != "" {
		qEnd := a.quote(endCol)
		activeFilter = fmt.Sprintf("WHERE (%s IS NULL OR %s >= %s)", qEnd, qEnd, a.currentDateExpr())
	}

	q := fmt.Sprintf(`SELECT %s, SUM(%s) AS total_pct FROM %s %s GROUP BY %s HAVING SUM(%s) != 100`,
		qMember, qAlloc, tbl, activeFilter, qMember, qAlloc)
	return db.Query(q)
}

// QueryServiceCreditOverlaps returns (member_id, begin_dt_1, end_dt_1, begin_dt_2, end_dt_2)
// for overlapping service credit periods.
func (a *TagDrivenAdapter) QueryServiceCreditOverlaps(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("service-credit") {
		return emptyRows(db)
	}
	tbl := a.Resolver.QuotedTable("service-credit")
	memberCol := a.Resolver.MemberIDColumn("service-credit")
	beginCol := a.Resolver.ColumnRole("service-credit", []string{
		"begin_dt", "start_date", "from_date", "begin_date",
	})
	endCol := a.Resolver.ColumnRole("service-credit", []string{
		"end_dt", "end_date", "to_date", "finish_date",
	})
	pkCol := a.Resolver.PrimaryKeyColumn("service-credit")

	if memberCol == "" || beginCol == "" || endCol == "" || pkCol == "" {
		return emptyRows(db)
	}

	qMember := a.quote(memberCol)
	qBegin := a.quote(beginCol)
	qEnd := a.quote(endCol)
	qPK := a.quote(pkCol)

	q := fmt.Sprintf(`SELECT a.%s, a.%s AS begin_1, a.%s AS end_1, b.%s AS begin_2, b.%s AS end_2 FROM %s a INNER JOIN %s b ON a.%s = b.%s AND a.%s < b.%s WHERE a.%s < b.%s AND b.%s < a.%s`,
		qMember, qBegin, qEnd, qBegin, qEnd,
		tbl, tbl,
		qMember, qMember,
		qPK, qPK,
		qBegin, qEnd, qBegin, qEnd)
	return db.Query(q)
}

// QueryDROStatusInconsistencies returns (member_id, dro_status) for DROs with
// active status but no corresponding benefit payment record.
func (a *TagDrivenAdapter) QueryDROStatusInconsistencies(db *sql.DB) (*sql.Rows, error) {
	if !a.Resolver.HasTag("domestic-relations-order") || !a.Resolver.HasTag("benefit-payment") {
		return emptyRows(db)
	}
	droTbl := a.Resolver.QuotedTable("domestic-relations-order")
	payTbl := a.Resolver.QuotedTable("benefit-payment")

	droMemberCol := a.Resolver.MemberIDColumn("domestic-relations-order")
	droStatusCol := a.Resolver.ColumnRole("domestic-relations-order", []string{
		"status", "status_cd",
	})
	payMemberCol := a.Resolver.MemberIDColumn("benefit-payment")
	droDeductCol := a.Resolver.ColumnRole("benefit-payment", []string{
		"dro_deduct", "dro_amount", "alt_payee_amount",
	})

	if droMemberCol == "" || droStatusCol == "" || payMemberCol == "" {
		return emptyRows(db)
	}

	qDROMember := a.quote(droMemberCol)
	qDROStatus := a.quote(droStatusCol)
	qPayMember := a.quote(payMemberCol)

	// If there's a dro_deduct column on benefit_payment, check for non-zero payments
	payFilter := ""
	if droDeductCol != "" {
		qDRODeduct := a.quote(droDeductCol)
		payFilter = fmt.Sprintf("AND bp.%s > 0", qDRODeduct)
	}

	q := fmt.Sprintf(`SELECT d.%s, d.%s FROM %s d LEFT JOIN %s bp ON d.%s = bp.%s %s WHERE d.%s IN ('Active', 'ACTIVE', 'A', 'Approved') AND bp.%s IS NULL`,
		qDROMember, qDROStatus,
		droTbl, payTbl,
		qDROMember, qPayMember, payFilter,
		qDROStatus, qPayMember)
	return db.Query(q)
}

// --- Helper methods for column role resolution ---

// resolveStartDate finds the date column used for period-based grouping.
func (a *TagDrivenAdapter) resolveStartDate(tag string) string {
	return a.Resolver.ColumnRole(tag, []string{
		"start_date", "pay_period_end", "pay_period_start",
		"from_date", "period_start", "posting_date",
		"begin_dt", "begin_date",
	})
}

// resolveGrossPay finds the gross pay / compensation column.
func (a *TagDrivenAdapter) resolveGrossPay(tag string) string {
	return a.Resolver.ColumnRole(tag, []string{
		"gross_pay", "gross_monthly", "gross_amount",
		"total_earning", "base_gross_pay",
	})
}

// resolveEmployeeName finds the display name column for an employee/member.
func (a *TagDrivenAdapter) resolveEmployeeName(tag string) string {
	col := a.Resolver.ColumnRole(tag, []string{
		"employee_name", "full_name",
	})
	if col != "" {
		return col
	}
	// Pension schemas typically have separate first/last name — use member_id as identifier
	col = a.Resolver.ColumnRole(tag, []string{
		"member_id", "employee_id", "emp_id",
	})
	if col != "" {
		return col
	}
	// Last resort: use primary key
	return a.Resolver.PrimaryKeyColumn(tag)
}

// TagToTableInfo exposes the resolver's tag-to-table-info map for the adapter.
func (r *SchemaResolver) TagToTableInfo(tag string) (schema.TableInfo, bool) {
	t, ok := r.tagToTableInfo[tag]
	return t, ok
}
