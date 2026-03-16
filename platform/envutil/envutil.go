// Package envutil provides environment variable helpers shared across platform services.
package envutil

import (
	"log/slog"
	"os"
	"strconv"
)

// GetEnv returns the environment variable value or the fallback if not set.
func GetEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// GetEnvInt returns the environment variable parsed as a positive integer,
// or the fallback if not set, not a valid integer, or not positive.
func GetEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
		slog.Warn("ignoring invalid integer env var, using default",
			"key", key, "value", v, "default", fallback)
	}
	return fallback
}

// GetEnvFloat returns the environment variable parsed as a positive float,
// or the fallback if not set, not a valid float, or not positive.
func GetEnvFloat(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f > 0 {
			return f
		}
		slog.Warn("ignoring invalid float env var, using default",
			"key", key, "value", v, "default", fallback)
	}
	return fallback
}
