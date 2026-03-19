package domain

// ExclusionFlags holds the three immutable exclusion flags for a purchase request.
// All flags are ALWAYS true — purchased service credit never counts toward eligibility.
type ExclusionFlags struct {
	ExcludesFromRuleOf7585 bool `json:"excludesFromRuleOf7585"`
	ExcludesFromIPR        bool `json:"excludesFromIpr"`
	ExcludesFromVesting    bool `json:"excludesFromVesting"`
}

// NewExclusionFlags creates the canonical set of exclusion flags.
// All flags are always true — this is a fiduciary requirement.
// Purchased service credit:
//   - DOES contribute to benefit calculation (increases the benefit amount)
//   - does NOT count toward Rule of 75/85 eligibility
//   - does NOT count toward IPR (Initial Purchase of Retirement) eligibility
//   - does NOT count toward vesting (5-year requirement)
func NewExclusionFlags() ExclusionFlags {
	return ExclusionFlags{
		ExcludesFromRuleOf7585: true,
		ExcludesFromIPR:        true,
		ExcludesFromVesting:    true,
	}
}

// ValidateExclusionFlags verifies that exclusion flags are set correctly.
// Returns an error message if any flag is false (which should never happen).
func ValidateExclusionFlags(flags ExclusionFlags) (bool, string) {
	if !flags.ExcludesFromRuleOf7585 {
		return false, "excludesFromRuleOf7585 must be true — purchased service never counts toward Rule of 75/85"
	}
	if !flags.ExcludesFromIPR {
		return false, "excludesFromIpr must be true — purchased service never counts toward IPR"
	}
	if !flags.ExcludesFromVesting {
		return false, "excludesFromVesting must be true — purchased service never counts toward vesting"
	}
	return true, ""
}

// ExclusionFlagsChanged checks whether any exclusion flag has been modified.
// This is an application-level check; the database trigger is the true enforcer.
func ExclusionFlagsChanged(original, updated ExclusionFlags) (bool, string) {
	if original.ExcludesFromRuleOf7585 != updated.ExcludesFromRuleOf7585 {
		return true, "excludesFromRuleOf7585 cannot be modified after creation"
	}
	if original.ExcludesFromIPR != updated.ExcludesFromIPR {
		return true, "excludesFromIpr cannot be modified after creation"
	}
	if original.ExcludesFromVesting != updated.ExcludesFromVesting {
		return true, "excludesFromVesting cannot be modified after creation"
	}
	return false, ""
}
