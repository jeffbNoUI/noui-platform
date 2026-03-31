package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const testSecret = "test-secret-for-unit-tests"

// testToken creates a valid HS256 JWT for testing using the default dev secret.
func testToken(t *testing.T, tenantID, role, memberID string) string {
	t.Helper()
	return signToken(t, []byte("dev-secret-do-not-use-in-production"), `{"alg":"HS256","typ":"JWT"}`, map[string]interface{}{
		"sub":       "user-123",
		"tenant_id": tenantID,
		"role":      role,
		"member_id": memberID,
		"exp":       time.Now().Add(1 * time.Hour).Unix(),
	})
}

// signToken creates a JWT with a custom header, claims map, and secret.
func signToken(t *testing.T, secret []byte, headerJSON string, claims map[string]interface{}) string {
	t.Helper()

	header := base64.RawURLEncoding.EncodeToString([]byte(headerJSON))

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

// echoHandler is a test handler that writes claims from context into the response.
func echoHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"tenant_id": TenantID(ctx),
			"member_id": MemberID(ctx),
			"role":      UserRole(ctx),
			"user_id":   UserID(ctx),
		})
	}
}

func TestMiddleware_NoAuthHeader_Returns401(t *testing.T) {
	handler := Middleware(echoHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/members", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}

	var body map[string]map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["error"]["code"] != "UNAUTHORIZED" {
		t.Fatalf("expected error code UNAUTHORIZED, got %q", body["error"]["code"])
	}
}

func TestMiddleware_HealthEndpoint_BypassesAuth(t *testing.T) {
	paths := []string{"/healthz", "/health", "/health/detail", "/ready", "/metrics"}
	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			handler := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("ok"))
			}))
			req := httptest.NewRequest(http.MethodGet, path, nil)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("expected 200 for %s, got %d", path, rec.Code)
			}
		})
	}
}

func TestMiddleware_OptionsRequest_BypassesAuth(t *testing.T) {
	handler := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodOptions, "/api/members", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for OPTIONS, got %d", rec.Code)
	}
}

func TestMiddleware_ValidToken_ExtractsClaims(t *testing.T) {
	token := testToken(t, "tenant-abc", "staff", "member-456")
	handler := Middleware(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/api/members", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d; body: %s", rec.Code, rec.Body.String())
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["tenant_id"] != "tenant-abc" {
		t.Fatalf("expected tenant_id=tenant-abc, got %q", body["tenant_id"])
	}
	if body["role"] != "staff" {
		t.Fatalf("expected role=staff, got %q", body["role"])
	}
	if body["member_id"] != "member-456" {
		t.Fatalf("expected member_id=member-456, got %q", body["member_id"])
	}
	if body["user_id"] != "user-123" {
		t.Fatalf("expected user_id=user-123, got %q", body["user_id"])
	}
}

func TestMiddleware_InvalidToken_Returns401(t *testing.T) {
	cases := []struct {
		name  string
		token string
	}{
		{"garbage", "not-a-jwt"},
		{"wrong signature", testToken(t, "t", "r", "m") + "tampered"},
		{"empty bearer", ""},
		{"two parts only", "aaa.bbb"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			handler := Middleware(echoHandler())
			req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
			if tc.token != "" {
				req.Header.Set("Authorization", "Bearer "+tc.token)
			}
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("expected 401, got %d", rec.Code)
			}
		})
	}
}

func TestMiddleware_SpoofedTenantHeader_UsesTokenClaim(t *testing.T) {
	token := testToken(t, "real-tenant", "staff", "m1")
	handler := Middleware(echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Tenant-ID", "spoofed-tenant")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]string
	json.NewDecoder(rec.Body).Decode(&body)
	if body["tenant_id"] != "real-tenant" {
		t.Fatalf("expected tenant from token (real-tenant), got %q", body["tenant_id"])
	}
}

func TestContextHelpers_BareContext_ReturnEmptyStrings(t *testing.T) {
	ctx := httptest.NewRequest(http.MethodGet, "/", nil).Context()

	if v := TenantID(ctx); v != "" {
		t.Fatalf("expected empty TenantID, got %q", v)
	}
	if v := MemberID(ctx); v != "" {
		t.Fatalf("expected empty MemberID, got %q", v)
	}
	if v := UserRole(ctx); v != "" {
		t.Fatalf("expected empty UserRole, got %q", v)
	}
	if v := UserID(ctx); v != "" {
		t.Fatalf("expected empty UserID, got %q", v)
	}
}

func TestMiddleware_MissingTenantInToken_Returns401(t *testing.T) {
	// Build a token with empty tenant_id — should be rejected
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	claims, _ := json.Marshal(map[string]interface{}{"sub": "u1", "tenant_id": "", "role": "staff", "exp": time.Now().Add(1 * time.Hour).Unix()})
	payload := base64.RawURLEncoding.EncodeToString(claims)
	secret := "dev-secret-do-not-use-in-production"
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(header + "." + payload))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	token := fmt.Sprintf("%s.%s.%s", header, payload, sig)

	handler := Middleware(echoHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for empty tenant, got %d", rec.Code)
	}
}

