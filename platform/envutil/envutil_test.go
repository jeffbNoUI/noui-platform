package envutil

import (
	"os"
	"testing"
)

func TestGetEnv_ReturnsValue(t *testing.T) {
	os.Setenv("TEST_KEY_STR", "hello")
	defer os.Unsetenv("TEST_KEY_STR")
	if got := GetEnv("TEST_KEY_STR", "default"); got != "hello" {
		t.Errorf("expected hello, got %s", got)
	}
}

func TestGetEnv_ReturnsFallback(t *testing.T) {
	if got := GetEnv("NONEXISTENT_KEY_123", "fallback"); got != "fallback" {
		t.Errorf("expected fallback, got %s", got)
	}
}

func TestGetEnvInt_ReturnsValue(t *testing.T) {
	os.Setenv("TEST_KEY_INT", "42")
	defer os.Unsetenv("TEST_KEY_INT")
	if got := GetEnvInt("TEST_KEY_INT", 10); got != 42 {
		t.Errorf("expected 42, got %d", got)
	}
}

func TestGetEnvInt_ReturnsFallbackOnInvalid(t *testing.T) {
	os.Setenv("TEST_KEY_INT_BAD", "notanumber")
	defer os.Unsetenv("TEST_KEY_INT_BAD")
	if got := GetEnvInt("TEST_KEY_INT_BAD", 10); got != 10 {
		t.Errorf("expected 10, got %d", got)
	}
}

func TestGetEnvInt_ReturnsFallbackOnZero(t *testing.T) {
	os.Setenv("TEST_KEY_INT_ZERO", "0")
	defer os.Unsetenv("TEST_KEY_INT_ZERO")
	if got := GetEnvInt("TEST_KEY_INT_ZERO", 10); got != 10 {
		t.Errorf("expected 10 (zero is not positive), got %d", got)
	}
}

func TestGetEnvInt_ReturnsFallbackOnMissing(t *testing.T) {
	if got := GetEnvInt("NONEXISTENT_KEY_456", 25); got != 25 {
		t.Errorf("expected 25, got %d", got)
	}
}

func TestGetEnvFloat_ReturnsValue(t *testing.T) {
	os.Setenv("TEST_KEY_FLOAT", "1.5")
	defer os.Unsetenv("TEST_KEY_FLOAT")
	if got := GetEnvFloat("TEST_KEY_FLOAT", 1.0); got != 1.5 {
		t.Errorf("expected 1.5, got %f", got)
	}
}

func TestGetEnvFloat_ReturnsFallbackOnInvalid(t *testing.T) {
	os.Setenv("TEST_KEY_FLOAT_BAD", "notafloat")
	defer os.Unsetenv("TEST_KEY_FLOAT_BAD")
	if got := GetEnvFloat("TEST_KEY_FLOAT_BAD", 2.0); got != 2.0 {
		t.Errorf("expected 2.0, got %f", got)
	}
}

func TestGetEnvFloat_ReturnsFallbackOnMissing(t *testing.T) {
	if got := GetEnvFloat("NONEXISTENT_KEY_789", 3.0); got != 3.0 {
		t.Errorf("expected 3.0, got %f", got)
	}
}
