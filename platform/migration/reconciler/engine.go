// Package reconciler implements tiered reconciliation of migrated pension
// benefit data. Tier 1 compares stored legacy calculations against values
// recomputed from stored inputs using deterministic benefit formulas.
package reconciler

import (
	"math/big"
)

// VarianceCategory classifies the magnitude of a reconciliation difference.
type VarianceCategory string

const (
	CategoryMatch VarianceCategory = "MATCH" // ≤$0.50
	CategoryMinor VarianceCategory = "MINOR" // <$25.00
	CategoryMajor VarianceCategory = "MAJOR" // ≥$25.00
	CategoryError VarianceCategory = "ERROR" // computation error
)

// ReconciliationTier identifies which reconciliation tier produced a result.
type ReconciliationTier string

const (
	Tier1StoredCalc  ReconciliationTier = "TIER1"
	Tier2PaymentHist ReconciliationTier = "TIER2"
	Tier3Aggregate   ReconciliationTier = "TIER3"
)

// MemberStatus describes the current status of a pension plan member.
type MemberStatus string

const (
	StatusRetiree  MemberStatus = "RETIREE"
	StatusActive   MemberStatus = "ACTIVE"
	StatusDeferred MemberStatus = "DEFERRED"
)

// ReconciliationResult captures the outcome of reconciling a single member's
// benefit calculation at a given tier.
type ReconciliationResult struct {
	MemberID        string             `json:"member_id"`
	BatchID         string             `json:"batch_id"`
	Tier            ReconciliationTier `json:"tier"`
	MemberStatus    MemberStatus       `json:"member_status"`
	SourceValue     string             `json:"source_value"`
	RecomputedValue string             `json:"recomputed_value"`
	CanonicalValue  string             `json:"canonical_value"`
	VarianceAmount  string             `json:"variance_amount"`
	Category        VarianceCategory   `json:"category"`
	SuspectedDomain string             `json:"suspected_domain,omitempty"`
	Details         string             `json:"details,omitempty"`
}

// variance thresholds as *big.Rat for comparison (read-only — never mutate)
var (
	thresholdMatch = new(big.Rat).SetFrac64(1, 2)  // 0.50
	thresholdMajor = new(big.Rat).SetFrac64(25, 1) // 25.00
)

// ClassifyVariance determines the VarianceCategory for a given absolute
// variance amount.
func ClassifyVariance(varianceAmount *big.Rat) VarianceCategory {
	abs := new(big.Rat).Set(varianceAmount)
	if abs.Sign() < 0 {
		abs.Neg(abs)
	}

	switch {
	case abs.Cmp(thresholdMatch) <= 0:
		return CategoryMatch
	case abs.Cmp(thresholdMajor) < 0:
		return CategoryMinor
	default:
		return CategoryMajor
	}
}
