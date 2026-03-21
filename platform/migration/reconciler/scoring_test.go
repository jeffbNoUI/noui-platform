package reconciler

import (
	"math"
	"testing"
)

// makeResult is a helper to construct a ReconciliationResult with the fields
// relevant to scoring/priority.
func makeResult(tier ReconciliationTier, status MemberStatus, category VarianceCategory) ReconciliationResult {
	return ReconciliationResult{
		MemberID:     "M-001",
		BatchID:      "batch-001",
		Tier:         tier,
		MemberStatus: status,
		Category:     category,
	}
}

// makeResults generates n identical ReconciliationResults.
func makeResults(n int, tier ReconciliationTier, status MemberStatus, category VarianceCategory) []ReconciliationResult {
	results := make([]ReconciliationResult, n)
	for i := range results {
		r := makeResult(tier, status, category)
		r.MemberID = "M-" + string(rune('0'+i/100)) + string(rune('0'+(i/10)%10)) + string(rune('0'+i%10))
		results[i] = r
	}
	return results
}

func floatEqual(a, b float64) bool {
	return math.Abs(a-b) < 0.001
}

// --- Test 1: Clean batch — 100 MATCH -> gate passes, score 1.00 ---

func TestComputeGate_CleanBatch(t *testing.T) {
	results := makeResults(100, Tier1StoredCalc, StatusActive, CategoryMatch)

	g := ComputeGate(results)

	if !g.GatePassed {
		t.Errorf("expected gate to pass, got fail: %v", g.GateFailReasons)
	}
	if !floatEqual(g.WeightedScore, 1.0) {
		t.Errorf("expected score 1.00, got %.4f", g.WeightedScore)
	}
	if g.MatchCount != 100 {
		t.Errorf("expected 100 matches, got %d", g.MatchCount)
	}
	if g.P1Unresolved != 0 {
		t.Errorf("expected 0 P1, got %d", g.P1Unresolved)
	}
}

// --- Test 2: Gate fails on P1 — 99 MATCH + 1 retiree MINOR ---

func TestComputeGate_FailsOnP1(t *testing.T) {
	results := makeResults(99, Tier1StoredCalc, StatusActive, CategoryMatch)
	retireeMinor := makeResult(Tier1StoredCalc, StatusRetiree, CategoryMinor)
	results = append(results, retireeMinor)

	g := ComputeGate(results)

	if g.GatePassed {
		t.Error("expected gate to fail due to P1 issue")
	}
	if g.P1Unresolved != 1 {
		t.Errorf("expected 1 P1, got %d", g.P1Unresolved)
	}
	// Score: (99*1.0 + 1*0.5) / 100 = 0.995 — above threshold
	if !floatEqual(g.WeightedScore, 0.995) {
		t.Errorf("expected score 0.995, got %.4f", g.WeightedScore)
	}
}

// --- Test 3: Gate fails on score — 89 MATCH + 11 MINOR (active) ---

func TestComputeGate_FailsOnScore(t *testing.T) {
	results := makeResults(89, Tier1StoredCalc, StatusActive, CategoryMatch)
	results = append(results, makeResults(11, Tier1StoredCalc, StatusActive, CategoryMinor)...)

	g := ComputeGate(results)

	if g.GatePassed {
		t.Error("expected gate to fail due to low score")
	}
	// Score: (89 + 5.5) / 100 = 0.945
	if !floatEqual(g.WeightedScore, 0.945) {
		t.Errorf("expected score 0.945, got %.4f", g.WeightedScore)
	}
}

// --- Test 4: Gate passes at boundary — 90 MATCH + 10 MINOR (active) ---

func TestComputeGate_PassesAtBoundary(t *testing.T) {
	results := makeResults(90, Tier1StoredCalc, StatusActive, CategoryMatch)
	results = append(results, makeResults(10, Tier1StoredCalc, StatusActive, CategoryMinor)...)

	g := ComputeGate(results)

	if !g.GatePassed {
		t.Errorf("expected gate to pass at boundary, got fail: %v", g.GateFailReasons)
	}
	// Score: (90 + 5) / 100 = 0.95
	if !floatEqual(g.WeightedScore, 0.95) {
		t.Errorf("expected score 0.950, got %.4f", g.WeightedScore)
	}
}

// --- Test 5: P1 escalation for retiree MINOR ---

func TestAssignPriority_RetireeMinor(t *testing.T) {
	r := makeResult(Tier1StoredCalc, StatusRetiree, CategoryMinor)

	p := AssignPriority(r)

	if p != PriorityP1 {
		t.Errorf("expected P1 for retiree MINOR, got %q", p)
	}
}

// --- Test 6: P1 escalation for MAJOR ---

func TestAssignPriority_ActiveMajor(t *testing.T) {
	r := makeResult(Tier1StoredCalc, StatusActive, CategoryMajor)

	p := AssignPriority(r)

	if p != PriorityP1 {
		t.Errorf("expected P1 for MAJOR, got %q", p)
	}
}

// --- Test 7: P2 for active MINOR ---

func TestAssignPriority_ActiveMinor(t *testing.T) {
	r := makeResult(Tier2PaymentHist, StatusActive, CategoryMinor)

	p := AssignPriority(r)

	if p != PriorityP2 {
		t.Errorf("expected P2 for active MINOR, got %q", p)
	}
}

// --- Test 8: P3 for Tier 3 ---

