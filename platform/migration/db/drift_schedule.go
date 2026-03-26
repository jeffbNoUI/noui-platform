package db

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/noui/platform/migration/models"
)

// driftScheduleColumns is the standard column list for drift_schedule queries.
const driftScheduleColumns = `schedule_id, engagement_id, interval_hours, enabled,
	last_triggered_at, next_trigger_at, created_at, updated_at`

// scanDriftSchedule scans a drift_schedule row.
func scanDriftSchedule(scanner interface{ Scan(...any) error }) (*models.DriftSchedule, error) {
	var s models.DriftSchedule
	err := scanner.Scan(
		&s.ScheduleID, &s.EngagementID, &s.IntervalHours, &s.Enabled,
		&s.LastTriggeredAt, &s.NextTriggerAt, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// UpsertDriftSchedule creates or updates a drift schedule for an engagement.
// Uses INSERT ON CONFLICT DO UPDATE for idempotency.
func UpsertDriftSchedule(db *sql.DB, engagementID string, intervalHours int, enabled bool) (*models.DriftSchedule, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	// Clamp interval_hours.
	if intervalHours < 1 {
		intervalHours = 1
	}
	if intervalHours > 168 {
		intervalHours = 168
	}

	// If enabled, set next_trigger_at = NOW() + interval_hours.
	var nextTrigger *time.Time
	if enabled {
		t := time.Now().Add(time.Duration(intervalHours) * time.Hour)
		nextTrigger = &t
	}

	row := db.QueryRow(
		`INSERT INTO migration.drift_schedule (engagement_id, interval_hours, enabled, next_trigger_at)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (engagement_id) DO UPDATE
		 SET interval_hours = EXCLUDED.interval_hours,
		     enabled = EXCLUDED.enabled,
		     next_trigger_at = EXCLUDED.next_trigger_at,
		     updated_at = now()
		 RETURNING `+driftScheduleColumns,
		engagementID, intervalHours, enabled, nextTrigger,
	)
	return scanDriftSchedule(row)
}

// GetDriftSchedule returns the drift schedule for an engagement, or nil if none exists.
func GetDriftSchedule(db *sql.DB, engagementID string) (*models.DriftSchedule, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	row := db.QueryRow(
		`SELECT `+driftScheduleColumns+`
		 FROM migration.drift_schedule
		 WHERE engagement_id = $1`,
		engagementID,
	)
	s, err := scanDriftSchedule(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get drift schedule: %w", err)
	}
	return s, nil
}

// UpdateDriftSchedule updates interval_hours and/or enabled on an existing schedule.
// When enabled transitions false→true, sets next_trigger_at = NOW() + interval_hours.
func UpdateDriftSchedule(db *sql.DB, engagementID string, intervalHours *int, enabled *bool) (*models.DriftSchedule, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}

	// Get current schedule to detect transitions.
	current, err := GetDriftSchedule(db, engagementID)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, nil
	}

	newInterval := current.IntervalHours
	if intervalHours != nil {
		newInterval = *intervalHours
		if newInterval < 1 {
			newInterval = 1
		}
		if newInterval > 168 {
			newInterval = 168
		}
	}

	newEnabled := current.Enabled
	if enabled != nil {
		newEnabled = *enabled
	}

	// Detect false→true transition for next_trigger_at.
	var nextTrigger *time.Time
	if newEnabled && !current.Enabled {
		t := time.Now().Add(time.Duration(newInterval) * time.Hour)
		nextTrigger = &t
	} else if newEnabled {
		// Keep existing or recalculate if interval changed.
		if intervalHours != nil && current.NextTriggerAt != nil {
			t := time.Now().Add(time.Duration(newInterval) * time.Hour)
			nextTrigger = &t
		} else {
			nextTrigger = current.NextTriggerAt
		}
	}
	// If disabling, clear next_trigger_at (nil).

	row := db.QueryRow(
		`UPDATE migration.drift_schedule
		 SET interval_hours = $2,
		     enabled = $3,
		     next_trigger_at = $4,
		     updated_at = now()
		 WHERE engagement_id = $1
		 RETURNING `+driftScheduleColumns,
		engagementID, newInterval, newEnabled, nextTrigger,
	)
	s, err := scanDriftSchedule(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("update drift schedule: %w", err)
	}
	return s, nil
}

