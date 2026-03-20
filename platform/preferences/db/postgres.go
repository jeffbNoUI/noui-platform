// Package db provides PostgreSQL database connectivity and data access for the Preferences service.
package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	_ "github.com/lib/pq"

	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/envutil"
)

// Store wraps a database connection and exposes Preferences data-access methods.
type Store struct {
	DB *sql.DB
}

// NewStore creates a Store from an existing database connection.
func NewStore(db *sql.DB) *Store {
	return &Store{DB: db}
}

// Config holds database connection parameters.
type Config struct {
	Host         string
	Port         string
	User         string
	Password     string
	DBName       string
	SSLMode      string
	MaxOpenConns int
	MaxIdleConns int
}

// ConfigFromEnv creates a Config from environment variables with sensible defaults.
func ConfigFromEnv() Config {
	return Config{
		Host:         envutil.GetEnv("DB_HOST", "localhost"),
		Port:         envutil.GetEnv("DB_PORT", "5432"),
		User:         envutil.GetEnv("DB_USER", "noui"),
		Password:     envutil.GetEnv("DB_PASSWORD", "noui"),
		DBName:       envutil.GetEnv("DB_NAME", "noui"),
		SSLMode:      envutil.GetEnv("DB_SSLMODE", "disable"),
		MaxOpenConns: envutil.GetEnvInt("DB_MAX_OPEN_CONNS", 5),
		MaxIdleConns: envutil.GetEnvInt("DB_MAX_IDLE_CONNS", 2),
	}
}

// Connect establishes a database connection with retry logic.
func Connect(cfg Config) (*sql.DB, error) {
	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)

	var db *sql.DB
	var err error

	for attempt := 1; attempt <= 3; attempt++ {
		db, err = sql.Open("postgres", connStr)
		if err != nil {
			slog.Warn("database connection failed, retrying", "attempt", attempt, "error", err)
			time.Sleep(2 * time.Second)
			continue
		}

		err = db.Ping()
		if err != nil {
			slog.Warn("database connection failed, retrying", "attempt", attempt, "error", err)
			db.Close()
			time.Sleep(2 * time.Second)
			continue
		}

		if cfg.MaxIdleConns > cfg.MaxOpenConns {
			slog.Warn("MaxIdleConns exceeds MaxOpenConns, will be capped by database/sql",
				"max_idle_conns", cfg.MaxIdleConns, "max_open_conns", cfg.MaxOpenConns)
		}
		db.SetMaxOpenConns(cfg.MaxOpenConns)
		db.SetMaxIdleConns(cfg.MaxIdleConns)
		db.SetConnMaxLifetime(5 * time.Minute)

		slog.Info("database connected", "host", cfg.Host, "dbname", cfg.DBName, "max_open_conns", cfg.MaxOpenConns, "max_idle_conns", cfg.MaxIdleConns)
		return db, nil
	}

	return nil, fmt.Errorf("failed to connect after 3 attempts: %w", err)
}

// ============================================================
// PREFERENCE EVENT QUERIES
// ============================================================

