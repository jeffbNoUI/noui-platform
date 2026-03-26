package profiler

import (
	"testing"
)

func TestMatchPensionPatterns_CYYMMDD(t *testing.T) {
	// AS400 century-encoded dates: 1YYMMDD format
	values := []string{"1250315", "1230101", "0991231", "1240601", "1200715"}
	results := MatchPensionPatterns(values)

	found := false
	for _, r := range results {
		if r.Pattern == "CYYMMDD" {
			found = true
			if r.Pct != 1.0 {
				t.Errorf("CYYMMDD pct = %f, want 1.0", r.Pct)
			}
			if r.Count != 5 {
				t.Errorf("CYYMMDD count = %d, want 5", r.Count)
			}
		}
	}
	if !found {
		t.Error("expected CYYMMDD pattern to be detected")
	}
}

func TestMatchPensionPatterns_YYYYMMDD(t *testing.T) {
	values := []string{"19650315", "19780822", "20010301", "20150615", "20230101"}
	results := MatchPensionPatterns(values)

	found := false
	for _, r := range results {
		if r.Pattern == "YYYYMMDD" {
			found = true
			if r.Pct != 1.0 {
				t.Errorf("YYYYMMDD pct = %f, want 1.0", r.Pct)
			}
		}
	}
	if !found {
		t.Error("expected YYYYMMDD pattern to be detected")
	}
}

func TestMatchPensionPatterns_SSN(t *testing.T) {
	values := []string{"123456789", "987654321", "111223333", "NotAnSSN", "444556666"}
	results := MatchPensionPatterns(values)

	found := false
	for _, r := range results {
		if r.Pattern == "SSN" {
			found = true
			if r.Count != 4 {
				t.Errorf("SSN count = %d, want 4", r.Count)
			}
			if r.Pct != 0.8 {
				t.Errorf("SSN pct = %f, want 0.8", r.Pct)
			}
		}
	}
	if !found {
		t.Error("expected SSN pattern to be detected")
	}
}

func TestMatchPensionPatterns_StatusCode(t *testing.T) {
	values := []string{"AC", "RT", "DI", "xx", "TE", "AC"}
	results := MatchPensionPatterns(values)

	found := false
	for _, r := range results {
		if r.Pattern == "STATUS_CODE" {
			found = true
			// 5 of 6 are uppercase alpha pairs: AC, RT, DI, TE, AC (xx is lowercase)
			if r.Count != 5 {
				t.Errorf("STATUS_CODE count = %d, want 5", r.Count)
			}
		}
	}
	if !found {
		t.Error("expected STATUS_CODE pattern to be detected")
	}
}

func TestMatchPensionPatterns_FiscalYear(t *testing.T) {
	values := []string{"2020", "2021", "2022", "2023", "1999"}
	results := MatchPensionPatterns(values)

	found := false
	for _, r := range results {
		if r.Pattern == "FISCAL_YEAR" {
			found = true
			if r.Pct != 1.0 {
				t.Errorf("FISCAL_YEAR pct = %f, want 1.0", r.Pct)
			}
		}
	}
	if !found {
		t.Error("expected FISCAL_YEAR pattern to be detected")
	}
}

func TestMatchPensionPatterns_MemberNum(t *testing.T) {
	values := []string{"A123456", "B7890123", "1234567", "C12345678", "short"}
	results := MatchPensionPatterns(values)

	found := false
	for _, r := range results {
		if r.Pattern == "MEMBER_NUM" {
			found = true
			if r.Count != 4 {
				t.Errorf("MEMBER_NUM count = %d, want 4", r.Count)
			}
		}
	}
	if !found {
		t.Error("expected MEMBER_NUM pattern to be detected")
	}
}

func TestMatchPensionPatterns_Empty(t *testing.T) {
	results := MatchPensionPatterns(nil)
	if results != nil {
		t.Errorf("expected nil for empty input, got %v", results)
	}

	results = MatchPensionPatterns([]string{})
	if results != nil {
		t.Errorf("expected nil for empty slice, got %v", results)
	}
}

func TestMatchPensionPatterns_NoMatch(t *testing.T) {
	// Long random strings that don't match any pattern
	values := []string{"hello world", "this is not a pattern", "random-text-123-abc"}
	results := MatchPensionPatterns(values)
	if len(results) != 0 {
		t.Errorf("expected no matches, got %d", len(results))
	}
}

func TestPensionPatternsCount(t *testing.T) {
	// Ensure we have exactly 9 pension patterns as specified in the design doc.
	if len(PensionPatterns) != 9 {
		t.Errorf("PensionPatterns count = %d, want 9", len(PensionPatterns))
	}
}
