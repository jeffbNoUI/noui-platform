// Package db provides PostgreSQL database connectivity and data access for the Case Management service.
package db

import (
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"

	_ "github.com/lib/pq"
)

// ErrNotFound is returned when a requested record does not exist.
var ErrNotFound = errors.New("record not found")

// Store wraps a database connection and exposes case management data-access methods.
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
		Host:         getEnv("DB_HOST", "localhost"),
		Port:         getEnv("DB_PORT", "5432"),
		User:         getEnv("DB_USER", "derp"),
		Password:     getEnv("DB_PASSWORD", "derp"),
		DBName:       getEnv("DB_NAME", "derp"),
		SSLMode:      getEnv("DB_SSLMODE", "disable"),
		MaxOpenConns: getEnvInt("DB_MAX_OPEN_CONNS", 12),
		MaxIdleConns: getEnvInt("DB_MAX_IDLE_CONNS", 5),
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

		db.SetMaxOpenConns(cfg.MaxOpenConns)
		db.SetMaxIdleConns(cfg.MaxIdleConns)
		db.SetConnMaxLifetime(5 * time.Minute)

		slog.Info("database connected", "host", cfg.Host, "dbname", cfg.DBName, "max_open_conns", cfg.MaxOpenConns, "max_idle_conns", cfg.MaxIdleConns)
		return db, nil
	}

	return nil, fmt.Errorf("failed to connect after 3 attempts: %w", err)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return fallback
}
