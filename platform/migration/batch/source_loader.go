package batch

import (
	"database/sql"
	"fmt"
	"log/slog"
	"strings"
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

// LoadSourceReferenceData loads stored calculations, payment history, and
// demographic snapshots from the source database into migration staging tables.
// Tier 1 uses stored_calculations, tier 2 uses payment_history, tier 3 uses
// demographic_snapshot.
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
		if err := loadPRISMDemographics(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
	case "PAS":
		if err := loadPASCalculations(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
		if err := loadPASPayments(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
		if err := loadPASDemographics(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
	default:
		slog.Warn("source_loader: unknown source system, skipping reference data load",
			"source_system", sourceSystem, "resolved", resolved, "batch_id", batchID)
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

// ─── Tier 3: Demographic snapshot ──────────────────────────────────────────

// loadPRISMDemographics loads member demographic data from PRISM_MEMBER + PRISM_MEMBER_ADDR.
func loadPRISMDemographics(migrationDB, sourceDB *sql.DB, batchID string) error {
	rows, err := sourceDB.Query(`
		SELECT
			CAST(m.MBR_NBR AS TEXT),
			m.LAST_NM,
			m.FIRST_NM,
			CASE
				WHEN LENGTH(m.BIRTH_DT) = 8 AND m.BIRTH_DT ~ '^\d{4}\d{2}\d{2}$'
				THEN TO_DATE(m.BIRTH_DT, 'YYYYMMDD')
				WHEN LENGTH(m.BIRTH_DT) = 8 AND m.BIRTH_DT ~ '^\d{2}\d{2}\d{4}$'
				THEN TO_DATE(m.BIRTH_DT, 'MMDDYYYY')
				ELSE NULL
			END AS birth_date,
			CASE WHEN LENGTH(m.NATL_ID) >= 4
				THEN RIGHT(REPLACE(m.NATL_ID, '-', ''), 4)
				ELSE NULL
			END AS ssn_last4,
			m.GNDR_CD,
			m.MAR_STS_CD,
			m.EMPR_CD,
			m.HIRE_DT::DATE,
			m.STATUS_CD,
			a.ADDR_LINE1,
			a.CITY,
			a.STATE_CD,
			a.ZIP_CD,
			m.EMAIL_ADDR
		FROM src_prism.prism_member m
		LEFT JOIN (
			SELECT DISTINCT ON (MBR_NBR) *
			FROM src_prism.prism_member_addr
			WHERE ADDR_TYP_CD = 'RES' AND END_DT IS NULL
			ORDER BY MBR_NBR, EFF_DT DESC
		) a ON a.MBR_NBR = m.MBR_NBR
	`)
	if err != nil {
		return fmt.Errorf("source_loader: query PRISM demographics: %w", err)
	}
	defer rows.Close()

	return insertDemographicSnapshot(migrationDB, batchID, rows)
}

// loadPASDemographics loads member demographic data from PAS member + member_address.
func loadPASDemographics(migrationDB, sourceDB *sql.DB, batchID string) error {
	rows, err := sourceDB.Query(`
		SELECT
			CAST(m.member_id AS TEXT),
			m.last_name,
			m.first_name,
			m.date_of_birth,
			CASE WHEN LENGTH(m.ssn) >= 4
				THEN RIGHT(REPLACE(m.ssn, '-', ''), 4)
				ELSE NULL
			END AS ssn_last4,
			m.gender,
			m.marital_status,
			COALESCE(es.employer_id::TEXT, ''),
			m.enrollment_date,
			m.status_code,
			a.address_line_1,
			a.city,
			a.state_code,
			a.postal_code,
			c.contact_value AS email
		FROM src_pas.member m
		LEFT JOIN (
			SELECT DISTINCT ON (member_id) *
			FROM src_pas.member_address
			WHERE address_type = 'HOME'
			ORDER BY member_id, effective_date DESC
		) a ON a.member_id = m.member_id
		LEFT JOIN (
			SELECT DISTINCT ON (member_id) *
			FROM src_pas.member_contact
			WHERE contact_type = 'EMAIL'
			ORDER BY member_id, effective_date DESC
		) c ON c.member_id = m.member_id
		LEFT JOIN (
			SELECT DISTINCT ON (member_id) *
			FROM src_pas.employment_segment
			ORDER BY member_id, start_date DESC
		) es ON es.member_id = m.member_id
	`)
	if err != nil {
		return fmt.Errorf("source_loader: query PAS demographics: %w", err)
	}
	defer rows.Close()

	return insertDemographicSnapshot(migrationDB, batchID, rows)
}

func insertDemographicSnapshot(migrationDB *sql.DB, batchID string, rows *sql.Rows) error {
	count := 0
	for rows.Next() {
		var memberID string
		var lastName, firstName, ssn4, gender, marital, employer, status sql.NullString
		var addressLine1, city, stateCode, zipCode, email sql.NullString
		var birthDate, hireDate sql.NullTime

		if err := rows.Scan(
			&memberID, &lastName, &firstName, &birthDate, &ssn4,
			&gender, &marital, &employer, &hireDate, &status,
			&addressLine1, &city, &stateCode, &zipCode, &email,
		); err != nil {
			return fmt.Errorf("source_loader: scan demographic: %w", err)
		}

		_, err := migrationDB.Exec(
			`INSERT INTO migration.demographic_snapshot
			 (batch_id, member_id, last_name, first_name, birth_date, ssn_last4,
			  gender, marital_status, employer_code, hire_date, status_code,
			  address_line1, city, state_code, zip_code, email)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
			batchID, memberID,
			nullStr(lastName), nullStr(firstName), nullTime(birthDate), nullStr(ssn4),
			nullStr(gender), nullStr(marital), nullStr(employer), nullTime(hireDate), nullStr(status),
			nullStr(addressLine1), nullStr(city), nullStr(stateCode), nullStr(zipCode), nullStr(email),
		)
		if err != nil {
			return fmt.Errorf("source_loader: insert demographic: %w", err)
		}
		count++
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("source_loader: iterate demographics: %w", err)
	}
	if count == 0 {
		slog.Warn("source_loader: zero demographic rows loaded — reconciliation tier 3 will have no data",
			"batch_id", batchID)
	} else {
		slog.Info("source_loader: loaded demographic snapshot", "batch_id", batchID, "count", count)
	}
	return nil
}

// nullStr converts sql.NullString to *string for parameterized queries.
func nullStr(ns sql.NullString) interface{} {
	if ns.Valid {
		return ns.String
	}
	return nil
}

// nullTime converts sql.NullTime to *time.Time for parameterized queries.
func nullTime(nt sql.NullTime) interface{} {
	if nt.Valid {
		return nt.Time
	}
	return nil
}
