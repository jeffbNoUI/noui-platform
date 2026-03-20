// Package db provides PostgreSQL database connectivity and data access for the Security Events service.
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

// Store wraps a database connection and exposes security data-access methods.
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

// InitSchema creates the security_events and active_sessions tables if they don't exist.
func InitSchema(db *sql.DB) error {
	schema := `
		CREATE TABLE IF NOT EXISTS security_events (
			id SERIAL PRIMARY KEY,
			tenant_id UUID NOT NULL,
			event_type TEXT NOT NULL,
			actor_id TEXT NOT NULL DEFAULT '',
			actor_email TEXT NOT NULL DEFAULT '',
			ip_address TEXT NOT NULL DEFAULT '',
			user_agent TEXT NOT NULL DEFAULT '',
			metadata TEXT NOT NULL DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS active_sessions (
			id SERIAL PRIMARY KEY,
			tenant_id UUID NOT NULL,
			user_id TEXT NOT NULL,
			session_id TEXT UNIQUE NOT NULL,
			email TEXT NOT NULL DEFAULT '',
			role TEXT NOT NULL DEFAULT '',
			ip_address TEXT NOT NULL DEFAULT '',
			user_agent TEXT NOT NULL DEFAULT '',
			started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_security_events_tenant ON security_events(tenant_id);
		CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(tenant_id, event_type);
		CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(tenant_id, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_active_sessions_tenant ON active_sessions(tenant_id);
		CREATE INDEX IF NOT EXISTS idx_active_sessions_seen ON active_sessions(last_seen_at);

		-- Migrate existing TEXT tenant_id columns to UUID
		DO $$ BEGIN
			IF EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'security_events' AND column_name = 'tenant_id' AND data_type = 'text'
			) THEN
				ALTER TABLE security_events ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
			END IF;
			IF EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'active_sessions' AND column_name = 'tenant_id' AND data_type = 'text'
			) THEN
				ALTER TABLE active_sessions ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
			END IF;
		END $$;
	`

	_, err := db.Exec(schema)
	return err
}
