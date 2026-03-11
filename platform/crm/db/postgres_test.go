package db

import (
	"database/sql"
	"os"
	"testing"
)

// ─── NewStore ────────────────────────────────────────────────────────────────

func TestNewStore(t *testing.T) {
	// NewStore should wrap any *sql.DB — including nil — without panicking.
	store := NewStore(nil)
	if store == nil {
		t.Fatal("expected non-nil Store from NewStore(nil)")
	}
	if store.DB != nil {
		t.Error("expected nil DB on Store created with nil")
	}
}

func TestNewStore_WithDB(t *testing.T) {
	// Verify that NewStore preserves the provided *sql.DB reference.
	// sql.Open with a bogus DSN doesn't actually connect — it just returns
	// a handle. This is safe to use without a real database.
	fakeDB, err := sql.Open("postgres", "host=invalid")
	if err != nil {
		t.Skipf("skipping: cannot create sql.DB stub: %v", err)
	}
	defer fakeDB.Close()

	store := NewStore(fakeDB)
	if store.DB != fakeDB {
		t.Error("expected Store.DB to be the same *sql.DB passed to NewStore")
	}
}

// ─── getEnv ──────────────────────────────────────────────────────────────────

func TestGetEnv_Fallback(t *testing.T) {
	key := "CRM_TEST_NONEXISTENT_VAR_12345"
	os.Unsetenv(key)

	got := getEnv(key, "default_val")
	if got != "default_val" {
		t.Errorf("expected fallback %q, got %q", "default_val", got)
	}
}

func TestGetEnv_EnvSet(t *testing.T) {
	key := "CRM_TEST_GET_ENV_SET"
	os.Setenv(key, "from_env")
	defer os.Unsetenv(key)

	got := getEnv(key, "fallback")
	if got != "from_env" {
		t.Errorf("expected %q, got %q", "from_env", got)
	}
}

func TestGetEnv_EmptyUsesFallback(t *testing.T) {
	key := "CRM_TEST_GET_ENV_EMPTY"
	os.Setenv(key, "")
	defer os.Unsetenv(key)

	got := getEnv(key, "fallback")
	if got != "fallback" {
		t.Errorf("expected fallback %q when env is empty, got %q", "fallback", got)
	}
}

// ─── ConfigFromEnv ───────────────────────────────────────────────────────────

func TestConfigFromEnv_Defaults(t *testing.T) {
	// Unset all DB_* env vars to verify defaults.
	keys := []string{"DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_SSLMODE"}
	saved := make(map[string]string)
	for _, k := range keys {
		saved[k] = os.Getenv(k)
		os.Unsetenv(k)
	}
	defer func() {
		for _, k := range keys {
			if v, ok := saved[k]; ok && v != "" {
				os.Setenv(k, v)
			}
		}
	}()

	cfg := ConfigFromEnv()

	expect := map[string]string{
		"Host":     "localhost",
		"Port":     "5432",
		"User":     "derp",
		"Password": "derp",
		"DBName":   "derp",
		"SSLMode":  "disable",
	}

	checks := map[string]string{
		"Host":     cfg.Host,
		"Port":     cfg.Port,
		"User":     cfg.User,
		"Password": cfg.Password,
		"DBName":   cfg.DBName,
		"SSLMode":  cfg.SSLMode,
	}

	for field, want := range expect {
		got := checks[field]
		if got != want {
			t.Errorf("ConfigFromEnv().%s = %q, want %q", field, got, want)
		}
	}
}

func TestConfigFromEnv_CustomValues(t *testing.T) {
	envs := map[string]string{
		"DB_HOST":     "pghost.example.com",
		"DB_PORT":     "5433",
		"DB_USER":     "myuser",
		"DB_PASSWORD": "secret",
		"DB_NAME":     "testdb",
		"DB_SSLMODE":  "require",
	}

	saved := make(map[string]string)
	for k, v := range envs {
		saved[k] = os.Getenv(k)
		os.Setenv(k, v)
	}
	defer func() {
		for k := range envs {
			if v, ok := saved[k]; ok && v != "" {
				os.Setenv(k, v)
			} else {
				os.Unsetenv(k)
			}
		}
	}()

	cfg := ConfigFromEnv()

	if cfg.Host != "pghost.example.com" {
		t.Errorf("Host = %q, want %q", cfg.Host, "pghost.example.com")
	}
	if cfg.Port != "5433" {
		t.Errorf("Port = %q, want %q", cfg.Port, "5433")
	}
	if cfg.User != "myuser" {
		t.Errorf("User = %q, want %q", cfg.User, "myuser")
	}
	if cfg.Password != "secret" {
		t.Errorf("Password = %q, want %q", cfg.Password, "secret")
	}
	if cfg.DBName != "testdb" {
		t.Errorf("DBName = %q, want %q", cfg.DBName, "testdb")
	}
	if cfg.SSLMode != "require" {
		t.Errorf("SSLMode = %q, want %q", cfg.SSLMode, "require")
	}
}
