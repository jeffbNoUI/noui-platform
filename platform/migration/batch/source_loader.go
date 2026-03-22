package batch

import (
	"database/sql"
	"fmt"
	"log/slog"
	"strings"
)

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

	switch strings.ToUpper(sourceSystem) {
	case "PRISM":
		if err := loadPRISMCalculations(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
		if err := loadPRISMPayments(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
	case "PAS":
		if err := loadPASCalculations(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
		if err := loadPASPayments(migrationDB, sourceDB, batchID); err != nil {
			return err
		}
	default:
		slog.Warn("source_loader: unknown source system, skipping reference data load",
			"source_system", sourceSystem, "batch_id", batchID)
	}

	return nil
}

// loadPRISMCalculations loads benefit calculations from PRISM_BENEFIT_CALC.
// Only current (C) calculations are loaded — superseded and voided are skipped.
func loadPRISMCalculations(migrationDB, sourceDB *sql.DB, batchID string) error {
	rows, err := sourceDB.Query(`
		SELECT
			CAST(c.MBR_NBR AS TEXT),
			COALESCE(CAST(c.YOS_USED AS TEXT), '0'),
			COALESCE(CAST(c.FAS_USED AS TEXT), '0'),
			COALESCE(c.AGE_AT_CALC::INTEGER, 0),
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

	return insertStoredCalculations(migrationDB, batchID, rows)
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

	return insertStoredCalculations(migrationDB, batchID, rows)
}

func insertStoredCalculations(migrationDB *sql.DB, batchID string, rows *sql.Rows) error {
	count := 0
	for rows.Next() {
		var memberID, yosUsed, fasUsed, planCode, storedBenefit string
		var ageAtCalc int
		if err := rows.Scan(&memberID, &yosUsed, &fasUsed, &ageAtCalc, &planCode, &storedBenefit); err != nil {
			return fmt.Errorf("source_loader: scan stored calc: %w", err)
		}
		_, err := migrationDB.Exec(
			`INSERT INTO migration.stored_calculations
			 (batch_id, member_id, yos_used, fas_used, age_at_calc, plan_code, stored_benefit)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			batchID, memberID, yosUsed, fasUsed, ageAtCalc, planCode, storedBenefit,
		)
		if err != nil {
			return fmt.Errorf("source_loader: insert stored calc: %w", err)
		}
		count++
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("source_loader: iterate stored calcs: %w", err)
	}
	slog.Info("source_loader: loaded stored calculations", "batch_id", batchID, "count", count)
	return nil
}

// loadPRISMPayments loads payment history from PRISM_PMT_HIST.
func loadPRISMPayments(migrationDB, sourceDB *sql.DB, batchID string) error {
	rows, err := sourceDB.Query(`
		SELECT
			CAST(h.MBR_NBR AS TEXT),
			COALESCE(s.SCHED_TYP, 'REGR'),
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
			COALESCE(payment_status_code, 'REGULAR'),
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
	slog.Info("source_loader: loaded payment history", "batch_id", batchID, "count", count)
	return nil
}
