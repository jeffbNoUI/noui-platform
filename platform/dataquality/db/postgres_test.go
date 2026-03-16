package db

import (
	"testing"
)

// ─── ConfigFromEnv ───────────────────────────────────────────────────────────

func TestConfigFromEnv_Defaults(t *testing.T) {
	t.Setenv("DB_MAX_OPEN_CONNS", "")
	t.Setenv("DB_MAX_IDLE_CONNS", "")

	cfg := ConfigFromEnv()

	if cfg.Host != "localhost" {
		t.Errorf("Host = %q, want %q", cfg.Host, "localhost")
	}
	if cfg.MaxOpenConns != 8 {
		t.Errorf("MaxOpenConns = %d, want 8", cfg.MaxOpenConns)
	}
	if cfg.MaxIdleConns != 3 {
		t.Errorf("MaxIdleConns = %d, want 3", cfg.MaxIdleConns)
	}
}

func TestConfigFromEnv_CustomPoolSize(t *testing.T) {
	t.Setenv("DB_MAX_OPEN_CONNS", "16")
	t.Setenv("DB_MAX_IDLE_CONNS", "6")

	cfg := ConfigFromEnv()

	if cfg.MaxOpenConns != 16 {
		t.Errorf("MaxOpenConns = %d, want 16", cfg.MaxOpenConns)
	}
	if cfg.MaxIdleConns != 6 {
		t.Errorf("MaxIdleConns = %d, want 6", cfg.MaxIdleConns)
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

			if cfg.MaxOpenConns != 8 {
				t.Errorf("MaxOpenConns = %d, want default 8 for invalid input %q", cfg.MaxOpenConns, tt.openVal)
			}
			if cfg.MaxIdleConns != 3 {
				t.Errorf("MaxIdleConns = %d, want default 3 for invalid input %q", cfg.MaxIdleConns, tt.idleVal)
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
