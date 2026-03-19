package db

import (
	"database/sql"
	"time"
)

// nullStringToPtr converts a sql.NullString to a *string.
func nullStringToPtr(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	return &ns.String
}

// nullTimeToPtr converts a sql.NullTime to a *time.Time.
func nullTimeToPtr(nt sql.NullTime) *time.Time {
	if !nt.Valid {
		return nil
	}
	return &nt.Time
}

// nullInt32ToPtr converts a sql.NullInt32 to a *int.
func nullInt32ToPtr(ni sql.NullInt32) *int {
	if !ni.Valid {
		return nil
	}
	v := int(ni.Int32)
	return &v
}
