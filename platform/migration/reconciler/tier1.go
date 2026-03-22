package reconciler

import (
	"database/sql"
	"fmt"
	"math/big"
)

// tier1Query selects members with stored legacy calculations for a given
// batch, joining the canonical member table with stored benefit calculations.
const tier1Query = `
SELECT
	cm.member_id,
	cm.member_status,
	COALESCE(sc.yos_used, '0'),
	COALESCE(sc.fas_used, '0'),
	COALESCE(sc.age_at_calc, 0),
	COALESCE(sc.plan_code, 'DB_MAIN'),
	COALESCE(sc.stored_benefit, '0'),
	COALESCE(cm.canonical_benefit, '0')
FROM migration.canonical_members cm
JOIN migration.stored_calculations sc ON sc.member_id = cm.member_id AND sc.batch_id = cm.batch_id
WHERE cm.batch_id = $1
ORDER BY cm.member_id
`

// tier1Row represents a single row from the tier1Query result set.
type tier1Row struct {
	MemberID         string
	MemberStatus     string
	YOSUsed          string
	FASUsed          string
	AgeAtCalc        int
	PlanCode         string
	StoredBenefit    string
	CanonicalBenefit string
}

// ReconcileTier1 performs Tier 1 (stored calculation) reconciliation for all
// members in a batch. It recomputes each member's benefit from stored inputs,
// then compares the recomputed value against both the legacy stored value and
// the canonical migrated value.
func ReconcileTier1(db *sql.DB, batchID string) ([]ReconciliationResult, error) {
	rows, err := db.Query(tier1Query, batchID)
	if err != nil {
		return nil, fmt.Errorf("reconciler: tier1 query failed: %w", err)
	}
	defer rows.Close()

	var results []ReconciliationResult

	for rows.Next() {
		var r tier1Row
		if err := rows.Scan(
			&r.MemberID,
			&r.MemberStatus,
			&r.YOSUsed,
			&r.FASUsed,
			&r.AgeAtCalc,
			&r.PlanCode,
			&r.StoredBenefit,
			&r.CanonicalBenefit,
		); err != nil {
			return nil, fmt.Errorf("reconciler: tier1 scan failed: %w", err)
		}

		result, err := reconcileTier1Row(r, batchID)
		if err != nil {
			// Record the error as an ERROR-category result rather than
			// aborting the entire batch.
			results = append(results, ReconciliationResult{
				MemberID:     r.MemberID,
				BatchID:      batchID,
				Tier:         Tier1StoredCalc,
				MemberStatus: MemberStatus(r.MemberStatus),
				Category:     CategoryError,
				Details:      err.Error(),
			})
			continue
		}
		results = append(results, *result)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reconciler: tier1 rows iteration error: %w", err)
	}

	return results, nil
}

// reconcileTier1Row processes a single member's stored calculation data:
// recomputes the benefit, compares against the source (legacy) stored value,
// and returns a ReconciliationResult based on the variance.
func reconcileTier1Row(r tier1Row, batchID string) (*ReconciliationResult, error) {
	yos := new(big.Rat)
	if _, ok := yos.SetString(r.YOSUsed); !ok {
		return nil, fmt.Errorf("invalid yos_used %q for member %s", r.YOSUsed, r.MemberID)
	}

	fas := new(big.Rat)
	if _, ok := fas.SetString(r.FASUsed); !ok {
		return nil, fmt.Errorf("invalid fas_used %q for member %s", r.FASUsed, r.MemberID)
	}

	recomputed := RecomputeFromStoredInputs(yos, fas, r.AgeAtCalc, r.PlanCode)
	if recomputed == nil {
		return nil, fmt.Errorf("unknown plan_code %q for member %s", r.PlanCode, r.MemberID)
	}

	storedVal := new(big.Rat)
	if _, ok := storedVal.SetString(r.StoredBenefit); !ok {
		return nil, fmt.Errorf("invalid stored_benefit %q for member %s", r.StoredBenefit, r.MemberID)
	}

	// Variance = recomputed - stored (source)
	variance := new(big.Rat).Sub(recomputed, storedVal)
	absVariance := new(big.Rat).Set(variance)
	if absVariance.Sign() < 0 {
		absVariance.Neg(absVariance)
	}

	category := ClassifyVariance(variance)

	// Build suspected domain hint for non-MATCH results
	var suspected string
	if category != CategoryMatch {
		suspected = guessDomain(variance, storedVal, recomputed)
	}

	return &ReconciliationResult{
		MemberID:        r.MemberID,
		BatchID:         batchID,
		Tier:            Tier1StoredCalc,
		MemberStatus:    MemberStatus(r.MemberStatus),
		SourceValue:     r.StoredBenefit,
		RecomputedValue: RoundHalfUp(recomputed),
		CanonicalValue:  r.CanonicalBenefit,
		VarianceAmount:  RoundHalfUp(absVariance),
		Category:        category,
		SuspectedDomain: suspected,
	}, nil
}

// guessDomain provides a hint about the likely source of a variance.
func guessDomain(variance, stored, recomputed *big.Rat) string {
	absVar := new(big.Rat).Set(variance)
	if absVar.Sign() < 0 {
		absVar.Neg(absVar)
	}

	// If variance is very small relative to the benefit, likely a rounding issue
	if stored.Sign() != 0 {
		pct := new(big.Rat).Quo(absVar, stored)
		onePct := new(big.Rat).SetFrac64(1, 100)
		if pct.Cmp(onePct) < 0 {
			return "ROUNDING"
		}
	}

	return "FORMULA_PARAMETERS"
}
