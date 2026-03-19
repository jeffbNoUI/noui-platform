package domain

import "time"

// PERACareResponseWindow is the number of days a retiree has to respond
// to a PERACare conflict notification before automatic subsidy removal.
const PERACareResponseWindow = 30

// PERACareConflictResult is the outcome of a PERACare conflict check.
type PERACareConflictResult struct {
	HasConflict    bool       `json:"hasConflict"`
	ResponseDue    *time.Time `json:"responseDue"`
	SubsidyRemoved bool       `json:"subsidyRemoved"`
	Reason         string     `json:"reason"`
}

// CheckPERACareConflict determines whether a Critical Shortage designation
// conflicts with an existing PERACare health subsidy.
//
// Rules:
//   - Only Critical Shortage designations trigger this check
//   - If the retiree has an active PERACare subsidy, a conflict exists
//   - A 30-day letter is sent; if no response, subsidy is auto-removed
func CheckPERACareConflict(
	designationType string,
	hasActiveSubsidy bool,
	now time.Time,
) PERACareConflictResult {
	// Only Critical Shortage triggers PERACare conflict
	if designationType != DesignationCriticalShortage {
		return PERACareConflictResult{
			HasConflict: false,
			Reason:      "only Critical Shortage designations trigger PERACare conflict check",
		}
	}

	if !hasActiveSubsidy {
		return PERACareConflictResult{
			HasConflict: false,
			Reason:      "no active PERACare subsidy",
		}
	}

	responseDue := now.AddDate(0, 0, PERACareResponseWindow)
	return PERACareConflictResult{
		HasConflict: true,
		ResponseDue: &responseDue,
		Reason:      "Critical Shortage designation conflicts with active PERACare health subsidy — 30-day response required",
	}
}

// ShouldAutoRemoveSubsidy checks whether the response window has expired
// without a response, requiring automatic subsidy removal.
func ShouldAutoRemoveSubsidy(responseDue time.Time, hasResponded bool, now time.Time) bool {
	if hasResponded {
		return false
	}
	return now.After(responseDue)
}