// ClaimDueSchedules returns schedules that are enabled and due for execution,
// locking them with SELECT ... FOR UPDATE SKIP LOCKED. Updates last_triggered_at
// and next_trigger_at for each claimed schedule. Returns the list of claimed schedules.
func ClaimDueSchedules(db *sql.DB) ([]models.DriftSchedule, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	rows, err := tx.Query(
		`SELECT ` + driftScheduleColumns + `
		 FROM migration.drift_schedule
		 WHERE enabled = true AND next_trigger_at <= NOW()
		 FOR UPDATE SKIP LOCKED`,
	)
	if err != nil {
		return nil, fmt.Errorf("claim due schedules: %w", err)
	}

	var schedules []models.DriftSchedule
	for rows.Next() {
		s, err := scanDriftSchedule(rows)
		if err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan due schedule: %w", err)
		}
		schedules = append(schedules, *s)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	// Update each claimed schedule.
	now := time.Now()
	for _, s := range schedules {
		nextTrigger := now.Add(time.Duration(s.IntervalHours) * time.Hour)
		_, err := tx.Exec(
			`UPDATE migration.drift_schedule
			 SET last_triggered_at = $2,
			     next_trigger_at = $3,
			     updated_at = $2
			 WHERE schedule_id = $1`,
			s.ScheduleID, now, nextTrigger,
		)
		if err != nil {
			return nil, fmt.Errorf("update claimed schedule %s: %w", s.ScheduleID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return schedules, nil
}

// GetDriftSummary returns aggregate drift metrics for an engagement.
// Joins drift_detection_run and drift_schedule in a single query.
func GetDriftSummary(database *sql.DB, engagementID string) (*models.DriftSummary, error) {
	if database == nil {
		return nil, fmt.Errorf("db is nil")
	}

	summary := &models.DriftSummary{
		BySeverity: map[string]int{
			"CRITICAL": 0,
			"HIGH":     0,
			"MEDIUM":   0,
			"LOW":      0,
		},
	}

	// Total runs count.
	if err := database.QueryRow(
		`SELECT COUNT(*) FROM migration.drift_detection_run WHERE engagement_id = $1`,
		engagementID,
	).Scan(&summary.TotalRuns); err != nil {
		return nil, fmt.Errorf("count drift runs: %w", err)
	}

	// Most recent completed run.
	var lastRunID sql.NullString
	var lastRunAt sql.NullTime
	var criticalChanges, detectedChanges int
	err := database.QueryRow(
		`SELECT run_id, completed_at, detected_changes, critical_changes
		 FROM migration.drift_detection_run
		 WHERE engagement_id = $1 AND status = 'COMPLETED'
		 ORDER BY completed_at DESC NULLS LAST
		 LIMIT 1`,
		engagementID,
	).Scan(&lastRunID, &lastRunAt, &detectedChanges, &criticalChanges)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("get last completed run: %w", err)
	}

	if lastRunID.Valid {
		summary.LastRunID = &lastRunID.String
		if lastRunAt.Valid {
			summary.LastRunAt = &lastRunAt.Time
		}

		// Determine drift status from most recent completed run.
		if criticalChanges > 0 {
			summary.DriftStatus = models.DriftStatusCritical
		} else if detectedChanges > 0 {
			summary.DriftStatus = models.DriftStatusDrifted
		} else {
			summary.DriftStatus = models.DriftStatusClean
		}

		// Severity breakdown from most recent run.
		rows, err := database.Query(
			`SELECT severity, COUNT(*) FROM migration.drift_record
			 WHERE run_id = $1
			 GROUP BY severity`,
			lastRunID.String,
		)
		if err != nil {
			return nil, fmt.Errorf("severity breakdown: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var sev string
			var cnt int
			if err := rows.Scan(&sev, &cnt); err != nil {
				return nil, fmt.Errorf("scan severity: %w", err)
			}
			summary.BySeverity[sev] = cnt
		}
		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("severity rows: %w", err)
		}
	} else {
		summary.DriftStatus = models.DriftStatusClean
	}

	// Schedule info.
	schedule, err := GetDriftSchedule(database, engagementID)
	if err != nil {
		return nil, fmt.Errorf("get schedule for summary: %w", err)
	}
	if schedule != nil {
		summary.ScheduleEnabled = schedule.Enabled
		summary.NextScheduledAt = schedule.NextTriggerAt
	}

	return summary, nil
}
