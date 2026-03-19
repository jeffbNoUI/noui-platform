package domain

import "testing"

func TestProcessWorkDay_OverThreshold(t *testing.T) {
	result, err := ProcessWorkDay("5.0", 0, "0.00", intPtr(110), intPtr(720), false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.CountsAsDay {
		t.Error("5 hours should count as a day (>4 threshold)")
	}
	if result.NewYTDDays != 1 {
		t.Errorf("expected 1 YTD day, got %d", result.NewYTDDays)
	}
	if result.NewYTDHours != "5.00" {
		t.Errorf("expected 5.00 YTD hours, got %s", result.NewYTDHours)
	}
}

func TestProcessWorkDay_AtThreshold(t *testing.T) {
	result, err := ProcessWorkDay("4.0", 0, "0.00", intPtr(110), intPtr(720), false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.CountsAsDay {
		t.Error("exactly 4 hours should NOT count as a day (>4, not >=4)")
	}
	if result.NewYTDDays != 0 {
		t.Errorf("expected 0 YTD days, got %d", result.NewYTDDays)
	}
}

func TestProcessWorkDay_JustOverThreshold(t *testing.T) {
	result, err := ProcessWorkDay("4.01", 0, "0.00", intPtr(110), intPtr(720), false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.CountsAsDay {
		t.Error("4.01 hours should count as a day")
	}
}

func TestProcessWorkDay_AccumulatesYTD(t *testing.T) {
	result, err := ProcessWorkDay("6.50", 5, "32.50", intPtr(110), intPtr(720), false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.NewYTDDays != 6 {
		t.Errorf("expected 6 YTD days, got %d", result.NewYTDDays)
	}
	if result.NewYTDHours != "39.00" {
		t.Errorf("expected 39.00 YTD hours, got %s", result.NewYTDHours)
	}
}

func TestProcessWorkDay_OverDayLimit(t *testing.T) {
	result, err := ProcessWorkDay("8.0", 110, "700.00", intPtr(110), intPtr(720), false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.OverDayLimit {
		t.Error("should be over day limit (111 > 110)")
	}
	if result.DaysRemaining == nil || *result.DaysRemaining != -1 {
		t.Errorf("expected -1 days remaining, got %v", result.DaysRemaining)
	}
}

func TestProcessWorkDay_OverHourLimit(t *testing.T) {
	result, err := ProcessWorkDay("8.0", 100, "716.00", intPtr(110), intPtr(720), false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.OverHourLimit {
		t.Error("should be over hour limit (724 > 720)")
	}
}

func TestProcessWorkDay_ORPExemptNeverOverLimit(t *testing.T) {
	result, err := ProcessWorkDay("8.0", 200, "2000.00", intPtr(110), intPtr(720), true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.OverDayLimit {
		t.Error("ORP exempt should never be over day limit")
	}
	if result.OverHourLimit {
		t.Error("ORP exempt should never be over hour limit")
	}
	if result.DaysRemaining != nil {
		t.Error("ORP exempt should have nil days remaining")
	}
}

func TestProcessWorkDay_UnlimitedType(t *testing.T) {
	// Critical Shortage: nil limits
	result, err := ProcessWorkDay("8.0", 200, "2000.00", nil, nil, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.OverDayLimit {
		t.Error("unlimited (nil) day limit should not be over")
	}
	if result.OverHourLimit {
		t.Error("unlimited (nil) hour limit should not be over")
	}
}

func TestProcessWorkDay_140DayLimits(t *testing.T) {
	result, err := ProcessWorkDay("7.0", 139, "950.00", intPtr(140), intPtr(960), false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.OverDayLimit {
		t.Error("140 days should not be over 140-day limit")
	}
	if result.DaysRemaining == nil || *result.DaysRemaining != 0 {
		t.Errorf("expected 0 days remaining, got %v", result.DaysRemaining)
	}
}

func TestProcessWorkDay_InvalidHours(t *testing.T) {
	_, err := ProcessWorkDay("abc", 0, "0.00", intPtr(110), intPtr(720), false)
	if err == nil {
		t.Error("expected error for invalid hours")
	}
}

func TestProcessWorkDay_NegativeHours(t *testing.T) {
	_, err := ProcessWorkDay("-1.0", 0, "0.00", intPtr(110), intPtr(720), false)
	if err == nil {
		t.Error("expected error for negative hours")
	}
}
