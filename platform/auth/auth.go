// Package auth provides JWT authentication middleware for noui platform services.
//
// It validates HS256 JWTs, extracts tenant/user claims into the request context,
// and provides helper functions to retrieve those claims downstream.
package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// contextKey is an unexported type for context keys in this package.
type contextKey string

const (
	keyTenantID contextKey = "tenant_id"
	keyMemberID contextKey = "member_id"
	keyUserRole contextKey = "role"
	keyUserID   contextKey = "user_id"
)

const defaultSecret = "dev-secret-do-not-use-in-production"

var (
	jwtSecret     []byte
	jwtSecretOnce sync.Once
)

func getSecret() []byte {
	jwtSecretOnce.Do(func() {
		s := os.Getenv("JWT_SECRET")
		if s == "" {
			s = defaultSecret
			slog.Warn("JWT_SECRET not set, using default dev secret — do not use in production")
		}
		jwtSecret = []byte(s)
	})
	return jwtSecret
}

// bypassPaths are health/readiness endpoints that skip authentication.
var bypassPaths = map[string]bool{
	"/healthz":              true,
	"/health":               true,
	"/health/detail":        true,
	"/ready":                true,
	"/metrics":              true,
	"/api/v1/errors/report": true,
}

// NewMiddleware returns an HTTP middleware that validates JWT bearer tokens using the
// provided secret, and injects claims into the request context. This constructor
// enables testing with explicit secrets without relying on environment variables.
func NewMiddleware(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Bypass auth for health endpoints
			if bypassPaths[r.URL.Path] {
				next.ServeHTTP(w, r)
				return
			}

			// Bypass auth for CORS preflight
			if r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// Strip any spoofed X-Tenant-ID header before processing
			r.Header.Del("X-Tenant-ID")

			// Extract bearer token
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				writeUnauthorized(w, "missing or malformed Authorization header")
				return
			}
			token := strings.TrimPrefix(authHeader, "Bearer ")

			// Validate and parse JWT
			claims, err := validateTokenWithSecret(token, secret)
			if err != nil {
				slog.Warn("JWT validation failed", "error", err)
				writeUnauthorized(w, "invalid token")
				return
			}

			// Require tenant_id and role in claims
			if claims.TenantID == "" {
				writeUnauthorized(w, "token missing tenant_id claim")
				return
			}
			if claims.Role == "" {
				writeUnauthorized(w, "token missing role claim")
				return
			}

			// Inject claims into context
			ctx := r.Context()
			ctx = context.WithValue(ctx, keyTenantID, claims.TenantID)
			ctx = context.WithValue(ctx, keyMemberID, claims.MemberID)
			ctx = context.WithValue(ctx, keyUserRole, claims.Role)
			ctx = context.WithValue(ctx, keyUserID, claims.Sub)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// Middleware returns an HTTP middleware that validates JWT bearer tokens
// and injects claims into the request context. It reads the secret from
// the JWT_SECRET environment variable (falling back to a dev default).
func Middleware(next http.Handler) http.Handler {
	return NewMiddleware(getSecret())(next)
}

// jwtHeader holds the decoded JWT header fields.
type jwtHeader struct {
	Alg string `json:"alg"`
}

// tokenClaims holds the extracted JWT payload fields.
type tokenClaims struct {
	Sub      string `json:"sub"`
	TenantID string `json:"tenant_id"`
	Role     string `json:"role"`
	MemberID string `json:"member_id"`
	Exp      int64  `json:"exp"`
}

// validateTokenWithSecret verifies the HS256 signature and decodes the payload using the given secret.
func validateTokenWithSecret(token string, secret []byte) (*tokenClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errInvalidToken("expected 3 parts")
	}

	// Decode and verify algorithm header
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, errInvalidToken("invalid header encoding")
	}
	var hdr jwtHeader
	if err := json.Unmarshal(headerBytes, &hdr); err != nil {
		return nil, errInvalidToken("invalid header JSON")
	}
	if hdr.Alg != "HS256" {
		return nil, errInvalidToken("unsupported algorithm: " + hdr.Alg)
	}

	// Verify signature
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(parts[0] + "." + parts[1]))
	expectedSig := mac.Sum(nil)

	actualSig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, errInvalidToken("invalid signature encoding")
	}

	if !hmac.Equal(expectedSig, actualSig) {
		return nil, errInvalidToken("signature mismatch")
	}

	// Decode payload
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, errInvalidToken("invalid payload encoding")
	}

	var claims tokenClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, errInvalidToken("invalid payload JSON")
	}

	// Validate expiration if present
	if claims.Exp != 0 && claims.Exp < time.Now().Unix() {
		return nil, errInvalidToken("token expired")
	}

	return &claims, nil
}

type authError struct {
	reason string
}

func (e *authError) Error() string { return e.reason }

func errInvalidToken(reason string) error {
	return &authError{reason: reason}
}

func writeUnauthorized(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(map[string]map[string]string{
		"error": {
			"code":    "UNAUTHORIZED",
			"message": message,
		},
	})
}

// Claims holds the extracted JWT payload fields.
type Claims = tokenClaims

// ValidateToken verifies a JWT string using the environment secret and returns claims.
// Used by WebSocket handlers that can't use the HTTP middleware.
func ValidateToken(token string) (*Claims, error) {
	return validateTokenWithSecret(token, getSecret())
}

// TenantID returns the tenant ID from the request context, or empty string if not present.
func TenantID(ctx context.Context) string {
	v, _ := ctx.Value(keyTenantID).(string)
	return v
}

// MemberID returns the member ID from the request context, or empty string if not present.
func MemberID(ctx context.Context) string {
	v, _ := ctx.Value(keyMemberID).(string)
	return v
}

// UserRole returns the user role from the request context, or empty string if not present.
func UserRole(ctx context.Context) string {
	v, _ := ctx.Value(keyUserRole).(string)
	return v
}

// UserID returns the user ID (sub claim) from the request context, or empty string if not present.
func UserID(ctx context.Context) string {
	v, _ := ctx.Value(keyUserID).(string)
	return v
}

// WithTestClaims returns a context with the given auth claims injected.
// For use in tests only — allows testing handlers that check roles without
// going through JWT validation.
func WithTestClaims(ctx context.Context, tenantID, role, userID string) context.Context {
	ctx = context.WithValue(ctx, keyTenantID, tenantID)
	ctx = context.WithValue(ctx, keyUserRole, role)
	ctx = context.WithValue(ctx, keyUserID, userID)
	return ctx
}
