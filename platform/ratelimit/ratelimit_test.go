package ratelimit

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/noui/platform/auth"
	"github.com/noui/platform/envutil"
)

// okHandler writes 200 OK — used as the downstream handler in middleware tests.
func okHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}
}

func TestLimiter_Allow_UnderLimit(t *testing.T) {
	l := NewLimiter(10, 5) // 10/sec, burst 5
	for i := 0; i < 5; i++ {
		if !l.Allow("key1") {
			t.Fatalf("request %d should be allowed (under burst)", i+1)
		}
	}
}

func TestLimiter_Allow_ExceedsLimit(t *testing.T) {
	l := NewLimiter(0.1, 2) // very slow refill, burst 2
	// First 2 should pass (burst).
	if !l.Allow("key1") {
		t.Fatal("request 1 should be allowed")
	}
	if !l.Allow("key1") {
		t.Fatal("request 2 should be allowed")
	}
	// Third should be rejected (burst exhausted, refill too slow).
	if l.Allow("key1") {
		t.Fatal("request 3 should be rejected (burst exceeded)")
	}
}

func TestLimiter_PerKeyIsolation(t *testing.T) {
	l := NewLimiter(0.1, 1) // burst 1
	// Exhaust key-a.
	if !l.Allow("key-a") {
		t.Fatal("key-a request 1 should pass")
	}
	if l.Allow("key-a") {
		t.Fatal("key-a request 2 should be rejected")
	}
	// key-b should still work — independent bucket.
	if !l.Allow("key-b") {
		t.Fatal("key-b request 1 should pass (independent limiter)")
	}
}

func TestLimiter_Cleanup(t *testing.T) {
	l := NewLimiter(1, 1)
	l.Allow("stale-key")
	if l.Len() != 1 {
		t.Fatalf("expected 1 entry, got %d", l.Len())
	}

	// Artificially age the entry.
	l.mu.Lock()
	l.entries["stale-key"].lastSeen = time.Now().Add(-20 * time.Minute)
	l.mu.Unlock()

	l.Cleanup(10 * time.Minute)
	if l.Len() != 0 {
		t.Fatalf("expected 0 entries after cleanup, got %d", l.Len())
	}
}

func TestLimiter_Cleanup_KeepsFresh(t *testing.T) {
	l := NewLimiter(1, 1)
	l.Allow("fresh-key")
	l.Allow("stale-key")

	// Age only the stale entry.
	l.mu.Lock()
	l.entries["stale-key"].lastSeen = time.Now().Add(-20 * time.Minute)
	l.mu.Unlock()

	l.Cleanup(10 * time.Minute)
	if l.Len() != 1 {
		t.Fatalf("expected 1 entry (fresh), got %d", l.Len())
	}
}

func TestMiddleware_BypassHealthEndpoints(t *testing.T) {
	// Use a config with burst=0 so everything would be rejected if checked.
	cfg := Config{
		IPRate:          0.001,
		IPBurst:         0,
		TenantRate:      0.001,
		TenantBurst:     0,
		CleanupInterval: time.Hour,
		StaleAfter:      time.Hour,
	}
	mw := Middleware(cfg)
	handler := mw(okHandler())

	paths := []string{"/healthz", "/health", "/ready", "/metrics"}
	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			req.RemoteAddr = "10.0.0.1:12345"
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("expected 200 for %s, got %d", path, rec.Code)
			}
		})
	}
}

func TestMiddleware_Returns429(t *testing.T) {
	cfg := Config{
		IPRate:          0.001, // very slow
		IPBurst:         1,     // only 1 allowed
		TenantRate:      100,
		TenantBurst:     100,
		CleanupInterval: time.Hour,
		StaleAfter:      time.Hour,
	}
	mw := Middleware(cfg)
	handler := mw(okHandler())

	// First request passes.
	req1 := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req1.RemoteAddr = "10.0.0.1:12345"
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("first request: expected 200, got %d", rec1.Code)
	}

	// Second request should be rate limited.
	req2 := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req2.RemoteAddr = "10.0.0.1:12345"
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusTooManyRequests {
		t.Fatalf("second request: expected 429, got %d", rec2.Code)
	}

	// Verify Retry-After header (computed: ceil(1/0.001) = 1000).
	if ra := rec2.Header().Get("Retry-After"); ra != "1000" {
		t.Fatalf("expected Retry-After: 1000, got %q", ra)
	}

	// Verify JSON error body.
	var body map[string]map[string]string
	if err := json.NewDecoder(rec2.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["error"]["code"] != "RATE_LIMITED" {
		t.Fatalf("expected error code RATE_LIMITED, got %q", body["error"]["code"])
	}
	if body["error"]["message"] != "per-IP rate limit exceeded" {
		t.Fatalf("unexpected message: %q", body["error"]["message"])
	}
}

