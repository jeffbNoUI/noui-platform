package db

import (
	"testing"
)

// ─── ConfigFromEnv ───────────────────────────────────────────────────────────

func TestConfigFromEnv_Defaults(t *testing.T) {
	// Clear pool size env vars to verify defaults.
	t.Setenv("DB_MAX_OPEN_CONNS", "")
	t.Setenv("DB_MAX_IDLE_CONNS", "")

	cfg := ConfigFromEnv()

	if cfg.Host != "localhost" {
		t.Errorf("Host = %q, want %q", cfg.Host, "localhost")
	}
	if cfg.MaxOpenConns != 15 {
		t.Errorf("MaxOpenConns = %d, want 15", cfg.MaxOpenConns)
	}
	if cfg.MaxIdleConns != 6 {
		t.Errorf("MaxIdleConns = %d, want 6", cfg.MaxIdleConns)
	}
}

func TestConfigFromEnv_CustomPoolSize(t *testing.T) {
	t.Setenv("DB_MAX_OPEN_CONNS", "30")
	t.Setenv("DB_MAX_IDLE_CONNS", "10")

	cfg := ConfigFromEnv()

	if cfg.MaxOpenConns != 30 {
		t.Errorf("MaxOpenConns = %d, want 30", cfg.MaxOpenConns)
	}
	if cfg.MaxIdleConns != 10 {
		t.Errorf("MaxIdleConns = %d, want 10", cfg.MaxIdleConns)
	}
}

func TestConfigFromEnv_InvalidPoolSize(t *testing.T) {
	tests := []struct {
		name    string
		openVal string
		idleVal string
	}{
		{"non-numeric", "abc", "xyz"},
		{"negative", "-5", "-2"},
		{"zero", "0", "0"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("DB_MAX_OPEN_CONNS", tt.openVal)
			t.Setenv("DB_MAX_IDLE_CONNS", tt.idleVal)

			cfg := ConfigFromEnv()

			if cfg.MaxOpenConns != 15 {
				t.Errorf("MaxOpenConns = %d, want default 15 for invalid input %q", cfg.MaxOpenConns, tt.openVal)
			}
			if cfg.MaxIdleConns != 6 {
				t.Errorf("MaxIdleConns = %d, want default 6 for invalid input %q", cfg.MaxIdleConns, tt.idleVal)
			}
		})
	}
}

// ─── getEnvInt ───────────────────────────────────────────────────────────────

func TestGetEnvInt_Fallback(t *testing.T) {
	t.Setenv("TEST_INT_UNSET", "")

	got := getEnvInt("TEST_INT_UNSET", 42)
	if got != 42 {
		t.Errorf("getEnvInt() = %d, want 42", got)
	}
}

func TestGetEnvInt_ValidValue(t *testing.T) {
	t.Setenv("TEST_INT_VALID", "99")

	got := getEnvInt("TEST_INT_VALID", 42)
	if got != 99 {
		t.Errorf("getEnvInt() = %d, want 99", got)
	}
}