func TestAssignPriority_Tier3Outlier(t *testing.T) {
	r := makeResult(Tier3Aggregate, StatusActive, CategoryMinor)

	p := AssignPriority(r)

	if p != PriorityP3 {
		t.Errorf("expected P3 for Tier 3 outlier, got %q", p)
	}
}

// --- Test 9: Mixed tiers — correct counts ---

func TestComputeGate_MixedTiers(t *testing.T) {
	var results []ReconciliationResult

	// 50 Tier 1 MATCH
	results = append(results, makeResults(50, Tier1StoredCalc, StatusActive, CategoryMatch)...)
	// 30 Tier 2 MATCH
	results = append(results, makeResults(30, Tier2PaymentHist, StatusActive, CategoryMatch)...)
	// 5 Tier 1 MINOR (active) -> P2
	results = append(results, makeResults(5, Tier1StoredCalc, StatusActive, CategoryMinor)...)
	// 2 Tier 2 MAJOR -> P1
	results = append(results, makeResults(2, Tier2PaymentHist, StatusActive, CategoryMajor)...)
	// 1 Tier 1 ERROR -> P1
	results = append(results, makeResult(Tier1StoredCalc, StatusActive, CategoryError))
	// 3 Tier 3 outliers -> P3 (excluded from denominator)
	results = append(results, makeResults(3, Tier3Aggregate, StatusActive, CategoryMinor)...)

	g := ComputeGate(results)

	// Denominator = 50+30+5+2+1 = 88 (Tier 1 + Tier 2 only)
	// MatchCount = 80, MinorCount = 5, MajorCount = 2, ErrorCount = 1
	if g.MatchCount != 80 {
		t.Errorf("expected 80 matches, got %d", g.MatchCount)
	}
	if g.MinorCount != 5 {
		t.Errorf("expected 5 minor, got %d", g.MinorCount)
	}
	if g.MajorCount != 2 {
		t.Errorf("expected 2 major, got %d", g.MajorCount)
	}
	if g.ErrorCount != 1 {
		t.Errorf("expected 1 error, got %d", g.ErrorCount)
	}
	if g.P3Count != 3 {
		t.Errorf("expected 3 P3, got %d", g.P3Count)
	}

	// Score: (80 + 2.5) / 88 = 0.9375
	if !floatEqual(g.WeightedScore, 0.9375) {
		t.Errorf("expected score 0.9375, got %.4f", g.WeightedScore)
	}

	// P1 = 2 MAJOR + 1 ERROR = 3
	if g.P1Unresolved != 3 {
		t.Errorf("expected 3 P1, got %d", g.P1Unresolved)
	}
	// P2 = 5 active MINOR
	if g.P2Unresolved != 5 {
		t.Errorf("expected 5 P2, got %d", g.P2Unresolved)
	}

	if g.GatePassed {
		t.Error("expected gate to fail")
	}
}

// --- Test 10: Empty results — gate passes ---

func TestComputeGate_EmptyResults(t *testing.T) {
	g := ComputeGate(nil)

	if !g.GatePassed {
		t.Errorf("expected gate to pass for empty results, got fail: %v", g.GateFailReasons)
	}
	if !floatEqual(g.WeightedScore, 1.0) {
		t.Errorf("expected score 1.0, got %.4f", g.WeightedScore)
	}
}

// --- Test 11: All errors — gate fails ---

func TestComputeGate_AllErrors(t *testing.T) {
	results := makeResults(5, Tier1StoredCalc, StatusActive, CategoryError)

	g := ComputeGate(results)

	if g.GatePassed {
		t.Error("expected gate to fail for all errors")
	}
	if g.ErrorCount != 5 {
		t.Errorf("expected 5 errors, got %d", g.ErrorCount)
	}
	if !floatEqual(g.WeightedScore, 0.0) {
		t.Errorf("expected score 0.0, got %.4f", g.WeightedScore)
	}
	if g.P1Unresolved != 5 {
		t.Errorf("expected 5 P1, got %d", g.P1Unresolved)
	}
}

// --- PrioritizeResults tests ---

func TestPrioritizeResults_ExcludesMatches(t *testing.T) {
	results := []ReconciliationResult{
		makeResult(Tier1StoredCalc, StatusActive, CategoryMatch),
		makeResult(Tier1StoredCalc, StatusActive, CategoryMinor),
		makeResult(Tier3Aggregate, StatusActive, CategoryMajor),
	}

	prioritized := PrioritizeResults(results)

	if len(prioritized) != 2 {
		t.Errorf("expected 2 prioritized results, got %d", len(prioritized))
	}
}

func TestAssignPriority_Match_NoPriority(t *testing.T) {
	r := makeResult(Tier1StoredCalc, StatusActive, CategoryMatch)

	p := AssignPriority(r)

	if p != "" {
		t.Errorf("expected empty priority for MATCH, got %q", p)
	}
}

func TestAssignPriority_DeferredMinor_P2(t *testing.T) {
	r := makeResult(Tier1StoredCalc, StatusDeferred, CategoryMinor)

	p := AssignPriority(r)

	if p != PriorityP2 {
		t.Errorf("expected P2 for deferred MINOR, got %q", p)
	}
}

func TestAssignPriority_Error_P1(t *testing.T) {
	r := makeResult(Tier2PaymentHist, StatusDeferred, CategoryError)

	p := AssignPriority(r)

	if p != PriorityP1 {
		t.Errorf("expected P1 for ERROR, got %q", p)
	}
}
