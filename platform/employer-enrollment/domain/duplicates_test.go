package domain

import "testing"

func TestCheckNameDOBMatch(t *testing.T) {
	tests := []struct {
		name     string
		fn1, ln1 string
		dob1     string
		fn2, ln2 string
		dob2     string
		wantMin  float64
		wantMax  float64
	}{
		{
			name: "exact match all fields",
			fn1:  "Jane", ln1: "Doe", dob1: "1985-03-15",
			fn2: "Jane", ln2: "Doe", dob2: "1985-03-15",
			wantMin: 0.90, wantMax: 1.0,
		},
		{
			name: "case insensitive match",
			fn1:  "JANE", ln1: "DOE", dob1: "1985-03-15",
			fn2: "jane", ln2: "doe", dob2: "1985-03-15",
			wantMin: 0.90, wantMax: 1.0,
		},
		{
			name: "different DOB — no match",
			fn1:  "Jane", ln1: "Doe", dob1: "1985-03-15",
			fn2: "Jane", ln2: "Doe", dob2: "1985-03-16",
			wantMin: 0.0, wantMax: 0.0,
		},
		{
			name: "same DOB + last name, different first",
			fn1:  "Jane", ln1: "Doe", dob1: "1985-03-15",
			fn2: "Janet", ln2: "Doe", dob2: "1985-03-15",
			wantMin: 0.55, wantMax: 0.65,
		},
		{
			name: "same DOB + first name, different last (name change)",
			fn1:  "Jane", ln1: "Smith", dob1: "1985-03-15",
			fn2: "Jane", ln2: "Doe", dob2: "1985-03-15",
			wantMin: 0.55, wantMax: 0.65,
		},
		{
			name: "same DOB, completely different names",
			fn1:  "Alice", ln1: "Wonder", dob1: "1985-03-15",
			fn2: "Bob", ln2: "Builder", dob2: "1985-03-15",
			wantMin: 0.0, wantMax: 0.0,
		},
		{
			name: "whitespace handling",
			fn1:  "  Jane  ", ln1: "  Doe  ", dob1: "1985-03-15",
			fn2: "Jane", ln2: "Doe", dob2: "1985-03-15",
			wantMin: 0.90, wantMax: 1.0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			score := CheckNameDOBMatch(tc.fn1, tc.ln1, tc.dob1, tc.fn2, tc.ln2, tc.dob2)
			if score < tc.wantMin || score > tc.wantMax {
				t.Errorf("got confidence %.2f, want [%.2f, %.2f]", score, tc.wantMin, tc.wantMax)
			}
		})
	}
}
