package domain

import (
	"fmt"
	"math/big"
)

// DayThresholdHours is the number of hours above which a work day counts as 1 full day.
// This is a binary threshold, NOT rounding: >4 hours = 1 day, <=4 hours = 0 days.
const DayThresholdHours = 4.0

// TrackingResult is the result of processing a work day entry.
type TrackingResult struct {
	CountsAsDay    bool    `json:"countsAsDay"`
	HoursWorked    string  `json:"hoursWorked"`
	NewYTDDays     int     `json:"newYtdDays"`
	NewYTDHours    string  `json:"newYtdHours"`
	OverDayLimit   bool    `json:"overDayLimit"`
	OverHourLimit  bool    `json:"overHourLimit"`
	DaysRemaining  *int    `json:"daysRemaining"`
	HoursRemaining *string `json:"hoursRemaining"`
}

// ProcessWorkDay evaluates a new work entry against WARET limits.
//
// Rules:
//   - >4 hours in a day = 1 full day (binary threshold, not rounding)
//   - Accumulate hours/days against annual limits
//   - ORP exempt members are never over limit
//   - Critical Shortage (nil limits) is never over limit
func ProcessWorkDay(
	hoursWorked string,
	currentYTDDays int,
	currentYTDHours string,
	dayLimit *int,
	hourLimit *int,
	orpExempt bool,
) (*TrackingResult, error) {
	hours, ok := new(big.Rat).SetString(hoursWorked)
	if !ok {
		return nil, fmt.Errorf("invalid hours worked: %q", hoursWorked)
	}
	if hours.Sign() <= 0 {
		return nil, fmt.Errorf("hours worked must be positive")
	}

	ytdHours, ok := new(big.Rat).SetString(currentYTDHours)
	if !ok {
		ytdHours = new(big.Rat)
	}

	// Binary day threshold: >4 hours = 1 day
	threshold := new(big.Rat).SetFloat64(DayThresholdHours)
	countsAsDay := hours.Cmp(threshold) > 0

	// Update YTD
	newYTDDays := currentYTDDays
	if countsAsDay {
		newYTDDays++
	}
	newYTDHours := new(big.Rat).Add(ytdHours, hours)

	result := &TrackingResult{
		CountsAsDay: countsAsDay,
		HoursWorked: ratToFixed2(hours),
		NewYTDDays:  newYTDDays,
		NewYTDHours: ratToFixed2(newYTDHours),
	}

	// Check limits (ORP exempt and unlimited never over limit)
	if !orpExempt {
		if dayLimit != nil {
			result.OverDayLimit = newYTDDays > *dayLimit
			remaining := *dayLimit - newYTDDays
			result.DaysRemaining = &remaining
		}
		if hourLimit != nil {
			hlRat := new(big.Rat).SetInt64(int64(*hourLimit))
			result.OverHourLimit = newYTDHours.Cmp(hlRat) > 0
			rem := new(big.Rat).Sub(hlRat, newYTDHours)
			remStr := ratToFixed2(rem)
			result.HoursRemaining = &remStr
		}
	}

	return result, nil
}

// ratToFixed2 converts a big.Rat to a string with exactly 2 decimal places.
func ratToFixed2(r *big.Rat) string {
	return r.FloatString(2)
}