func TestMiddleware_PassesThrough(t *testing.T) {
	cfg := Config{
		IPRate:          100,
		IPBurst:         100,
		TenantRate:      100,
		TenantBurst:     100,
		CleanupInterval: time.Hour,
		StaleAfter:      time.Hour,
	}
	mw := Middleware(cfg)
	handler := mw(okHandler())

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.RemoteAddr = "10.0.0.1:12345"
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if rec.Body.String() != "ok" {
		t.Fatalf("expected body 'ok', got %q", rec.Body.String())
	}
}

func TestExtractIP_RemoteAddr(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "192.168.1.100:54321"

	ip := extractIP(req)
	if ip != "192.168.1.100" {
		t.Fatalf("expected 192.168.1.100, got %q", ip)
	}
}

func TestExtractIP_XForwardedFor_UsesRightmost(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "10.0.0.1:12345"
	req.Header.Set("X-Forwarded-For", "203.0.113.50, 70.41.3.18, 10.0.0.1")

	ip := extractIP(req)
	// Rightmost IP is the one appended by the last trusted proxy.
	if ip != "10.0.0.1" {
		t.Fatalf("expected rightmost XFF IP 10.0.0.1, got %q", ip)
	}
}

func TestExtractIP_XForwardedFor_Single(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "10.0.0.1:12345"
	req.Header.Set("X-Forwarded-For", "203.0.113.50")

	ip := extractIP(req)
	if ip != "203.0.113.50" {
		t.Fatalf("expected 203.0.113.50, got %q", ip)
	}
}

func TestExtractIP_XRealIP_TakesPriority(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "10.0.0.1:12345"
	req.Header.Set("X-Real-IP", "198.51.100.5")
	req.Header.Set("X-Forwarded-For", "203.0.113.50, 70.41.3.18")

	ip := extractIP(req)
	if ip != "198.51.100.5" {
		t.Fatalf("expected X-Real-IP 198.51.100.5 to take priority, got %q", ip)
	}
}

func TestExtractIP_IPv6_RemoteAddr(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "[::1]:12345"

	ip := extractIP(req)
	if ip != "::1" {
		t.Fatalf("expected ::1, got %q", ip)
	}
}

func TestExtractIP_RemoteAddrNoPort(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "192.168.1.100" // no port

	ip := extractIP(req)
	if ip != "192.168.1.100" {
		t.Fatalf("expected 192.168.1.100, got %q", ip)
	}
}

func TestDefaultConfig(t *testing.T) {
	// Test with defaults (no env vars set).
	cfg := DefaultConfig()
	if cfg.IPRate != 1.0 {
		t.Fatalf("expected default IPRate 1.0, got %f", cfg.IPRate)
	}
	if cfg.IPBurst != 20 {
		t.Fatalf("expected default IPBurst 20, got %d", cfg.IPBurst)
	}
	if cfg.TenantRate != 2.0 {
		t.Fatalf("expected default TenantRate 2.0, got %f", cfg.TenantRate)
	}
	if cfg.TenantBurst != 40 {
		t.Fatalf("expected default TenantBurst 40, got %d", cfg.TenantBurst)
	}
}

func TestDefaultConfig_EnvOverride(t *testing.T) {
	t.Setenv("RATE_LIMIT_IP_RATE", "5.0")
	t.Setenv("RATE_LIMIT_IP_BURST", "50")
	t.Setenv("RATE_LIMIT_TENANT_RATE", "10.0")
	t.Setenv("RATE_LIMIT_TENANT_BURST", "100")

	cfg := DefaultConfig()
	if cfg.IPRate != 5.0 {
		t.Fatalf("expected IPRate 5.0, got %f", cfg.IPRate)
	}
	if cfg.IPBurst != 50 {
		t.Fatalf("expected IPBurst 50, got %d", cfg.IPBurst)
	}
	if cfg.TenantRate != 10.0 {
		t.Fatalf("expected TenantRate 10.0, got %f", cfg.TenantRate)
	}
	if cfg.TenantBurst != 100 {
		t.Fatalf("expected TenantBurst 100, got %d", cfg.TenantBurst)
	}
}

func TestGetEnvFloat_Valid(t *testing.T) {
	t.Setenv("TEST_FLOAT", "3.14")
	v := envutil.GetEnvFloat("TEST_FLOAT", 1.0)
	if v != 3.14 {
		t.Fatalf("expected 3.14, got %f", v)
	}
}

