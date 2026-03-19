package domain

import (
	"testing"
	"time"
)

func strPtr(s string) *string { return &s }

func TestCheckRefundEligibility_AllClear(t *testing.T) {
	termDate := "2025-01-15"
	checkDate := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC) // well past 60-day wait

	result := CheckRefundEligibility(&termDate, nil, 3.5, false, false, nil, checkDate)

	if !result.Eligible {
		t.Errorf("expected eligible, got reasons: %v", result.Reasons)
	}
}

func TestCheckRefundEligibility_SeparationWaitNotMet(t *testing.T) {
	termDate := "2025-06-01"
	checkDate := time.Date(2025, 6, 15, 0, 0, 0, 0, time.UTC) // only 14 days

	result := CheckRefundEligibility(&termDate, nil, 3.0, false, false, nil, checkDate)

	if result.Eligible {
		t.Error("expected ineligible due to separation wait")
	}
	found := false
	for _, r := range result.Reasons {
		if len(r) > 0 && r[0:10] == "Separation" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected separation wait reason, got: %v", result.Reasons)
	}
}

func TestCheckRefundEligibility_NoTerminationDate(t *testing.T) {
	checkDate := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)

	result := CheckRefundEligibility(nil, nil, 3.0, false, false, nil, checkDate)

	if result.Eligible {
		t.Error("expected ineligible when no termination date")
	}
}

func TestCheckRefundEligibility_DisabilityBlock(t *testing.T) {
	termDate := "2024-01-01"
	disabilityDate := "2024-06-01"
	checkDate := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC) // within 2 years of disability

	result := CheckRefundEligibility(&termDate, nil, 3.0, false, true, &disabilityDate, checkDate)

	if result.Eligible {
		t.Error("expected ineligible due to disability application")
	}
	found := false
	for _, r := range result.Reasons {
		if len(r) > 10 && r[:10] == "Disability" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected disability block reason, got: %v", result.Reasons)
	}
}

func TestCheckRefundEligibility_DisabilityExpired(t *testing.T) {
	termDate := "2022-01-01"
	disabilityDate := "2022-06-01"
	checkDate := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC) // past 2-year block

	result := CheckRefundEligibility(&termDate, nil, 3.0, false, true, &disabilityDate, checkDate)

	if !result.Eligible {
		t.Errorf("expected eligible after disability block expired, got reasons: %v", result.Reasons)
	}
}

func TestCheckRefundEligibility_VestedForfeitureWarning(t *testing.T) {
	termDate := "2024-01-01"
	checkDate := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)

	result := CheckRefundEligibility(&termDate, nil, 6.0, true, false, nil, checkDate)

	if !result.Eligible {
		t.Error("vested member should still be eligible (forfeiture is a flag, not a block)")
	}
	found := false
	for _, r := range result.Reasons {
		if len(r) > 6 && r[:6] == "Member" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected forfeiture acknowledgment reason, got: %v", result.Reasons)
	}
}

func TestCheckRefundEligibility_PrefersSeparationDate(t *testing.T) {
	termDate := "2025-01-01"
	sepDate := "2025-02-01"                                   // later than term date
	checkDate := time.Date(2025, 3, 15, 0, 0, 0, 0, time.UTC) // 42 days after sep (< 60)

	result := CheckRefundEligibility(&termDate, &sepDate, 3.0, false, false, nil, checkDate)

	// Should be ineligible because separation date is used (only 42 days)
	if result.Eligible {
		t.Error("expected ineligible — separation date should be preferred over termination date")
	}
}

func TestIsValidTerminationReason(t *testing.T) {
	tests := []struct {
		reason string
		valid  bool
	}{
		{"RESIGNATION", true},
		{"RETIREMENT", true},
		{"DEATH", true},
		{"FIRED", false},
		{"", false},
	}
	for _, tt := range tests {
		if got := IsValidTerminationReason(tt.reason); got != tt.valid {
			t.Errorf("IsValidTerminationReason(%q) = %v, want %v", tt.reason, got, tt.valid)
		}
	}
}

func TestIsValidPaymentMethod(t *testing.T) {
	tests := []struct {
		method string
		valid  bool
	}{
		{"DIRECT_DEPOSIT", true},
		{"ROLLOVER", true},
		{"PARTIAL_ROLLOVER", true},
		{"CHECK", true},
		{"BITCOIN", false},
		{"", false},
	}
	for _, tt := range tests {
		if got := IsValidPaymentMethod(tt.method); got != tt.valid {
			t.Errorf("IsValidPaymentMethod(%q) = %v, want %v", tt.method, got, tt.valid)
		}
	}
}
