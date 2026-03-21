package mapper

import "testing"

func TestNormalizedEditDistance(t *testing.T) {
	tests := []struct {
		a, b string
		want float64
	}{
		{"abc", "abc", 0.0},
		{"", "abc", 1.0},
		{"abc", "", 1.0},
		{"kitten", "sitting", 0.4285}, // 3/7
	}
	for _, tt := range tests {
		got := NormalizedEditDistance(tt.a, tt.b)
		if got < tt.want-0.01 || got > tt.want+0.01 {
			t.Errorf("NormalizedEditDistance(%q, %q) = %.4f, want ~%.4f", tt.a, tt.b, got, tt.want)
		}
	}
}

func TestTokenOverlap(t *testing.T) {
	tests := []struct {
		a, b     string
		minScore float64
		maxScore float64
	}{
		{"birth_date", "birth_date", 0.99, 1.01},
		{"salary_amount", "gross_amount", 0.3, 0.6},
		{"xyz", "abc", 0.0, 0.01},
		{"first_name", "first_nm", 0.3, 0.6},
	}
	for _, tt := range tests {
		got := TokenOverlap(tt.a, tt.b)
		if got < tt.minScore || got > tt.maxScore {
			t.Errorf("TokenOverlap(%q, %q) = %.3f, want [%.2f, %.2f]", tt.a, tt.b, got, tt.minScore, tt.maxScore)
		}
	}
}

func TestColumnNameSimilarity(t *testing.T) {
	tests := []struct {
		source, target string
		minScore       float64
		maxScore       float64
	}{
		// Exact match
		{"birth_date", "birth_date", 0.95, 1.01},
		// Case insensitive
		{"BIRTH_DATE", "birth_date", 0.95, 1.01},
		// Abbreviated
		{"birth_dt", "birth_date", 0.55, 0.85},
		// Different name for same concept
		{"dob", "birth_date", 0.0, 0.5},
		// Partial token overlap
		{"salary_amount", "gross_amount", 0.3, 0.6},
		// Completely unrelated
		{"xyz_abc", "birth_date", 0.0, 0.25},
		// PRISM-style abbreviations
		{"mbr_nbr", "member_id", 0.1, 0.5},
		{"natl_id", "national_id", 0.5, 0.85},
		// PAS-style full names
		{"employment_segment_id", "spell_id", 0.0, 0.4},
	}
	for _, tt := range tests {
		score := ColumnNameSimilarity(tt.source, tt.target)
		if score < tt.minScore || score > tt.maxScore {
			t.Errorf("ColumnNameSimilarity(%q, %q) = %.3f, want [%.2f, %.2f]",
				tt.source, tt.target, score, tt.minScore, tt.maxScore)
		}
	}
}
