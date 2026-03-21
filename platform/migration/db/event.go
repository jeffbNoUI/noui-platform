package db

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/noui/platform/migration/models"
)

// InsertEvent inserts a new event and returns the created record.
func InsertEvent(db *sql.DB, engagementID, eventType string, payload json.RawMessage) (*models.Event, error) {
	if payload == nil {
		payload = json.RawMessage("{}")
	}

	var e models.Event
	err := db.QueryRow(
		`INSERT INTO migration.event (engagement_id, event_type, payload)
		 VALUES ($1, $2, $3)
		 RETURNING event_id, engagement_id, event_type, payload, created_at`,
		engagementID, eventType, payload,
	).Scan(
		&e.EventID, &e.EngagementID, &e.EventType, &e.Payload, &e.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert event: %w", err)
	}
	return &e, nil
}

// ListEvents returns events for an engagement, ordered by created_at descending, with pagination.
func ListEvents(db *sql.DB, engagementID string, limit, offset int) ([]models.Event, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := db.Query(
		`SELECT event_id, engagement_id, event_type, payload, created_at
		 FROM migration.event
		 WHERE engagement_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`,
		engagementID, limit, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("list events: %w", err)
	}
	defer rows.Close()

	var events []models.Event
	for rows.Next() {
		var e models.Event
		if err := rows.Scan(
			&e.EventID, &e.EngagementID, &e.EventType, &e.Payload, &e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan event: %w", err)
		}
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list events rows: %w", err)
	}
	return events, nil
}
