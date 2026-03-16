package db

import (
	"testing"

	"github.com/noui/platform/envutil"
)

// ─── ConfigFromEnv ───────────────────────────────────────────────────────────

func TestConfigFromEnv_Defaults(t *testing.T) {
	t.Setenv("DB_MAX_OPEN_CONNS", "")
	t.Setenv("DB_MAX_IDLE_CONNS", "")

	cfg := ConfigFromEnv()

	if cfg.Host != "localhost" {
		t.Errorf("Host = %q, want %q", cfg.Host, "localhost")
	}
	if cfg.MaxOpenConns != 3 {
		t.Errorf("MaxOpenConns = %d, want 3", cfg.MaxOpenConns)
	}
	if cfg.MaxIdleConns != 1 {
		t.Errorf("MaxIdleConns = %d, want 1", cfg.MaxIdleConns)
	}
}

func TestConfigFromEnv_CustomPoolSize(t *testing.T) {
	t.Setenv("DB_MAX_OPEN_CONNS", "10")
	t.Setenv("DB_MAX_IDLE_CONNS", "4")

	cfg := ConfigFromEnv()

	if cfg.MaxOpenConns != 10 {
		t.Errorf("MaxOpenConns = %d, want 10", cfg.MaxOpenConns)
	}
	if cfg.MaxIdleConns != 4 {
		t.Errorf("MaxIdleConns = %d, want 4", cfg.MaxIdleConns)
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

			if cfg.MaxOpenConns != 3 {
				t.Errorf("MaxOpenConns = %d, want default 3 for invalid input %q", cfg.MaxOpenConns, tt.openVal)
			}
			if cfg.MaxIdleConns != 1 {
				t.Errorf("MaxIdleConns = %d, want default 1 for invalid input %q", cfg.MaxIdleConns, tt.idleVal)
			}
		})
	}
}

// ─── getEnvInt ───────────────────────────────────────────────────────────────

func TestGetEnvInt_Fallback(t *testing.T) {
	t.Setenv("TEST_INT_UNSET", "")

	got := envutil.GetEnvInt("TEST_INT_UNSET", 42)
	if got != 42 {
		t.Errorf("envutil.GetEnvInt() = %d, want 42", got)
	}
}

func TestGetEnvInt_ValidValue(t *testing.T) {
	t.Setenv("TEST_INT_VALID", "99")

	got := envutil.GetEnvInt("TEST_INT_VALID", 42)
	if got != 99 {
		t.Errorf("envutil.GetEnvInt() = %d, want 99", got)
	}
}
