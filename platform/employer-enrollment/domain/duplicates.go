package domain

import "strings"

// DuplicateMatchType identifies how the duplicate was detected.
type DuplicateMatchType string

const (
	MatchSSNExact     DuplicateMatchType = "SSN_EXACT"
	MatchNameDOBFuzzy DuplicateMatchType = "NAME_DOB_FUZZY"
)

// DuplicateCheck represents a potential duplicate found during detection.
type DuplicateCheck struct {
	MatchType    DuplicateMatchType
	MatchedID    string  // existing submission or member ID
	IsExisting   bool    // true if matched against existing member (not just submission)
	Confidence   float64 // 0.0 to 1.0
	MatchDetails string  // JSON description of what matched
}

// CheckNameDOBMatch performs a fuzzy match on first name, last name, and date of birth.
// Returns a confidence score between 0 and 1.
//
// Matching rules:
//   - Exact match on all three fields: confidence 0.95
//   - Exact DOB + fuzzy name (case-insensitive, trimmed): confidence 0.80
//   - Exact DOB + one name matches: confidence 0.60
//   - No DOB match: confidence 0.0 (not a match)
func CheckNameDOBMatch(firstName1, lastName1, dob1, firstName2, lastName2, dob2 string) float64 {
	// DOB must match exactly — it's the anchor for fuzzy name matching
	if dob1 != dob2 {
		return 0.0
	}

	fn1 := strings.TrimSpace(strings.ToLower(firstName1))
	fn2 := strings.TrimSpace(strings.ToLower(firstName2))
	ln1 := strings.TrimSpace(strings.ToLower(lastName1))
	ln2 := strings.TrimSpace(strings.ToLower(lastName2))

	firstMatch := fn1 == fn2
	lastMatch := ln1 == ln2

	switch {
	case firstMatch && lastMatch:
		return 0.95
	case lastMatch:
		// Last name matches but first doesn't — could be nickname/abbreviation
		return 0.60
	case firstMatch:
		// First name matches but last doesn't — could be name change
		return 0.60
	default:
		return 0.0
	}
}
