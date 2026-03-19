package domain

import (
	"fmt"
	"time"
)

const (
	// PERAChoiceWindowDays is the number of days a new hire has to elect DC.
	PERAChoiceWindowDays = 60

	// ElectionPending means the member hasn't made a choice yet.
	ElectionPending = "PENDING"
	// ElectionDC means the member elected the DC plan.
	ElectionDC = "ELECTED_DC"
	// ElectionDefaultDB means the window expired and the member defaults to DB.
	ElectionDefaultDB = "DEFAULTED_DB"
	// ElectionWaived means the member explicitly chose DB.
	ElectionWaived = "WAIVED"
	// ElectionIneligible means the member is not eligible for PERAChoice.
	ElectionIneligible = "INELIGIBLE"
)

// PERAChoiceWindow represents the calculated election window for a new hire.
type PERAChoiceWindow struct {
	HireDate     string // YYYY-MM-DD
	WindowOpens  string // YYYY-MM-DD (same as hire date)
	WindowCloses string // YYYY-MM-DD (hire date + 60 days)
	IsEligible   bool
}

// CalculatePERAChoiceWindow determines the 60-day election window from hire date.
// Only DB plan members are eligible for PERAChoice (they can elect to switch to DC).
// ORP and DC members are ineligible.
func CalculatePERAChoiceWindow(hireDate string, planCode string) (*PERAChoiceWindow, error) {
	hd, err := time.Parse("2006-01-02", hireDate)
	if err != nil {
		return nil, fmt.Errorf("invalid hire date: %w", err)
	}

	// Only DB plan members can elect PERAChoice
	if planCode != "DB" {
		return &PERAChoiceWindow{
			HireDate:     hireDate,
			WindowOpens:  hireDate,
			WindowCloses: hireDate,
			IsEligible:   false,
		}, nil
	}

	windowCloses := hd.AddDate(0, 0, PERAChoiceWindowDays)

	return &PERAChoiceWindow{
		HireDate:     hireDate,
		WindowOpens:  hireDate,
		WindowCloses: windowCloses.Format("2006-01-02"),
		IsEligible:   true,
	}, nil
}

// IsWindowExpired checks if the PERAChoice election window has passed.
func IsWindowExpired(windowCloses string, now time.Time) (bool, error) {
	closes, err := time.Parse("2006-01-02", windowCloses)
	if err != nil {
		return false, fmt.Errorf("invalid window close date: %w", err)
	}
	// Window expires at end of the closing day
	closesEOD := closes.AddDate(0, 0, 1)
	return now.After(closesEOD) || now.Equal(closesEOD), nil
}

// ShouldSendReminder checks if a reminder should be sent (e.g., 7 days before window closes).
func ShouldSendReminder(windowCloses string, now time.Time, reminderDaysBefore int) (bool, error) {
	closes, err := time.Parse("2006-01-02", windowCloses)
	if err != nil {
		return false, fmt.Errorf("invalid window close date: %w", err)
	}
	reminderDate := closes.AddDate(0, 0, -reminderDaysBefore)
	return !now.Before(reminderDate), nil
}
