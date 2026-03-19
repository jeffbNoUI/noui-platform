package domain

import (
	"testing"
	"time"
)

func TestCheckPERACareConflict_CriticalShortageWithSubsidy(t *testing.T) {
	now := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	result := CheckPERACareConflict(DesignationCriticalShortage, true, now)
	if !result.HasConflict {
		t.Error("expected conflict for Critical Shortage with active subsidy")
	}
	if result.ResponseDue == nil {
		t.Fatal("expected response due date")
	}
	expected := now.AddDate(0, 0, 30)
	if !result.ResponseDue.Equal(expected) {
		t.Errorf("expected response due %v, got %v", expected, result.ResponseDue)
	}
}

func TestCheckPERACareConflict_CriticalShortageNoSubsidy(t *testing.T) {
	now := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	result := CheckPERACareConflict(DesignationCriticalShortage, false, now)
	if result.HasConflict {
		t.Error("expected no conflict when no active subsidy")
	}
}

func TestCheckPERACareConflict_StandardType(t *testing.T) {
	now := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	result := CheckPERACareConflict(DesignationStandard, true, now)
	if result.HasConflict {
		t.Error("STANDARD designation should not trigger PERACare conflict")
	}
}

func TestCheckPERACareConflict_140DayType(t *testing.T) {
	now := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	result := CheckPERACareConflict(Designation140Day, true, now)
	if result.HasConflict {
		t.Error("140_DAY designation should not trigger PERACare conflict")
	}
}

func TestShouldAutoRemoveSubsidy_Expired(t *testing.T) {
	due := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2026, 3, 2, 0, 0, 0, 0, time.UTC)
	if !ShouldAutoRemoveSubsidy(due, false, now) {
		t.Error("expected auto-remove when past due and no response")
	}
}

func TestShouldAutoRemoveSubsidy_NotYetDue(t *testing.T) {
	due := time.Date(2026, 3, 31, 0, 0, 0, 0, time.UTC)
	now := time.Date(2026, 3, 15, 0, 0, 0, 0, time.UTC)
	if ShouldAutoRemoveSubsidy(due, false, now) {
		t.Error("should not auto-remove before due date")
	}
}

func TestShouldAutoRemoveSubsidy_Responded(t *testing.T) {
	due := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	now := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)
	if ShouldAutoRemoveSubsidy(due, true, now) {
		t.Error("should not auto-remove when response received")
	}
}
