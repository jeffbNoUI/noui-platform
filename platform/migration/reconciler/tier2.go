package reconciler

import (
	"database/sql"
	"fmt"
	"math/big"
)

// tier2Query selects members who have payment records but NO stored benefit
// calculations. For each such member, it extracts the most recent REGULAR
// payment's gross_amount and the canonical monthly_amount for comparison.
const tier2Query = `
SELECT
	cm.member_id,
	COALESCE(cm.member_status, ''),
	COALESCE(ph.gross_amount, '0'),
	COALESCE(cm.canonical_benefit, '0')
FROM migration.canonical_members cm
JOIN LATERAL (
	SELECT ph2.gross_amount
	FROM migration.payment_history ph2
	WHERE ph2.member_id = cm.member_id AND ph2.batch_id = cm.batch_id
	  AND ph2.payment_type = 'REGULAR'
	ORDER BY ph2.payment_date DESC
	LIMIT 1
) ph ON true
LEFT JOIN migration.stored_calculations sc ON sc.member_id = cm.member_id AND sc.batch_id = cm.batch_id
WHERE cm.batch_id = $1
  AND sc.member_id IS NULL
ORDER BY cm.member_id
`

// tier2Row represents a single row from the tier2Query result set.
type tier2Row struct {
	MemberID        string
	MemberStatus    string
	GrossAmount     string
	CanonicalAmount string
}

// tier2Tolerance is the ±2% threshold used to classify Tier 2 variances
// before falling through to the standard dollar-based thresholds.
var tier2Tolerance = new(big.Rat).SetFrac64(2, 100) // 0.02

// ReconcileTier2 performs Tier 2 (payment history) reconciliation for members
// in a batch that have payment records but lack stored benefit calculations.
// It compares the most recent regular payment amount against the canonical
// benefit value using a ±2% tolerance gate.
func ReconcileTier2(db *sql.DB, batchID string) ([]ReconciliationResult, error) {
	rows, err := db.Query(tier2Query, batchID)
	if err != nil {
		return nil, fmt.Errorf("reconciler: tier2 query failed: %w", err)
	}
	defer rows.Close()

	var results []ReconciliationResult

	for rows.Next() {
		var r tier2Row
		if err := rows.Scan(
			&r.MemberID,
			&r.MemberStatus,
			&r.GrossAmount,
			&r.CanonicalAmount,
		); err != nil {
			return nil, fmt.Errorf("reconciler: tier2 scan failed: %w", err)
		}

		result, err := reconcileTier2Row(r, batchID)
		if err != nil {
			// Record the error as an ERROR-category result rather than
			// aborting the entire batch.
			results = append(results, ReconciliationResult{
				MemberID:     r.MemberID,
				BatchID:      batchID,
				Tier:         Tier2PaymentHist,
				MemberStatus: MemberStatus(r.MemberStatus),
				Category:     CategoryError,
				Details:      err.Error(),
			})
			continue
		}
		results = append(results, *result)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reconciler: tier2 rows iteration error: %w", err)
	}

	return results, nil
}

// reconcileTier2Row processes a single member's payment-vs-canonical
// comparison and returns a ReconciliationResult.
func reconcileTier2Row(r tier2Row, batchID string) (*ReconciliationResult, error) {
	paymentAmt := new(big.Rat)
	if _, ok := paymentAmt.SetString(r.GrossAmount); !ok {
		return nil, fmt.Errorf("invalid gross_amount %q for member %s", r.GrossAmount, r.MemberID)
	}

	canonicalAmt := new(big.Rat)
	if _, ok := canonicalAmt.SetString(r.CanonicalAmount); !ok {
		return nil, fmt.Errorf("invalid canonical_benefit %q for member %s", r.CanonicalAmount, r.MemberID)
	}

	if canonicalAmt.Sign() == 0 {
		return nil, fmt.Errorf("zero canonical_benefit for member %s", r.MemberID)
	}

	category := classifyTier2Variance(paymentAmt, canonicalAmt)

	// Compute absolute variance for the result
	variance := new(big.Rat).Sub(paymentAmt, canonicalAmt)
	absVariance := new(big.Rat).Abs(variance)

	return &ReconciliationResult{
		MemberID:        r.MemberID,
		BatchID:         batchID,
		Tier:            Tier2PaymentHist,
		MemberStatus:    MemberStatus(r.MemberStatus),
		SourceValue:     r.GrossAmount,
		RecomputedValue: "", // Tier 2 has no recomputed value — payment is the source
		CanonicalValue:  r.CanonicalAmount,
		VarianceAmount:  RoundHalfUp(absVariance),
		Category:        category,
	}, nil
}

// classifyTier2Variance applies the ±2% tolerance gate for Tier 2
// reconciliation. If the percentage variance is within tolerance, it returns
// MATCH. Otherwise, it falls through to the standard dollar-based thresholds
// (MINOR/MAJOR).
func classifyTier2Variance(paymentAmount, canonicalAmount *big.Rat) VarianceCategory {
	if canonicalAmount.Sign() == 0 {
		return CategoryError
	}

	variance := new(big.Rat).Sub(paymentAmount, canonicalAmount)
	absVariance := new(big.Rat).Abs(variance)
	pctVariance := new(big.Rat).Quo(absVariance, new(big.Rat).Abs(canonicalAmount))

	if pctVariance.Cmp(tier2Tolerance) <= 0 {
		return CategoryMatch
	}

	return ClassifyVariance(variance) // standard MINOR/MAJOR thresholds
}