// InsertEvent appends a new preference event to the preference_events table.
func (s *Store) InsertEvent(ctx context.Context, userID, tenantID, contextKey, actionType, targetPanel string, contextFlags, payload map[string]any) error {
	flagsJSON, err := json.Marshal(contextFlags)
	if err != nil {
		return fmt.Errorf("marshal context_flags: %w", err)
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	_, err = dbcontext.DB(ctx, s.DB).ExecContext(ctx, `
		INSERT INTO preference_events (user_id, tenant_id, context_key, action_type, target_panel, context_flags, payload)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, userID, tenantID, contextKey, actionType, targetPanel, flagsJSON, payloadJSON)
	if err != nil {
		return fmt.Errorf("insert event: %w", err)
	}

	return nil
}

// ============================================================
// USER PREFERENCE QUERIES
// ============================================================

// GetPreferences reads all user_preferences rows for a given user and context_key.
func (s *Store) GetPreferences(ctx context.Context, userID, contextKey string) ([]map[string]any, error) {
	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, `
		SELECT user_id, tenant_id, context_key, panel_id, visibility, position, default_state, updated_at
		FROM user_preferences
		WHERE user_id = $1 AND context_key = $2
		ORDER BY position ASC NULLS LAST, panel_id
	`, userID, contextKey)
	if err != nil {
		return nil, fmt.Errorf("get preferences: %w", err)
	}
	defer rows.Close()

	var results []map[string]any
	for rows.Next() {
		var (
			uid, tid, ckey, panelID, visibility, defaultState string
			position                                          sql.NullInt64
			updatedAt                                         time.Time
		)
		if err := rows.Scan(&uid, &tid, &ckey, &panelID, &visibility, &position, &defaultState, &updatedAt); err != nil {
			return nil, fmt.Errorf("scan preference: %w", err)
		}

		pref := map[string]any{
			"userId":       uid,
			"tenantId":     tid,
			"contextKey":   ckey,
			"panelId":      panelID,
			"visibility":   visibility,
			"defaultState": defaultState,
			"updatedAt":    updatedAt,
		}

		if position.Valid {
			pref["position"] = position.Int64
		} else {
			pref["position"] = nil
		}

		results = append(results, pref)
	}

	return results, rows.Err()
}

// UpsertPreference inserts or updates a user_preferences row.
func (s *Store) UpsertPreference(ctx context.Context, userID, tenantID, contextKey, panelID, visibility string, position *int, defaultState string) error {
	var posVal sql.NullInt64
	if position != nil {
		posVal = sql.NullInt64{Int64: int64(*position), Valid: true}
	}

	_, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, `
		INSERT INTO user_preferences (user_id, tenant_id, context_key, panel_id, visibility, position, default_state)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id, context_key, panel_id)
		DO UPDATE SET visibility = $5, position = $6, default_state = $7, updated_at = NOW()
	`, userID, tenantID, contextKey, panelID, visibility, posVal, defaultState)
	if err != nil {
		return fmt.Errorf("upsert preference: %w", err)
	}

	return nil
}

// DeletePreferences deletes all preferences for a user and context_key.
func (s *Store) DeletePreferences(ctx context.Context, userID, contextKey string) error {
	_, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, `
		DELETE FROM user_preferences
		WHERE user_id = $1 AND context_key = $2
	`, userID, contextKey)
	if err != nil {
		return fmt.Errorf("delete preferences: %w", err)
	}

	return nil
}

// ============================================================
// ROLE SUGGESTION QUERIES
// ============================================================

// GetSuggestions reads role_suggestions for a given role and context_key, with a
// LEFT JOIN on suggestion_responses to include the user's response status.
// Returns at most 1 unresponded or snoozed suggestion.
func (s *Store) GetSuggestions(ctx context.Context, userID, role, contextKey string) ([]map[string]any, error) {
	rows, err := dbcontext.DB(ctx, s.DB).QueryContext(ctx, `
		SELECT s.id, s.tenant_id, s.role, s.context_key, s.panel_id, s.suggestion,
		       s.sample_size, s.computed_at,
		       r.response, r.responded_at
		FROM role_suggestions s
		LEFT JOIN suggestion_responses r
			ON r.suggestion_id = s.id AND r.user_id = $1
		WHERE s.role = $2 AND s.context_key = $3
		  AND (r.response IS NULL OR r.response = 'snoozed')
		ORDER BY s.computed_at DESC
		LIMIT 1
	`, userID, role, contextKey)
	if err != nil {
		return nil, fmt.Errorf("get suggestions: %w", err)
	}
	defer rows.Close()

	var results []map[string]any
	for rows.Next() {
		var (
			id, tenantID, rl, ckey, panelID string
			suggestionJSON                  []byte
			sampleSize                      int
			computedAt                      time.Time
			response                        sql.NullString
			respondedAt                     sql.NullTime
		)
		if err := rows.Scan(&id, &tenantID, &rl, &ckey, &panelID, &suggestionJSON,
			&sampleSize, &computedAt, &response, &respondedAt); err != nil {
			return nil, fmt.Errorf("scan suggestion: %w", err)
		}

		var suggestion map[string]any
		if err := json.Unmarshal(suggestionJSON, &suggestion); err != nil {
			return nil, fmt.Errorf("unmarshal suggestion: %w", err)
		}

		item := map[string]any{
			"id":         id,
			"tenantId":   tenantID,
			"role":       rl,
			"contextKey": ckey,
			"panelId":    panelID,
			"suggestion": suggestion,
			"sampleSize": sampleSize,
			"computedAt": computedAt,
		}

		if response.Valid {
			item["userResponse"] = response.String
		}
		if respondedAt.Valid {
			item["respondedAt"] = respondedAt.Time
		}

		results = append(results, item)
	}

	return results, rows.Err()
}

// RespondToSuggestion inserts or updates a suggestion_responses row.
func (s *Store) RespondToSuggestion(ctx context.Context, userID, suggestionID, response string) error {
	_, err := dbcontext.DB(ctx, s.DB).ExecContext(ctx, `
		INSERT INTO suggestion_responses (user_id, suggestion_id, response)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, suggestion_id)
		DO UPDATE SET response = $3, responded_at = NOW()
	`, userID, suggestionID, response)
	if err != nil {
		return fmt.Errorf("respond to suggestion: %w", err)
	}

	return nil
}
