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

func TestResolveSourceSystem_ExactMatch(t *testing.T) {
	tests := []struct {
		name     string
		explicit string
		want     string
	}{
		{"PRISM exact", "PRISM", "PRISM"},
		{"PAS exact", "PAS", "PAS"},
		{"prism lowercase", "prism", "PRISM"},
		{"pas lowercase", "pas", "PAS"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := resolveSourceSystem(tc.explicit, nil)
			if got != tc.want {
				t.Errorf("resolveSourceSystem(%q) = %q, want %q", tc.explicit, got, tc.want)
			}
		})
	}
}

func TestResolveSourceSystem_SubstringMatch(t *testing.T) {
	tests := []struct {
		name     string
		explicit string
		want     string
	}{
		{"E2E with PRISM", "E2E-PRISM-12345", "PRISM"},
		{"Legacy PAS name", "E2E-Legacy-PAS-1711234567", "PAS"},
		{"PRISM-prod", "PRISM-prod", "PRISM"},
		{"mixed case prism", "my-Prism-system", "PRISM"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := resolveSourceSystem(tc.explicit, nil)
			if got != tc.want {
				t.Errorf("resolveSourceSystem(%q) = %q, want %q", tc.explicit, got, tc.want)
			}
		})
	}
}

func TestResolveSourceSystem_UnknownFallback(t *testing.T) {
	// No DB provided, no match — returns uppercased input.
	got := resolveSourceSystem("SomeOtherSystem", nil)
	if got != "SOMEOTHERSYSTEM" {
		t.Errorf("resolveSourceSystem(SomeOtherSystem) = %q, want SOMEOTHERSYSTEM", got)
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
