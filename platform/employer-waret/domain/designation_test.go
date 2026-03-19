package domain

import "testing"

func TestValidateDesignation_ValidStandard(t *testing.T) {
	result := ValidateDesignation(DesignationStandard, nil, 0, 0, false)
	if !result.Valid {
		t.Errorf("expected valid, got reasons: %v", result.Reasons)
	}
}

func TestValidateDesignation_InvalidType(t *testing.T) {
	result := ValidateDesignation("BOGUS", nil, 0, 0, false)
	if result.Valid {
		t.Error("expected invalid for bogus type")
	}
	if len(result.Reasons) == 0 {
		t.Error("expected at least one reason")
	}
}

func TestValidateDesignation_140DayRequiresDistrict(t *testing.T) {
	result := ValidateDesignation(Designation140Day, nil, 0, 0, false)
	if result.Valid {
		t.Error("expected invalid when 140-day has no district")
	}
}

func TestValidateDesignation_140DayDistrictCapacity(t *testing.T) {
	dist := "DIST-001"
	result := ValidateDesignation(Designation140Day, &dist, 0, 10, false)
	if result.Valid {
		t.Error("expected invalid when district at capacity (10)")
	}
}

func TestValidateDesignation_140DayDistrictUnderCapacity(t *testing.T) {
	dist := "DIST-001"
	result := ValidateDesignation(Designation140Day, &dist, 0, 9, false)
	if !result.Valid {
		t.Errorf("expected valid when district under capacity, got: %v", result.Reasons)
	}
}

func TestValidateDesignation_ConsecutiveYearLimit(t *testing.T) {
	result := ValidateDesignation(DesignationStandard, nil, 6, 0, false)
	if result.Valid {
		t.Error("expected invalid at 6 consecutive years")
	}
}

func TestValidateDesignation_ConsecutiveYearUnderLimit(t *testing.T) {
	result := ValidateDesignation(DesignationStandard, nil, 5, 0, false)
	if !result.Valid {
		t.Errorf("expected valid at 5 consecutive years, got: %v", result.Reasons)
	}
}

func TestValidateDesignation_ORPExemptBypassesAll(t *testing.T) {
	// ORP exempt should pass even with 6 consecutive years
	result := ValidateDesignation(DesignationStandard, nil, 6, 0, true)
	if !result.Valid {
		t.Errorf("expected ORP exempt to bypass consecutive year limit, got: %v", result.Reasons)
	}
}

func TestValidateDesignation_ORPExemptBypassesDistrictCap(t *testing.T) {
	dist := "DIST-001"
	result := ValidateDesignation(Designation140Day, &dist, 0, 10, true)
	if !result.Valid {
		t.Errorf("expected ORP exempt to bypass district cap, got: %v", result.Reasons)
	}
}

func TestValidateDesignation_CriticalShortageValid(t *testing.T) {
	result := ValidateDesignation(DesignationCriticalShortage, nil, 0, 0, false)
	if !result.Valid {
		t.Errorf("expected Critical Shortage valid, got: %v", result.Reasons)
	}
}

func TestGetLimitsForType_Standard(t *testing.T) {
	days, hours := GetLimitsForType(DesignationStandard)
	if days == nil || *days != 110 {
		t.Errorf("expected 110 days, got %v", days)
	}
	if hours == nil || *hours != 720 {
		t.Errorf("expected 720 hours, got %v", hours)
	}
}

func TestGetLimitsForType_140Day(t *testing.T) {
	days, hours := GetLimitsForType(Designation140Day)
	if days == nil || *days != 140 {
		t.Errorf("expected 140 days, got %v", days)
	}
	if hours == nil || *hours != 960 {
		t.Errorf("expected 960 hours, got %v", hours)
	}
}

func TestGetLimitsForType_CriticalShortage(t *testing.T) {
	days, hours := GetLimitsForType(DesignationCriticalShortage)
	if days != nil {
		t.Errorf("expected nil days for Critical Shortage, got %v", *days)
	}
	if hours != nil {
		t.Errorf("expected nil hours for Critical Shortage, got %v", *hours)
	}
}
