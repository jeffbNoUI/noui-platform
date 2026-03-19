package domain

import "testing"

func TestNewExclusionFlags_AllTrue(t *testing.T) {
	flags := NewExclusionFlags()
	if !flags.ExcludesFromRuleOf7585 {
		t.Error("ExcludesFromRuleOf7585 must be true")
	}
	if !flags.ExcludesFromIPR {
		t.Error("ExcludesFromIPR must be true")
	}
	if !flags.ExcludesFromVesting {
		t.Error("ExcludesFromVesting must be true")
	}
}

func TestValidateExclusionFlags_AllTrue(t *testing.T) {
	flags := ExclusionFlags{true, true, true}
	valid, msg := ValidateExclusionFlags(flags)
	if !valid {
		t.Errorf("expected valid, got error: %s", msg)
	}
}

func TestValidateExclusionFlags_RuleOf7585False(t *testing.T) {
	flags := ExclusionFlags{false, true, true}
	valid, _ := ValidateExclusionFlags(flags)
	if valid {
		t.Error("expected invalid when ExcludesFromRuleOf7585 is false")
	}
}

func TestValidateExclusionFlags_IPRFalse(t *testing.T) {
	flags := ExclusionFlags{true, false, true}
	valid, _ := ValidateExclusionFlags(flags)
	if valid {
		t.Error("expected invalid when ExcludesFromIPR is false")
	}
}

func TestValidateExclusionFlags_VestingFalse(t *testing.T) {
	flags := ExclusionFlags{true, true, false}
	valid, _ := ValidateExclusionFlags(flags)
	if valid {
		t.Error("expected invalid when ExcludesFromVesting is false")
	}
}

func TestValidateExclusionFlags_AllFalse(t *testing.T) {
	flags := ExclusionFlags{false, false, false}
	valid, _ := ValidateExclusionFlags(flags)
	if valid {
		t.Error("expected invalid when all flags are false")
	}
}

func TestExclusionFlagsChanged_NoChange(t *testing.T) {
	original := ExclusionFlags{true, true, true}
	updated := ExclusionFlags{true, true, true}
	changed, _ := ExclusionFlagsChanged(original, updated)
	if changed {
		t.Error("expected no change detected")
	}
}

func TestExclusionFlagsChanged_RuleOf7585Changed(t *testing.T) {
	original := ExclusionFlags{true, true, true}
	updated := ExclusionFlags{false, true, true}
	changed, msg := ExclusionFlagsChanged(original, updated)
	if !changed {
		t.Error("expected change detected for ExcludesFromRuleOf7585")
	}
	if msg == "" {
		t.Error("expected error message")
	}
}

func TestExclusionFlagsChanged_IPRChanged(t *testing.T) {
	original := ExclusionFlags{true, true, true}
	updated := ExclusionFlags{true, false, true}
	changed, msg := ExclusionFlagsChanged(original, updated)
	if !changed {
		t.Error("expected change detected for ExcludesFromIPR")
	}
	if msg == "" {
		t.Error("expected error message")
	}
}

func TestExclusionFlagsChanged_VestingChanged(t *testing.T) {
	original := ExclusionFlags{true, true, true}
	updated := ExclusionFlags{true, true, false}
	changed, msg := ExclusionFlagsChanged(original, updated)
	if !changed {
		t.Error("expected change detected for ExcludesFromVesting")
	}
	if msg == "" {
		t.Error("expected error message")
	}
}
