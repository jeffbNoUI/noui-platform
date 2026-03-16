// Package db provides PostgreSQL database connectivity and data access for the CRM service.
package db

import (
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	_ "github.com/lib/pq"

	"github.com/noui/platform/envutil"
)

// Store wraps a database connection and exposes CRM data-access methods.
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
// It will attempt up to 3 times with a 2 second delay between attempts.
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