func TestGetEnvFloat_Invalid(t *testing.T) {
	t.Setenv("TEST_FLOAT_BAD", "not-a-number")
	v := envutil.GetEnvFloat("TEST_FLOAT_BAD", 1.0)
	if v != 1.0 {
		t.Fatalf("expected fallback 1.0, got %f", v)
	}
}

func TestGetEnvFloat_Negative(t *testing.T) {
	t.Setenv("TEST_FLOAT_NEG", "-5.0")
	v := envutil.GetEnvFloat("TEST_FLOAT_NEG", 1.0)
	if v != 1.0 {
		t.Fatalf("expected fallback 1.0 for negative value, got %f", v)
	}
}

func TestGetEnvInt_Valid(t *testing.T) {
	t.Setenv("TEST_INT", "42")
	v := envutil.GetEnvInt("TEST_INT", 10)
	if v != 42 {
		t.Fatalf("expected 42, got %d", v)
	}
}

func TestGetEnvInt_Invalid(t *testing.T) {
	t.Setenv("TEST_INT_BAD", "abc")
	v := envutil.GetEnvInt("TEST_INT_BAD", 10)
	if v != 10 {
		t.Fatalf("expected fallback 10, got %d", v)
	}
}

func TestGetEnvInt_Negative(t *testing.T) {
	t.Setenv("TEST_INT_NEG", "-3")
	v := envutil.GetEnvInt("TEST_INT_NEG", 10)
	if v != 10 {
		t.Fatalf("expected fallback 10 for negative value, got %d", v)
	}
}

// signTestToken creates a valid HS256 JWT for testing.
func signTestToken(t *testing.T, secret []byte, claims map[string]interface{}) string {
	t.Helper()
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		t.Fatalf("marshal claims: %v", err)
	}
	payload := base64.RawURLEncoding.EncodeToString(claimsJSON)
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(header + "." + payload))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return header + "." + payload + "." + sig
}

func TestMiddleware_TenantRateLimit(t *testing.T) {
	secret := []byte("test-secret-tenant-rl")

	// Tight tenant limit: burst=1 so 2nd request is rejected.
	// Generous IP limit so IP limiting doesn't interfere.
	cfg := Config{
		IPRate:          100,
		IPBurst:         100,
		TenantRate:      0.001,
		TenantBurst:     1,
		CleanupInterval: time.Hour,
		StaleAfter:      time.Hour,
	}

	// Chain: auth middleware (sets tenant in context) -> rate limit middleware -> handler.
	rlMiddleware := Middleware(cfg)
	authMiddleware := auth.NewMiddleware(secret)
	handler := authMiddleware(rlMiddleware(okHandler()))

	token := signTestToken(t, secret, map[string]interface{}{
		"sub":       "user-1",
		"tenant_id": "tenant-xyz",
		"role":      "staff",
		"member_id": "m1",
		"exp":       time.Now().Add(1 * time.Hour).Unix(),
	})

	// First request — should pass.
	req1 := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req1.RemoteAddr = "10.0.0.1:12345"
	req1.Header.Set("Authorization", "Bearer "+token)
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("first request: expected 200, got %d; body: %s", rec1.Code, rec1.Body.String())
	}

	// Second request from different IP but same tenant — should be tenant-limited.
	req2 := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req2.RemoteAddr = "10.0.0.2:12345"
	req2.Header.Set("Authorization", "Bearer "+token)
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusTooManyRequests {
		t.Fatalf("second request: expected 429 (tenant limited), got %d; body: %s", rec2.Code, rec2.Body.String())
	}

	// Verify the error message indicates tenant limiting.
	var body map[string]map[string]string
	if err := json.NewDecoder(rec2.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["error"]["message"] != "per-tenant rate limit exceeded" {
		t.Fatalf("expected per-tenant message, got %q", body["error"]["message"])
	}
}

func TestMiddleware_CleanupStopsOnContextCancel(t *testing.T) {
	cfg := Config{
		IPRate:          10,
		IPBurst:         5,
		TenantRate:      20,
		TenantBurst:     10,
		CleanupInterval: 50 * time.Millisecond,
		StaleAfter:      10 * time.Millisecond,
	}

	ctx, cancel := context.WithCancel(context.Background())
	handler := MiddlewareWithContext(ctx, cfg)(okHandler())

	// Make a request to populate limiters
	req := httptest.NewRequest("GET", "/api/v1/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// Cancel context — cleanup goroutine should stop
	cancel()
	time.Sleep(100 * time.Millisecond)
	// If we get here without hanging, the cleanup goroutine respected cancellation
}
