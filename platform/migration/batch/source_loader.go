package batch

import (
	"database/sql"
	"fmt"
	"log/slog"
	"strings"
	"time"
)

// prismPlanCodeMap normalizes PRISM plan codes to canonical tier IDs.
var prismPlanCodeMap = map[string]string{
	"DB_MAIN": "TIER_1",
	"DB_T1":   "TIER_1",
	"DB_T2":   "TIER_2",
	"DB_T3":   "TIER_3",
}

// pasPlanCodeMap normalizes PAS plan codes to canonical tier IDs.
var pasPlanCodeMap = map[string]string{
	"DB-T1": "TIER_1",
	"DB-T2": "TIER_2",
	"DB-T3": "TIER_3",
}

// normalizePlanCode maps a source plan code to a canonical tier ID.
// Returns (canonical, original). If the code is not in the map, both are the source code.
func normalizePlanCode(sourceCode string, codeMap map[string]string) (canonical, original string) {
	canonical, ok := codeMap[sourceCode]
	if !ok {
		return sourceCode, sourceCode
	}
	return canonical, sourceCode
}

// LoadSourceReferenceData loads stored calculations and payment history from
// the source database into the migration schema staging tables. This data is
// required by the reconciler (tier 1 uses stored_calculations, tier 2 uses
// payment_history).
//
// The loader detects the source system from the DSN/table patterns and runs
// the appropriate queries.
func LoadSourceReferenceData(migrationDB *sql.DB, batchID, sourceSystem, sourceDSN string) error {
	driver := driverFromDSN(sourceDSN)
	sourceDB, err := sql.Open(driver, sourceDSN)
	if err != nil {
		return fmt.Errorf("source_loader: open source db: %w", err)
	}
	defer sourceDB.Close()

	// Resolve source system: try explicit name first, then auto-detect
	// from the source DB schema. This handles engagements created with
	// arbitrary display names (e.g. "E2E-Legacy-PAS-12345").
	resolved := resolveSourceSystem(sourceSystem, sourceDB)

	switch resolved {
	case "PRISM":
		if err := loadPRISMCalculations(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
		if err := loadPRISMPayments(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
		if err := loadPRISMSalaryHistory(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
		if err := loadPRISMContributions(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
		if err := loadPRISMServiceCredit(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
	case "PAS":
		if err := loadPASCalculations(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
		if err := loadPASPayments(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
		if err := loadPASSalaryHistory(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
		if err := loadPASContributions(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
		if err := loadPASServiceCredit(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
	default:
		slog.Warn("source_loader: unknown source system, skipping reference data load",
			"source_system", sourceSystem, "resolved", resolved, "batch_id", batchID)
	}

	// Backfill canonical_benefit from the most recent REGULAR payment for
	// members that still have NULL canonical_benefit. This enables Tier 2
	// reconciliation for members whose source record lacks a benefit field.
	if err := backfillCanonicalBenefitFromPayments(migrationDB, batchID); err != nil {
		slog.Warn("source_loader: canonical_benefit backfill failed (non-fatal)", "error", err, "batch_id", batchID)
	}

	return nil
}

// resolveSourceSystem determines the source system type. It checks the explicit
// name first (case-insensitive), then probes the source DB for known tables.
func resolveSourceSystem(explicit string, sourceDB *sql.DB) string {
	upper := strings.ToUpper(strings.TrimSpace(explicit))

	// Exact match on known names.
	switch upper {
	case "PRISM":
		return "PRISM"
	case "PAS":
		return "PAS"
	}

	// Substring match (handles "E2E-Legacy-PAS-12345" or "PRISM-prod").
	if strings.Contains(upper, "PRISM") {
		return "PRISM"
	}
	if strings.Contains(upper, "PAS") {
		return "PAS"
	}

	// Auto-detect by probing for known tables in the source DB.
	if sourceDB != nil {
		if tableExists(sourceDB, "src_prism", "prism_member") ||
			tableExists(sourceDB, "src_prism", "prism_benefit_calc") {
			slog.Info("source_loader: auto-detected PRISM from source schema")
			return "PRISM"
		}
		if tableExists(sourceDB, "src_pas", "member") ||
			tableExists(sourceDB, "src_pas", "retirement_award") {
			slog.Info("source_loader: auto-detected PAS from source schema")
			return "PAS"
		}
	}

	return upper
}

// tableExists checks whether a table exists in the source database.
func tableExists(db *sql.DB, schema, table string) bool {
	var exists bool
	err := db.QueryRow(
		`SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = $1 AND table_name = $2
		)`, schema, table,
	).Scan(&exists)
	if err != nil {
		return false
	}
	return exists
}

// loadPRISMCalculations loads benefit calculations from PRISM_BENEFIT_CALC.
// Only current (C) calculations are loaded — superseded and voided are skipped.
func loadPRISMCalculations(migrationDB, sourceDB *sql.DB, batchID string) error {
	rows, err := sourceDB.Query(`
		SELECT
			CAST(c.MBR_NBR AS TEXT),
			COALESCE(CAST(c.YOS_USED AS TEXT), '0'),
			COALESCE(CAST(c.FAS_USED AS TEXT), '0'),
			COALESCE(FLOOR(c.AGE_AT_CALC)::INTEGER, 0),
			COALESCE(m.PLAN_CD, 'DB_MAIN'),
			CAST(COALESCE(c.CALC_RESULT, c.GROSS_BENEFIT, 0) AS TEXT)
		FROM src_prism.prism_benefit_calc c
		LEFT JOIN src_prism.prism_member m ON m.MBR_NBR = c.MBR_NBR
		WHERE c.CALC_STATUS = 'C'
	`)
	if err != nil {
		return fmt.Errorf("source_loader: query PRISM benefit calcs: %w", err)
	}
	defer rows.Close()

	return insertStoredCalculations(migrationDB, batchID, rows, prismPlanCodeMap)
}

// loadPASCalculations loads benefit calculations from retirement_award.
func loadPASCalculations(migrationDB, sourceDB *sql.DB, batchID string) error {
	rows, err := sourceDB.Query(`
		SELECT
			CAST(member_id AS TEXT),
			COALESCE(CAST(credited_service_years AS TEXT), '0'),
			COALESCE(CAST(final_average_salary AS TEXT), '0'),
			COALESCE(EXTRACT(YEAR FROM AGE(retirement_date, '1900-01-01'))::INTEGER, 65),
			COALESCE(plan_code, 'DB_MAIN'),
			CAST(COALESCE(gross_monthly_benefit, 0) AS TEXT)
		FROM src_pas.retirement_award
	`)
	if err != nil {
		return fmt.Errorf("source_loader: query PAS retirement awards: %w", err)
	}
	defer rows.Close()

	return insertStoredCalculations(migrationDB, batchID, rows, pasPlanCodeMap)
}

func insertStoredCalculations(migrationDB *sql.DB, batchID string, rows *sql.Rows, codeMap map[string]string) error {
	count := 0
	for rows.Next() {
		var memberID, yosUsed, fasUsed, rawPlanCode, storedBenefit string
		var ageAtCalc int
		if err := rows.Scan(&memberID, &yosUsed, &fasUsed, &ageAtCalc, &rawPlanCode, &storedBenefit); err != nil {
			return fmt.Errorf("source_loader: scan stored calc: %w", err)
		}
		planCode, sourcePlanCode := normalizePlanCode(rawPlanCode, codeMap)
		_, err := migrationDB.Exec(
			`INSERT INTO migration.stored_calculations
			 (batch_id, member_id, yos_used, fas_used, age_at_calc, plan_code, stored_benefit, source_plan_code)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			batchID, memberID, yosUsed, fasUsed, ageAtCalc, planCode, storedBenefit, sourcePlanCode,
		)
		if err != nil {
			return fmt.Errorf("source_loader: insert stored calc: %w", err)
		}
		count++
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("source_loader: iterate stored calcs: %w", err)
	}
	if count == 0 {
		slog.Warn("source_loader: zero stored calculations loaded — reconciliation tier 1 will have no data",
			"batch_id", batchID)
	} else {
		slog.Info("source_loader: loaded stored calculations", "batch_id", batchID, "count", count)
	}
	return nil
}

// loadPRISMPayments loads payment history from PRISM_PMT_HIST.
func loadPRISMPayments(migrationDB, sourceDB *sql.DB, batchID string) error {
	rows, err := sourceDB.Query(`
		SELECT
			CAST(h.MBR_NBR AS TEXT),
			CASE WHEN TRIM(COALESCE(s.SCHED_TYP, 'REGR')) IN ('REGR','DISB') THEN 'REGULAR'
			     ELSE TRIM(COALESCE(s.SCHED_TYP, 'REGR'))
			END,
			h.PMT_DT,
			CAST(COALESCE(h.GROSS_AMT, 0) AS TEXT)
		FROM src_prism.prism_pmt_hist h
		LEFT JOIN src_prism.prism_pmt_schedule s ON s.PMT_SCHED_ID = h.PMT_SCHED_ID
		WHERE h.PMT_STATUS != 'V'
	`)
	if err != nil {
		return fmt.Errorf("source_loader: query PRISM payments: %w", err)
	}
	defer rows.Close()

	return insertPaymentHistory(migrationDB, batchID, rows)
}

// loadPASPayments loads payment history from benefit_payment.
func loadPASPayments(migrationDB, sourceDB *sql.DB, batchID string) error {
	rows, err := sourceDB.Query(`
		SELECT
			CAST(member_id AS TEXT),
			CASE WHEN payment_status_code IN ('PAID','PROCESSED','ISSUED') THEN 'REGULAR'
			 ELSE COALESCE(payment_status_code, 'REGULAR')
		END,
			payment_date,
			CAST(COALESCE(gross_amount, 0) AS TEXT)
		FROM src_pas.benefit_payment
	`)
	if err != nil {
		return fmt.Errorf("source_loader: query PAS payments: %w", err)
	}
	defer rows.Close()

	return insertPaymentHistory(migrationDB, batchID, rows)
}

func insertPaymentHistory(migrationDB *sql.DB, batchID string, rows *sql.Rows) error {
	count := 0
	for rows.Next() {
		var memberID, paymentType, grossAmount string
		var paymentDate sql.NullTime
		if err := rows.Scan(&memberID, &paymentType, &paymentDate, &grossAmount); err != nil {
			return fmt.Errorf("source_loader: scan payment: %w", err)
		}
		if !paymentDate.Valid {
			continue
		}
		_, err := migrationDB.Exec(
			`INSERT INTO migration.payment_history
			 (batch_id, member_id, payment_type, payment_date, gross_amount)
			 VALUES ($1, $2, $3, $4, $5)`,
			batchID, memberID, paymentType, paymentDate.Time, grossAmount,
		)
		if err != nil {
			return fmt.Errorf("source_loader: insert payment: %w", err)
		}
		count++
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("source_loader: iterate payments: %w", err)
	}
	if count == 0 {
		slog.Warn("source_loader: zero payment history rows loaded — reconciliation tier 2 will have no data",
			"batch_id", batchID)
	} else {
		slog.Info("source_loader: loaded payment history", "batch_id", batchID, "count", count)
	}
	return nil
}

// ─── Salary History Loaders (Tier 3a) ───────────────────────────────────────

// loadPRISMSalaryHistory loads annual salary data from PRISM_SAL_ANNUAL (pre-1998)
// and aggregated PRISM_SAL_PERIOD (post-1998) into canonical_salaries.
func loadPRISMSalaryHistory(migrationDB, sourceDB *sql.DB, batchID string) error {
	// UNION: pre-1998 annual totals + post-1998 period aggregates by year
	rows, err := sourceDB.Query(`
		SELECT CAST(EMP_NBR AS TEXT), TAX_YR, COALESCE(PENSION_EARN, GROSS_EARN)
		FROM src_prism.prism_sal_annual
		UNION ALL
		SELECT CAST(EMP_ID AS TEXT), EXTRACT(YEAR FROM PRD_END_DT)::INTEGER,
		       SUM(COALESCE(PENSION_PAY, GROSS_PAY))
		FROM src_prism.prism_sal_period
		GROUP BY EMP_ID, EXTRACT(YEAR FROM PRD_END_DT)
	`)
	if err != nil {
		return fmt.Errorf("source_loader: query PRISM salary history: %w", err)
	}
	defer rows.Close()

	return insertCanonicalSalaries(migrationDB, batchID, rows)
}

// loadPASSalaryHistory loads salary history from PAS salary_history, aggregated
// to annual totals per member.
func loadPASSalaryHistory(migrationDB, sourceDB *sql.DB, batchID string) error {
	rows, err := sourceDB.Query(`
		SELECT CAST(member_id AS TEXT),
		       EXTRACT(YEAR FROM period_begin_date)::INTEGER,
		       SUM(COALESCE(pensionable_earnings, reportable_earnings, 0))
		FROM src_pas.salary_history
		GROUP BY member_id, EXTRACT(YEAR FROM period_begin_date)
	`)
	if err != nil {
		return fmt.Errorf("source_loader: query PAS salary history: %w", err)
	}
	defer rows.Close()

	return insertCanonicalSalaries(migrationDB, batchID, rows)
}

func insertCanonicalSalaries(migrationDB *sql.DB, batchID string, rows *sql.Rows) error {
	count := 0
	for rows.Next() {
		var memberID string
		var salaryYear int
		var salaryAmount float64
		if err := rows.Scan(&memberID, &salaryYear, &salaryAmount); err != nil {
			return fmt.Errorf("source_loader: scan salary: %w", err)
		}
		_, err := migrationDB.Exec(
			`INSERT INTO migration.canonical_salaries
			 (batch_id, member_id, salary_year, salary_amount)
			 VALUES ($1, $2, $3, $4)`,
			batchID, memberID, salaryYear, salaryAmount,
		)
		if err != nil {
			return fmt.Errorf("source_loader: insert salary: %w", err)
		}
		count++
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("source_loader: iterate salaries: %w", err)
	}
	if count == 0 {
		slog.Warn("source_loader: zero salary history rows loaded — tier 3a will have no data",
			"batch_id", batchID)
	} else {
		slog.Info("source_loader: loaded salary history", "batch_id", batchID, "count", count)
	}
	return nil
}

// ─── Contribution Loaders (Tier 3b) ─────────────────────────────────────────

// loadPRISMContributions loads lifetime contribution totals per member from
// PRISM_CONTRIB_LEGACY (pre-1998) + PRISM_CONTRIB_HIST (post-1998).
// Uses CONTRIB tables only — NOT PRISM_SAL_ANNUAL.CONTRIB_AMT (double-counting).
func loadPRISMContributions(migrationDB, sourceDB *sql.DB, batchID string) error {
	rows, err := sourceDB.Query(`
		SELECT CAST(mbr AS TEXT), SUM(total) FROM (
			SELECT MBR_NBR AS mbr,
			       COALESCE(EE_CONTRIB, 0) + COALESCE(ER_CONTRIB, 0) AS total
			FROM src_prism.prism_contrib_legacy
			UNION ALL
			SELECT MBR_ID AS mbr,
			       COALESCE(EE_CONTRIB_AMT, 0) + COALESCE(ER_CONTRIB_AMT, 0) AS total
			FROM src_prism.prism_contrib_hist
		) combined
		GROUP BY mbr
	`)
	if err != nil {
		return fmt.Errorf("source_loader: query PRISM contributions: %w", err)
	}
	defer rows.Close()

	return insertCanonicalContributions(migrationDB, batchID, rows)
}

// loadPASContributions loads lifetime contribution totals per member from PAS.
func loadPASContributions(migrationDB, sourceDB *sql.DB, batchID string) error {
	rows, err := sourceDB.Query(`
		SELECT CAST(member_id AS TEXT),
		       SUM(COALESCE(member_contribution_amount, 0)
		         + COALESCE(employer_contribution_amount, 0)
		         + COALESCE(picked_up_amount, 0))
		FROM src_pas.contribution_history
		GROUP BY member_id
	`)
	if err != nil {
		return fmt.Errorf("source_loader: query PAS contributions: %w", err)
	}
	defer rows.Close()

	return insertCanonicalContributions(migrationDB, batchID, rows)
}

func insertCanonicalContributions(migrationDB *sql.DB, batchID string, rows *sql.Rows) error {
	count := 0
	for rows.Next() {
		var memberID string
		var amount float64
		if err := rows.Scan(&memberID, &amount); err != nil {
			return fmt.Errorf("source_loader: scan contribution: %w", err)
		}
		_, err := migrationDB.Exec(
			`INSERT INTO migration.canonical_contributions
			 (batch_id, member_id, contribution_amount)
			 VALUES ($1, $2, $3)`,
			batchID, memberID, amount,
		)
		if err != nil {
			return fmt.Errorf("source_loader: insert contribution: %w", err)
		}
		count++
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("source_loader: iterate contributions: %w", err)
	}
	if count == 0 {
		slog.Warn("source_loader: zero contribution rows loaded — tier 3b will have no data",
			"batch_id", batchID)
	} else {
		slog.Info("source_loader: loaded contributions", "batch_id", batchID, "count", count)
	}
	return nil
}

// ─── Service Credit + Employment Span Loaders (Tier 3c) ─────────────────────

// loadPRISMServiceCredit populates canonical_members with service_credit_years
// (from PRISM_SVC_CREDIT running balance) and employment_start (from HIRE_DT).
func loadPRISMServiceCredit(migrationDB, sourceDB *sql.DB, batchID string) error {
	// Get the most recent SVC_CR_BAL per member + hire date from PRISM_MEMBER
	rows, err := sourceDB.Query(`
		SELECT CAST(m.MBR_NBR AS TEXT),
		       sc.SVC_CR_BAL,
		       m.HIRE_DT,
		       m.RET_DT
		FROM src_prism.prism_member m
		LEFT JOIN LATERAL (
			SELECT SVC_CR_BAL FROM src_prism.prism_svc_credit
			WHERE MBR_NBR = m.MBR_NBR
			ORDER BY AS_OF_DT DESC LIMIT 1
		) sc ON true
	`)
	if err != nil {
		return fmt.Errorf("source_loader: query PRISM service credit: %w", err)
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var memberID string
		var svcCreditBal sql.NullFloat64
		var hireDt, retDt sql.NullString
		if err := rows.Scan(&memberID, &svcCreditBal, &hireDt, &retDt); err != nil {
			return fmt.Errorf("source_loader: scan PRISM service credit: %w", err)
		}

		_, err := migrationDB.Exec(
			`UPDATE migration.canonical_members
			 SET service_credit_years = $1,
			     employment_start = $2,
			     employment_end   = $3
			 WHERE batch_id = $4 AND member_id = $5`,
			nullFloat(svcCreditBal),
			parsePRISMDate(nullStr(hireDt)),
			parsePRISMDate(nullStr(retDt)),
			batchID, memberID,
		)
		if err != nil {
			return fmt.Errorf("source_loader: update canonical member service credit: %w", err)
		}
		count++
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("source_loader: iterate PRISM service credit: %w", err)
	}
	slog.Info("source_loader: updated service credit on canonical members (PRISM)",
		"batch_id", batchID, "count", count)
	return nil
}

// loadPASServiceCredit populates canonical_members with service_credit_years
// (from service_credit_history) and employment dates (from employment_segment).
func loadPASServiceCredit(migrationDB, sourceDB *sql.DB, batchID string) error {
	rows, err := sourceDB.Query(`
		SELECT CAST(m.member_id AS TEXT),
		       COALESCE(sc.total_credited, 0),
		       es.earliest_start,
		       es.latest_end
		FROM src_pas.member m
		LEFT JOIN LATERAL (
			SELECT SUM(credited_service_years) AS total_credited
			FROM src_pas.service_credit_history
			WHERE member_id = m.member_id AND purchased_flag = false
		) sc ON true
		LEFT JOIN LATERAL (
			SELECT MIN(segment_start_date) AS earliest_start,
			       MAX(segment_end_date)   AS latest_end
			FROM src_pas.employment_segment
			WHERE member_id = m.member_id
		) es ON true
	`)
	if err != nil {
		return fmt.Errorf("source_loader: query PAS service credit: %w", err)
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var memberID string
		var svcCredit float64
		var empStart, empEnd sql.NullTime
		if err := rows.Scan(&memberID, &svcCredit, &empStart, &empEnd); err != nil {
			return fmt.Errorf("source_loader: scan PAS service credit: %w", err)
		}

		_, err := migrationDB.Exec(
			`UPDATE migration.canonical_members
			 SET service_credit_years = $1,
			     employment_start = $2,
			     employment_end = $3
			 WHERE batch_id = $4 AND member_id = $5`,
			svcCredit, nullTime(empStart), nullTime(empEnd), batchID, memberID,
		)
		if err != nil {
			return fmt.Errorf("source_loader: update canonical member service credit (PAS): %w", err)
		}
		count++
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("source_loader: iterate PAS service credit: %w", err)
	}
	slog.Info("source_loader: updated service credit on canonical members (PAS)",
		"batch_id", batchID, "count", count)
	return nil
}

// ─── Helpers ────────────────────────────────────────────────────────────────

func nullFloat(v sql.NullFloat64) interface{} {
	if v.Valid {
		return v.Float64
	}
	return nil
}

func nullStr(v sql.NullString) string {
	if v.Valid {
		return v.String
	}
	return ""
}

func nullTime(v sql.NullTime) interface{} {
	if v.Valid {
		return v.Time
	}
	return nil
}

// parsePRISMDate attempts to parse PRISM's mixed-format VARCHAR dates.
// Formats: YYYYMMDD (post-1998), MMDDYYYY (pre-1998), YYYY-MM-DD, MM/DD/YYYY.
// Returns nil for empty or unparseable strings.
func parsePRISMDate(s string) interface{} {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	for _, layout := range []string{
		"20060102",   // YYYYMMDD
		"01022006",   // MMDDYYYY
		"2006-01-02", // ISO
		"01/02/2006", // US slash
		"1/2/2006",   // US slash (no zero-pad)
	} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	slog.Warn("source_loader: unparseable PRISM date", "value", s)
	return nil
}

// backfillCanonicalBenefitFromPayments sets canonical_benefit from the most
// recent REGULAR payment's gross_amount for members that still have NULL
// canonical_benefit. This enables Tier 2 reconciliation for source systems
// where the member record lacks a benefit field.
func backfillCanonicalBenefitFromPayments(migrationDB *sql.DB, batchID string) error {
	result, err := migrationDB.Exec(`
		UPDATE migration.canonical_members cm
		SET canonical_benefit = ph.gross_amount
		FROM (
			SELECT DISTINCT ON (member_id)
				member_id, gross_amount
			FROM migration.payment_history
			WHERE batch_id = $1 AND payment_type = 'REGULAR'
			ORDER BY member_id, payment_date DESC
		) ph
		WHERE cm.batch_id = $1
		  AND cm.member_id = ph.member_id
		  AND cm.canonical_benefit IS NULL
	`, batchID)
	if err != nil {
		return fmt.Errorf("backfill canonical_benefit: %w", err)
	}
	n, _ := result.RowsAffected()
	if n > 0 {
		slog.Info("source_loader: backfilled canonical_benefit from payment history",
			"batch_id", batchID, "count", n)
	}
	return nil
}
