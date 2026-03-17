// platform/preferences/contextkey/contextkey_test.go
package contextkey

import "testing"

func TestCompute_DeterministicForSameFlags(t *testing.T) {
	a := Compute(true, true, 2)
	b := Compute(true, true, 2)
	if a != b {
		t.Errorf("same flags produced different keys: %q vs %q", a, b)
	}
}

func TestCompute_DifferentForDifferentFlags(t *testing.T) {
	a := Compute(true, false, 1)
	b := Compute(false, false, 1)
	if a == b {
		t.Error("different flags produced the same key")
	}
}

func TestCompute_AllCombinations(t *testing.T) {
	seen := map[string]bool{}
	for _, dro := range []bool{true, false} {
		for _, early := range []bool{true, false} {
			for _, tier := range []int{1, 2, 3} {
				key := Compute(dro, early, tier)
				if key == "" {
					t.Error("empty key produced")
				}
				if seen[key] {
					t.Errorf("duplicate key: %s for dro=%v early=%v tier=%d", key, dro, early, tier)
				}
				seen[key] = true
			}
		}
	}
	if len(seen) != 12 {
		t.Errorf("expected 12 unique keys, got %d", len(seen))
	}
}
