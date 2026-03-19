// Package domain contains enrollment business logic — validation, tier assignment, and field enforcement.
package domain

import (
	"fmt"
	"strings"
	"time"
)

// MandatoryFields are required for every enrollment submission.
var MandatoryFields = []string{"ssnHash", "firstName", "lastName", "dateOfBirth", "hireDate", "planCode", "divisionCode"}

// ValidPlanCodes are the allowed plan codes.
var ValidPlanCodes = []string{"DB", "DC", "ORP"}

// ValidDivisionCodes are the COPERA division codes.
var ValidDivisionCodes = []string{"SD", "LG", "STATE", "JD", "DPS"}

// ValidationError represents a single field validation error.
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ValidateSubmission checks mandatory fields and basic format rules.
// Returns a slice of validation errors (empty if valid).
func ValidateSubmission(ssnHash, firstName, lastName, dob, hireDate, planCode, divisionCode string) []ValidationError {
	var errs []ValidationError

	if strings.TrimSpace(ssnHash) == "" {
		errs = append(errs, ValidationError{Field: "ssnHash", Message: "SSN hash is required"})
	}
	if strings.TrimSpace(firstName) == "" {
		errs = append(errs, ValidationError{Field: "firstName", Message: "First name is required"})
	}
	if strings.TrimSpace(lastName) == "" {
		errs = append(errs, ValidationError{Field: "lastName", Message: "Last name is required"})
	}
	if strings.TrimSpace(dob) == "" {
		errs = append(errs, ValidationError{Field: "dateOfBirth", Message: "Date of birth is required"})
	} else if _, err := time.Parse("2006-01-02", dob); err != nil {
		errs = append(errs, ValidationError{Field: "dateOfBirth", Message: "Date of birth must be YYYY-MM-DD format"})
	}
	if strings.TrimSpace(hireDate) == "" {
		errs = append(errs, ValidationError{Field: "hireDate", Message: "Hire date is required"})
	} else if _, err := time.Parse("2006-01-02", hireDate); err != nil {
		errs = append(errs, ValidationError{Field: "hireDate", Message: "Hire date must be YYYY-MM-DD format"})
	}
	if !isValidPlanCode(planCode) {
		errs = append(errs, ValidationError{Field: "planCode", Message: fmt.Sprintf("Plan code must be one of: %s", strings.Join(ValidPlanCodes, ", "))})
	}
	if !isValidDivisionCode(divisionCode) {
		errs = append(errs, ValidationError{Field: "divisionCode", Message: fmt.Sprintf("Division code must be one of: %s", strings.Join(ValidDivisionCodes, ", "))})
	}

	return errs
}

// AssignTier determines the benefit tier based on hire date and division.
// Tier assignment follows DERP rules:
//   - T1: Hired before September 1, 2004
//   - T2: Hired September 1, 2004 through June 30, 2011
//   - T3: Hired on or after July 1, 2011
//
// ORP members do not have a tier (returns empty string).
func AssignTier(hireDate string, planCode string) (string, error) {
	if planCode == "ORP" || planCode == "DC" {
		return "", nil
	}

	hd, err := time.Parse("2006-01-02", hireDate)
	if err != nil {
		return "", fmt.Errorf("invalid hire date: %w", err)
	}

	t1Cutoff := time.Date(2004, 9, 1, 0, 0, 0, 0, time.UTC)
	t2Cutoff := time.Date(2011, 7, 1, 0, 0, 0, 0, time.UTC)

	switch {
	case hd.Before(t1Cutoff):
		return "T1", nil
	case hd.Before(t2Cutoff):
		return "T2", nil
	default:
		return "T3", nil
	}
}

// ValidEnrollmentType checks if the enrollment type is valid.
func ValidEnrollmentType(t string) bool {
	switch t {
	case "EMPLOYER_INITIATED", "MEMBER_INITIATED", "REHIRE":
		return true
	}
	return false
}

func isValidPlanCode(code string) bool {
	for _, c := range ValidPlanCodes {
		if c == code {
			return true
		}
	}
	return false
}

func isValidDivisionCode(code string) bool {
	for _, c := range ValidDivisionCodes {
		if c == code {
			return true
		}
	}
	return false
}
