// Package validation provides composable input validation for platform services.
// All validators accumulate errors into an Errors slice that can be checked after
// running all validations. The zero value is ready to use.
package validation

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// FieldError represents a single validation failure on a named field.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Errors accumulates validation failures. The zero value is ready to use.
type Errors []FieldError

func (e *Errors) add(field, message string) {
	*e = append(*e, FieldError{Field: field, Message: message})
}

// Required checks that value is not empty or whitespace-only.
func (e *Errors) Required(field, value string) {
	if strings.TrimSpace(value) == "" {
		e.add(field, field+" is required")
	}
}

// MaxLen checks that value does not exceed max characters.
func (e *Errors) MaxLen(field, value string, max int) {
	if len(value) > max {
		e.add(field, fmt.Sprintf("%s must be at most %d characters", field, max))
	}
}

// MinLen checks that value has at least min characters.
func (e *Errors) MinLen(field, value string, min int) {
	if len(value) < min {
		e.add(field, fmt.Sprintf("%s must be at least %d characters", field, min))
	}
}

// Enum checks that value is one of the allowed values.
func (e *Errors) Enum(field, value string, allowed []string) {
	for _, a := range allowed {
		if value == a {
			return
		}
	}
	e.add(field, fmt.Sprintf("%s must be one of: %s", field, strings.Join(allowed, ", ")))
}

// EnumOptional checks that value is one of the allowed values, or empty.
func (e *Errors) EnumOptional(field, value string, allowed []string) {
	if value == "" {
		return
	}
	e.Enum(field, value, allowed)
}

// UUID checks that value is a valid UUID v4 format.
func (e *Errors) UUID(field, value string) {
	if !uuidRe.MatchString(value) {
		e.add(field, field+" must be a valid UUID")
	}
}

// UUIDOptional checks that value is a valid UUID or empty.
func (e *Errors) UUIDOptional(field, value string) {
	if value == "" {
		return
	}
	e.UUID(field, value)
}

// DateYMD checks that value is a valid date in YYYY-MM-DD format.
func (e *Errors) DateYMD(field, value string) {
	if _, err := time.Parse("2006-01-02", value); err != nil {
		e.add(field, field+" must be a valid date (YYYY-MM-DD)")
	}
}

// DateYMDOptional checks that value is a valid date in YYYY-MM-DD format, or empty.
func (e *Errors) DateYMDOptional(field, value string) {
	if value == "" {
		return
	}
	e.DateYMD(field, value)
}

// PositiveInt checks that value is greater than zero.
func (e *Errors) PositiveInt(field string, value int) {
	if value <= 0 {
		e.add(field, field+" must be a positive integer")
	}
}

// IntRange checks that value is between min and max inclusive.
func (e *Errors) IntRange(field string, value, min, max int) {
	if value < min || value > max {
		e.add(field, fmt.Sprintf("%s must be between %d and %d", field, min, max))
	}
}

// HasErrors returns true if any validation errors have been recorded.
func (e Errors) HasErrors() bool {
	return len(e) > 0
}

// Error returns a joined string of all validation error messages.
func (e Errors) Error() string {
	msgs := make([]string, len(e))
	for i, fe := range e {
		msgs[i] = fe.Field + ": " + fe.Message
	}
	return strings.Join(msgs, "; ")
}

// Fields returns the accumulated field errors.
func (e Errors) Fields() []FieldError {
	return e
}

// Pagination clamps limit and offset to safe values.
// If limit is <= 0 it defaults to 25. If limit exceeds maxLimit it is capped.
// Negative offset is clamped to 0.
func Pagination(limit, offset, maxLimit int) (int, int) {
	if limit <= 0 {
		limit = 25
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}
