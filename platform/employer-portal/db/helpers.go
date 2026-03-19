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
