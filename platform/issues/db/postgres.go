// Package db provides PostgreSQL database connectivity and data access for the Issue Management service.
package db

import (
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	_ "github.com/lib/pq"

	"github.com/noui/platform/envutil"
)

// ErrNotFound is returned when a requested record does not exist.
var ErrNotFound = errors.New("record not found")

// Store wraps a database connection and exposes issue management data-access methods.
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
		User:         envutil.GetEnv("DB_USER", "derp"),
		Password:     envutil.GetEnv("DB_PASSWORD", "derp"),
		DBName:       envutil.GetEnv("DB_NAME", "derp"),
		SSLMode:      envutil.GetEnv("DB_SSLMODE", "disable"),
		MaxOpenConns: envutil.GetEnvInt("DB_MAX_OPEN_CONNS", 8),
		MaxIdleConns: envutil.GetEnvInt("DB_MAX_IDLE_CONNS", 3),
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

		if err := InitSchema(db); err != nil {
			slog.Error("failed to initialize schema", "error", err)
			db.Close()
			return nil, fmt.Errorf("schema init failed: %w", err)
		}

		return db, nil
	}

	return nil, fmt.Errorf("failed to connect after 3 attempts: %w", err)
}

// InitSchema creates the issues and issue_comments tables if they don't exist.
func InitSchema(db *sql.DB) error {
	schema := `
		CREATE TABLE IF NOT EXISTS issues (
			id SERIAL PRIMARY KEY,
			issue_id TEXT UNIQUE NOT NULL,
			tenant_id TEXT NOT NULL,
			title TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			severity TEXT NOT NULL DEFAULT 'medium',
			category TEXT NOT NULL DEFAULT 'defect',
			status TEXT NOT NULL DEFAULT 'open',
			affected_service TEXT NOT NULL DEFAULT '',
			reported_by TEXT NOT NULL,
			assigned_to TEXT,
			reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			resolved_at TIMESTAMPTZ,
			resolution_note TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS issue_comments (
			id SERIAL PRIMARY KEY,
			issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
			author TEXT NOT NULL,
			content TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_issues_tenant ON issues(tenant_id);
		CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(tenant_id, status);
		CREATE INDEX IF NOT EXISTS idx_issue_comments_issue ON issue_comments(issue_id);
	`

	_, err := db.Exec(schema)
	return err
}
