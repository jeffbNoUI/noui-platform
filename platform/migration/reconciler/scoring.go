// Package reconciler — scoring.go implements the weighted reconciliation gate
// with P1/P2/P3 priority classification for migration approval decisions.
package reconciler

import "fmt"

// Priority classifies the urgency of a reconciliation issue.
type Priority string

const (
	PriorityP1 Priority = "P1" // Critical — blocks approval
	PriorityP2 Priority = "P2" // Important — requires review
	PriorityP3 Priority = "P3" // Advisory
)

// PrioritizedResult wraps a ReconciliationResult with its assigned priority.
type PrioritizedResult struct {
	ReconciliationResult
	Priority Priority `json:"priority"`
}

// GateResult summarises the weighted scoring gate outcome for a reconciliation
// batch. The gate controls whether a migration batch may proceed to approval.
type GateResult struct {
	WeightedScore   float64  `json:"weighted_score"`
	TotalMembers    int      `json:"total_members"`
	MatchCount      int      `json:"match_count"`
	MinorCount      int      `json:"minor_count"`
	MajorCount      int      `json:"major_count"`
	ErrorCount      int      `json:"error_count"`
	P1Unresolved    int      `json:"p1_unresolved"`
	P2Unresolved    int      `json:"p2_unresolved"`
	P3Count         int      `json:"p3_count"`
	GatePassed      bool     `json:"gate_passed"`
	GateFailReasons []string `json:"gate_fail_reasons,omitempty"`
}

// gateThreshold is the minimum weighted score required for the gate to pass.
const gateThreshold = 0.95

// ComputeGate evaluates the weighted scoring gate over a set of reconciliation
// results. Tier 3 (AGGREGATE) results are excluded from the weighted score
// denominator — they contribute only to the P3 advisory count.
//
// Gate formula:
//
//	weighted_score = (match_count * 1.0 + minor_count * 0.5) / (total_tier1 + total_tier2)
//	gate_passed    = weighted_score >= 0.95 AND p1_unresolved == 0
func ComputeGate(results []ReconciliationResult) GateResult {
	var g GateResult

	// Denominator: count of Tier 1 + Tier 2 results only.
	var denominator int

	for _, r := range results {
		g.TotalMembers++

		if r.Tier == Tier3Aggregate {
			// Tier 3 results contribute to P3 count only.
			p := AssignPriority(r)
			if p == PriorityP3 {
				g.P3Count++
			}
			continue
		}

		denominator++

		switch r.Category {
		case CategoryMatch:
			g.MatchCount++
		case CategoryMinor:
			g.MinorCount++
		case CategoryMajor:
			g.MajorCount++
		case CategoryError:
			g.ErrorCount++
		}
	}

	// Compute weighted score.
	if denominator == 0 {
		// No Tier 1/Tier 2 results — gate passes vacuously.
		g.WeightedScore = 1.0
	} else {
		g.WeightedScore = (float64(g.MatchCount)*1.0 + float64(g.MinorCount)*0.5) / float64(denominator)
	}

	// Count P1/P2 from prioritized results.
	for _, pr := range PrioritizeResults(results) {
		switch pr.Priority {
		case PriorityP1:
			g.P1Unresolved++
		case PriorityP2:
			g.P2Unresolved++
		}
	}

	// Evaluate gate.
	g.GatePassed = true
	if g.WeightedScore < gateThreshold {
		g.GatePassed = false
		g.GateFailReasons = append(g.GateFailReasons,
			fmt.Sprintf("weighted score %.2f below threshold 0.95", g.WeightedScore))
	}
	if g.P1Unresolved > 0 {
		g.GatePassed = false
		g.GateFailReasons = append(g.GateFailReasons,
			fmt.Sprintf("%d P1 issues unresolved", g.P1Unresolved))
	}

	return g
}

// AssignPriority determines the priority level for a single reconciliation
// result based on member status, variance category, and tier.
//
// Rules:
//   - Retiree + ANY mismatch (even MINOR) -> P1
//   - Any MAJOR -> P1
//   - Any ERROR -> P1
//   - MINOR on active member -> P2
//   - MINOR on deferred member -> P2
//   - Tier 3 outlier (any) -> P3
//   - MATCH -> "" (not prioritized)
func AssignPriority(r ReconciliationResult) Priority {
	// MATCH results are never prioritized.
	if r.Category == CategoryMatch {
		return ""
	}

	// Tier 3 results are always advisory.
	if r.Tier == Tier3Aggregate {
		return PriorityP3
	}

	// ERROR is always P1.
	if r.Category == CategoryError {
		return PriorityP1
	}

	// MAJOR is always P1.
	if r.Category == CategoryMajor {
		return PriorityP1
	}

	// MINOR category — priority depends on member status.
	if r.Category == CategoryMinor {
		if r.MemberStatus == StatusRetiree {
			return PriorityP1
		}
		// Active or deferred -> P2
		return PriorityP2
	}

	return ""
}

// PrioritizeResults assigns priorities to all results and returns only those
// that have a non-empty priority (i.e., excludes MATCH results).
func PrioritizeResults(results []ReconciliationResult) []PrioritizedResult {
	var prioritized []PrioritizedResult

	for _, r := range results {
		p := AssignPriority(r)
		if p == "" {
			continue
		}
		prioritized = append(prioritized, PrioritizedResult{
			ReconciliationResult: r,
			Priority:             p,
		})
	}

	return prioritized
}
