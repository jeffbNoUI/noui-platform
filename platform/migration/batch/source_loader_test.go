package batch

import "testing"

func TestNormalizePlanCode_PRISMMapping(t *testing.T) {
	tests := []struct {
		input         string
		wantCanonical string
		wantOriginal  string
	}{
		{"DB_MAIN", "TIER_1", "DB_MAIN"},
		{"DB_T1", "TIER_1", "DB_T1"},
		{"DB_T2", "TIER_2", "DB_T2"},
		{"DB_T3", "TIER_3", "DB_T3"},
		{"UNKNOWN", "UNKNOWN", "UNKNOWN"},
	}
	for _, tt := range tests {
		canonical, original := normalizePlanCode(tt.input, prismPlanCodeMap)
		if canonical != tt.wantCanonical {
			t.Errorf("normalizePlanCode(%q, prism): canonical = %q, want %q", tt.input, canonical, tt.wantCanonical)
		}
		if original != tt.wantOriginal {
			t.Errorf("normalizePlanCode(%q, prism): original = %q, want %q", tt.input, original, tt.wantOriginal)
		}
	}
}

func TestNormalizePlanCode_PASMapping(t *testing.T) {
	tests := []struct {
		input         string
		wantCanonical string
		wantOriginal  string
	}{
		{"DB-T1", "TIER_1", "DB-T1"},
		{"DB-T2", "TIER_2", "DB-T2"},
		{"DB-T3", "TIER_3", "DB-T3"},
		{"DB_MAIN", "DB_MAIN", "DB_MAIN"}, // Not in PAS map — passthrough
	}
	for _, tt := range tests {
		canonical, original := normalizePlanCode(tt.input, pasPlanCodeMap)
		if canonical != tt.wantCanonical {
			t.Errorf("normalizePlanCode(%q, pas): canonical = %q, want %q", tt.input, canonical, tt.wantCanonical)
		}
		if original != tt.wantOriginal {
			t.Errorf("normalizePlanCode(%q, pas): original = %q, want %q", tt.input, original, tt.wantOriginal)
		}
	}
}