func TestMiddleware_MissingRoleInToken_Returns401(t *testing.T) {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	claims, _ := json.Marshal(map[string]interface{}{"sub": "u1", "tenant_id": "t1", "role": "", "exp": time.Now().Add(1 * time.Hour).Unix()})
	payload := base64.RawURLEncoding.EncodeToString(claims)
	secret := "dev-secret-do-not-use-in-production"
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(header + "." + payload))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	token := fmt.Sprintf("%s.%s.%s", header, payload, sig)

	handler := Middleware(echoHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for empty role, got %d", rec.Code)
	}
}

func TestMiddleware_ExpiredToken_Returns401(t *testing.T) {
	secret := []byte(testSecret)
	token := signToken(t, secret, `{"alg":"HS256","typ":"JWT"}`, map[string]interface{}{
		"sub":       "user-123",
		"tenant_id": "tenant-abc",
		"role":      "staff",
		"member_id": "m1",
		"exp":       time.Now().Add(-1 * time.Hour).Unix(),
	})

	handler := NewMiddleware(secret)(echoHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for expired token, got %d", rec.Code)
	}
}

func TestMiddleware_FutureExpToken_Returns200(t *testing.T) {
	secret := []byte(testSecret)
	token := signToken(t, secret, `{"alg":"HS256","typ":"JWT"}`, map[string]interface{}{
		"sub":       "user-123",
		"tenant_id": "tenant-abc",
		"role":      "staff",
		"member_id": "m1",
		"exp":       time.Now().Add(1 * time.Hour).Unix(),
	})

	handler := NewMiddleware(secret)(echoHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid future-exp token, got %d; body: %s", rec.Code, rec.Body.String())
	}
}

func TestMiddleware_NoExpClaim_Returns401(t *testing.T) {
	secret := []byte(testSecret)
	token := signToken(t, secret, `{"alg":"HS256","typ":"JWT"}`, map[string]interface{}{
		"sub":       "user-123",
		"tenant_id": "tenant-abc",
		"role":      "staff",
		"member_id": "m1",
	})

	handler := NewMiddleware(secret)(echoHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for token missing exp claim, got %d", rec.Code)
	}
}

func TestMiddleware_AlgNone_Returns401(t *testing.T) {
	secret := []byte(testSecret)
	// Sign with alg:"none" header — should be rejected even with valid signature
	token := signToken(t, secret, `{"alg":"none","typ":"JWT"}`, map[string]interface{}{
		"sub":       "user-123",
		"tenant_id": "tenant-abc",
		"role":      "staff",
	})

	handler := NewMiddleware(secret)(echoHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for alg:none token, got %d", rec.Code)
	}
}

func TestNewMiddleware_UsesProvidedSecret(t *testing.T) {
	secret := []byte("custom-test-secret")
	token := signToken(t, secret, `{"alg":"HS256","typ":"JWT"}`, map[string]interface{}{
		"sub":       "user-123",
		"tenant_id": "tenant-abc",
		"role":      "staff",
		"member_id": "m1",
		"exp":       time.Now().Add(1 * time.Hour).Unix(),
	})

	// Should work with matching secret
	handler := NewMiddleware(secret)(echoHandler())
	req := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 with matching secret, got %d", rec.Code)
	}

	// Should fail with wrong secret
	handler2 := NewMiddleware([]byte("wrong-secret"))(echoHandler())
	req2 := httptest.NewRequest(http.MethodGet, "/api/data", nil)
	req2.Header.Set("Authorization", "Bearer "+token)
	rec2 := httptest.NewRecorder()

	handler2.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 with wrong secret, got %d", rec2.Code)
	}
}
