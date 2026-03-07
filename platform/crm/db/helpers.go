package db

import (
	"database/sql"
	"time"
)

// nullStringToPtr converts a sql.NullString to a *string.
// Returns nil if the value is not valid.
func nullStringToPtr(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	return &ns.String
}

// nullTimeToPtr converts a sql.NullTime to a *time.Time.
// Returns nil if the value is not valid.
func nullTimeToPtr(nt sql.NullTime) *time.Time {
	if !nt.Valid {
		return nil
	}
	return &nt.Time
}

// nullBoolToPtr converts a sql.NullBool to a *bool.
// Returns nil if the value is not valid.
func nullBoolToPtr(nb sql.NullBool) *bool {
	if !nb.Valid {
		return nil
	}
	return &nb.Bool
}

// nullInt64ToIntPtr converts a sql.NullInt64 to a *int.
// Returns nil if the value is not valid.
func nullInt64ToIntPtr(ni sql.NullInt64) *int {
	if !ni.Valid {
		return nil
	}
	v := int(ni.Int64)
	return &v
}

// nullFloat64ToPtr converts a sql.NullFloat64 to a *float64.
// Returns nil if the value is not valid.
func nullFloat64ToPtr(nf sql.NullFloat64) *float64 {
	if !nf.Valid {
		return nil
	}
	return &nf.Float64
}
