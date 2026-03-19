// Package domain implements WARET business rules for designation validation,
// tracking, penalty calculation, and PERACare conflict detection.
package domain

import "fmt"

// Designation types with their respective limits.
const (
	DesignationStandard         = "STANDARD"
	Designation140Day           = "140_DAY"
	DesignationCriticalShortage = "CRITICAL_SHORTAGE"
)

// Limits per designation type.
var DesignationLimits = map[string]struct {
	Days  *int // nil = unlimited
	Hours *int // nil = unlimited
}{
	DesignationStandard:         {intPtr(110), intPtr(720)},
	Designation140Day:           {intPtr(140), intPtr(960)},
	DesignationCriticalShortage: {nil, nil}, // unlimited
}

// Max140DayPerDistrict is the statutory cap on 140-day designations per district.
const Max140DayPerDistrict = 10

// MaxConsecutiveYears is the maximum number of consecutive years a designation
// can be held before a 1-year mandatory break.
const MaxConsecutiveYears = 6

// ValidDesignationTypes are the allowed designation type values.
var ValidDesignationTypes = map[string]bool{
	DesignationStandard:         true,
	Designation140Day:           true,
	DesignationCriticalShortage: true,
}

// ValidDesignationStatuses are the allowed designation status values.
var ValidDesignationStatuses = map[string]bool{
	"PENDING": true, "APPROVED": true, "ACTIVE": true,
	"EXPIRED": true, "REVOKED": true, "SUSPENDED": true,
}

// DesignationValidationResult holds the outcome of designation validation.
type DesignationValidationResult struct {
	Valid   bool     `json:"valid"`
	Reasons []string `json:"reasons"`
}

// ValidateDesignation checks whether a new WARET designation is allowed.
//
// Rules:
//   - designationType must be one of STANDARD, 140_DAY, CRITICAL_SHORTAGE
//   - 140_DAY requires a districtID and is limited to school employers
//   - 140_DAY: max 10 per district per calendar year
//   - CRITICAL_SHORTAGE: only rural schools/BOCES
//   - Max 6 consecutive years then mandatory 1-year break
//   - ORP exempt members skip all limit checks
func ValidateDesignation(
	designationType string,
	districtID *string,
	consecutiveYears int,
	districtCount140Day int,
	orpExempt bool,
) DesignationValidationResult {
	result := DesignationValidationResult{Valid: true}

	if !ValidDesignationTypes[designationType] {
		result.Valid = false
		result.Reasons = append(result.Reasons,
			fmt.Sprintf("invalid designation type: %s", designationType))
		return result
	}

	// ORP exempt members bypass all other checks
	if orpExempt {
		return result
	}

	// 140-day requires district
	if designationType == Designation140Day {
		if districtID == nil || *districtID == "" {
			result.Valid = false
			result.Reasons = append(result.Reasons,
				"140-day designation requires a district ID (school employer)")
		} else if districtCount140Day >= Max140DayPerDistrict {
			result.Valid = false
			result.Reasons = append(result.Reasons,
				fmt.Sprintf("district has reached the maximum of %d active 140-day designations", Max140DayPerDistrict))
		}
	}

	// Consecutive year check (6 max + 1 year break)
	if consecutiveYears >= MaxConsecutiveYears {
		result.Valid = false
		result.Reasons = append(result.Reasons,
			fmt.Sprintf("retiree has reached %d consecutive years — mandatory 1-year break required", MaxConsecutiveYears))
	}

	return result
}

// GetLimitsForType returns the day and hour limits for a designation type.
// Returns nil pointers for unlimited (Critical Shortage).
func GetLimitsForType(designationType string) (*int, *int) {
	limits, ok := DesignationLimits[designationType]
	if !ok {
		return intPtr(110), intPtr(720) // default to standard
	}
	return limits.Days, limits.Hours
}

func intPtr(v int) *int {
	return &v
}
