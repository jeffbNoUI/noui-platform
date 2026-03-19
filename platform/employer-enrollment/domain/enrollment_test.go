package domain

import "testing"

func TestValidateSubmission(t *testing.T) {
	tests := []struct {
		name         string
		ssnHash      string
		firstName    string
		lastName     string
		dob          string
		hireDate     string
		planCode     string
		divisionCode string
		wantErrors   int
	}{
		{
			name:         "all valid",
			ssnHash:      "abc123hash",
			firstName:    "Jane",
			lastName:     "Doe",
			dob:          "1985-03-15",
			hireDate:     "2020-06-01",
			planCode:     "DB",
			divisionCode: "SD",
			wantErrors:   0,
		},
		{
			name:         "all empty",
			ssnHash:      "",
			firstName:    "",
			lastName:     "",
			dob:          "",
			hireDate:     "",
			planCode:     "",
			divisionCode: "",
			wantErrors:   7,
		},
		{
			name:         "invalid date formats",
			ssnHash:      "hash",
			firstName:    "Jane",
			lastName:     "Doe",
			dob:          "03/15/1985",
			hireDate:     "June 1 2020",
			planCode:     "DB",
			divisionCode: "SD",
			wantErrors:   2,
		},
		{
			name:         "invalid plan code",
			ssnHash:      "hash",
			firstName:    "Jane",
			lastName:     "Doe",
			dob:          "1985-03-15",
			hireDate:     "2020-06-01",
			planCode:     "XYZ",
			divisionCode: "SD",
			wantErrors:   1,
		},
		{
			name:         "invalid division code",
			ssnHash:      "hash",
			firstName:    "Jane",
			lastName:     "Doe",
			dob:          "1985-03-15",
			hireDate:     "2020-06-01",
			planCode:     "DB",
			divisionCode: "INVALID",
			wantErrors:   1,
		},
		{
			name:         "ORP plan valid",
			ssnHash:      "hash",
			firstName:    "Jane",
			lastName:     "Doe",
			dob:          "1985-03-15",
			hireDate:     "2020-06-01",
			planCode:     "ORP",
			divisionCode: "STATE",
			wantErrors:   0,
		},
		{
			name:         "DC plan valid",
			ssnHash:      "hash",
			firstName:    "Jane",
			lastName:     "Doe",
			dob:          "1985-03-15",
			hireDate:     "2020-06-01",
			planCode:     "DC",
			divisionCode: "LG",
			wantErrors:   0,
		},
		{
			name:         "whitespace-only fields treated as empty",
			ssnHash:      "   ",
			firstName:    "  ",
			lastName:     "  ",
			dob:          "1985-03-15",
			hireDate:     "2020-06-01",
			planCode:     "DB",
			divisionCode: "SD",
			wantErrors:   3,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			errs := ValidateSubmission(tc.ssnHash, tc.firstName, tc.lastName, tc.dob, tc.hireDate, tc.planCode, tc.divisionCode)
			if len(errs) != tc.wantErrors {
				t.Errorf("got %d errors, want %d: %v", len(errs), tc.wantErrors, errs)
			}
		})
	}
}

func TestAssignTier(t *testing.T) {
	tests := []struct {
		name     string
		hireDate string
		planCode string
		wantTier string
		wantErr  bool
	}{
		{
			name:     "Tier 1 — hired before Sept 1 2004",
			hireDate: "2000-01-15",
			planCode: "DB",
			wantTier: "T1",
		},
		{
			name:     "Tier 1 — hired Aug 31 2004 (day before cutoff)",
			hireDate: "2004-08-31",
			planCode: "DB",
			wantTier: "T1",
		},
		{
			name:     "Tier 2 — hired Sept 1 2004 (exact cutoff)",
			hireDate: "2004-09-01",
			planCode: "DB",
			wantTier: "T2",
		},
		{
			name:     "Tier 2 — hired June 30 2011 (day before cutoff)",
			hireDate: "2011-06-30",
			planCode: "DB",
			wantTier: "T2",
		},
		{
			name:     "Tier 3 — hired July 1 2011 (exact cutoff)",
			hireDate: "2011-07-01",
			planCode: "DB",
			wantTier: "T3",
		},
		{
			name:     "Tier 3 — recent hire",
			hireDate: "2024-01-15",
			planCode: "DB",
			wantTier: "T3",
		},
		{
			name:     "ORP — no tier",
			hireDate: "2020-01-15",
			planCode: "ORP",
			wantTier: "",
		},
		{
			name:     "DC — no tier",
			hireDate: "2020-01-15",
			planCode: "DC",
			wantTier: "",
		},
		{
			name:     "invalid date",
			hireDate: "not-a-date",
			planCode: "DB",
			wantErr:  true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			tier, err := AssignTier(tc.hireDate, tc.planCode)
			if tc.wantErr {
				if err == nil {
					t.Error("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tier != tc.wantTier {
				t.Errorf("got tier %q, want %q", tier, tc.wantTier)
			}
		})
	}
}

func TestValidEnrollmentType(t *testing.T) {
	valid := []string{"EMPLOYER_INITIATED", "MEMBER_INITIATED", "REHIRE"}
	for _, v := range valid {
		if !ValidEnrollmentType(v) {
			t.Errorf("expected %q to be valid", v)
		}
	}
	invalid := []string{"", "UNKNOWN", "employer_initiated", "rehire"}
	for _, v := range invalid {
		if ValidEnrollmentType(v) {
			t.Errorf("expected %q to be invalid", v)
		}
	}
}
