package employershared

import "testing"

func TestCOPERADivisionsCount(t *testing.T) {
	if got := len(COPERADivisions); got != 5 {
		t.Errorf("COPERADivisions: got %d entries, want 5", got)
	}
}

func TestDivisionByCode_AllCodes(t *testing.T) {
	codes := []struct {
		code string
		name string
	}{
		{"STATE", "State Division"},
		{"SCHOOL", "School Division"},
		{"LOCAL_GOV", "Local Government Division"},
		{"JUDICIAL", "Judicial Division"},
		{"DPS", "Denver Public Schools Division"},
	}

	for _, tc := range codes {
		t.Run(tc.code, func(t *testing.T) {
			div := DivisionByCode(tc.code)
			if div == nil {
				t.Fatalf("DivisionByCode(%q) returned nil", tc.code)
			}
			if div.DivisionCode != tc.code {
				t.Errorf("DivisionCode: got %q, want %q", div.DivisionCode, tc.code)
			}
			if div.DivisionName != tc.name {
				t.Errorf("DivisionName: got %q, want %q", div.DivisionName, tc.name)
			}
			if div.GoverningStatute != "CRS Title 24, Article 51" {
				t.Errorf("GoverningStatute: got %q, want %q", div.GoverningStatute, "CRS Title 24, Article 51")
			}
		})
	}
}

func TestDivisionByCode_Unknown(t *testing.T) {
	if div := DivisionByCode("NONEXISTENT"); div != nil {
		t.Errorf("DivisionByCode(\"NONEXISTENT\") = %+v, want nil", div)
	}
}
