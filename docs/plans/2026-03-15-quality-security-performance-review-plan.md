# Quality, Security & Performance Review — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the noui-platform codebase for production: JWT auth on every service, PostgreSQL RLS for member/tenant isolation, structured logging, input validation, performance at 250K-member scale, comprehensive test coverage.

**Architecture:** Four parallel workstreams (Security, Performance, Tests, Code Quality) executed across ~8 sessions. Each session dispatches 2–3 parallel agents on independent tasks. Session 1 focuses on auth middleware + structured logging — the two foundational pieces that every subsequent session builds on.

**Tech Stack:** Go 1.22 (slog for logging), PostgreSQL RLS, JWT validation, PgBouncer (future), React/TypeScript with React Query.

**Design Document:** `docs/plans/2026-03-15-quality-security-performance-review-design.md`

---

## Session 1: Auth Middleware + Structured Logging

### Overview

Two parallel tracks:
- **Track A:** Create JWT auth middleware package, wire into all 7 services
- **Track B:** Migrate all services from `log.Printf` to `slog` structured logging, add request logging middleware

These are independent — no shared code between tracks. Can be executed by parallel agents.

---

### Task 1: Create Auth Middleware Package (Track A — Foundation)

**Files:**
- Create: `platform/auth/go.mod`
- Create: `platform/auth/auth.go`
- Create: `platform/auth/auth_test.go`

**Step 1: Create Go module**

```bash
cd platform && mkdir -p auth
cd auth
go mod init github.com/noui/platform/auth
```

**Step 2: Write the failing test**

Create `platform/auth/auth_test.go`:

```go
package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMiddleware_NoAuthHeader_Returns401(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := Middleware(inner)
	req := httptest.NewRequest("GET", "/api/v1/cases", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestMiddleware_HealthEndpoint_Bypasses(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := Middleware(inner)
	req := httptest.NewRequest("GET", "/healthz", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 for health check, got %d", rec.Code)
	}
}

func TestMiddleware_ValidToken_ExtractsClaims(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tid := TenantID(r.Context())
		role := UserRole(r.Context())
		if tid == "" {
			t.Error("expected tenant_id in context")
		}
		if role == "" {
			t.Error("expected role in context")
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := Middleware(inner)
	req := httptest.NewRequest("GET", "/api/v1/cases", nil)
	// Use a test token — middleware should accept tokens signed with a test key
	req.Header.Set("Authorization", "Bearer "+testToken(t, "tenant-1", "staff", "member-1"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestMiddleware_InvalidToken_Returns401(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := Middleware(inner)
	req := httptest.NewRequest("GET", "/api/v1/cases", nil)
	req.Header.Set("Authorization", "Bearer invalid.token.here")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestMiddleware_RejectsRawTenantHeader(t *testing.T) {
	// Even with a valid token, X-Tenant-ID header should be ignored
	// (tenant comes from token claims, not headers)
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tid := TenantID(r.Context())
		if tid == "spoofed-tenant" {
			t.Error("tenant ID was taken from header instead of token")
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := Middleware(inner)
	req := httptest.NewRequest("GET", "/api/v1/cases", nil)
	req.Header.Set("Authorization", "Bearer "+testToken(t, "real-tenant", "staff", "member-1"))
	req.Header.Set("X-Tenant-ID", "spoofed-tenant")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestContextHelpers_DefaultEmpty(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	if TenantID(req.Context()) != "" {
		t.Error("expected empty tenant_id from bare context")
	}
	if UserRole(req.Context()) != "" {
		t.Error("expected empty role from bare context")
	}
	if MemberID(req.Context()) != "" {
		t.Error("expected empty member_id from bare context")
	}
}
```

**Step 3: Run test to verify it fails**

Run: `cd platform/auth && go test ./... -v -count=1`
Expected: FAIL — `Middleware`, `TenantID`, `UserRole`, `MemberID`, `testToken` undefined

**Step 4: Write the implementation**

Create `platform/auth/auth.go`:

```go
// Package auth provides JWT authentication middleware for noui platform services.
// It validates Bearer tokens, extracts tenant/member/role claims, and injects them
// into the request context. Health endpoints bypass authentication.
package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync"
)

type contextKey string

const (
	keyTenantID contextKey = "tenant_id"
	keyMemberID contextKey = "member_id"
	keyUserRole contextKey = "user_role"
	keyUserID   contextKey = "user_id"
)

// Claims extracted from a validated JWT.
type Claims struct {
	TenantID string `json:"tenant_id"`
	MemberID string `json:"member_id"`
	Role     string `json:"role"`
	UserID   string `json:"sub"`
}

// Context helpers — use these in handlers to read auth claims.
func TenantID(ctx context.Context) string {
	v, _ := ctx.Value(keyTenantID).(string)
	return v
}

func MemberID(ctx context.Context) string {
	v, _ := ctx.Value(keyMemberID).(string)
	return v
}

func UserRole(ctx context.Context) string {
	v, _ := ctx.Value(keyUserRole).(string)
	return v
}

func UserID(ctx context.Context) string {
	v, _ := ctx.Value(keyUserID).(string)
	return v
}

// bypassPaths are endpoints that do not require authentication.
var bypassPaths = map[string]bool{
	"/healthz":  true,
	"/health":   true,
	"/ready":    true,
	"/metrics":  true,
}

var (
	jwtSecret     []byte
	jwtSecretOnce sync.Once
)

func getSecret() []byte {
	jwtSecretOnce.Do(func() {
		s := os.Getenv("JWT_SECRET")
		if s == "" {
			s = "dev-secret-do-not-use-in-production"
			slog.Warn("JWT_SECRET not set, using insecure default — do NOT use in production")
		}
		jwtSecret = []byte(s)
	})
	return jwtSecret
}

// Middleware returns an HTTP middleware that validates JWT Bearer tokens.
// It extracts tenant_id, member_id, and role from the token claims and
// injects them into the request context. Bypass paths (health checks)
// are exempt from authentication.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Bypass auth for health/readiness endpoints
		if bypassPaths[r.URL.Path] {
			next.ServeHTTP(w, r)
			return
		}

		// OPTIONS preflight passes through (CORS middleware handles it)
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			writeAuthError(w, "missing or invalid Authorization header")
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := validateToken(token, getSecret())
		if err != nil {
			slog.Warn("auth failed", "error", err, "path", r.URL.Path)
			writeAuthError(w, "invalid token")
			return
		}

		// Inject claims into context — handlers read these, never raw headers
		ctx := r.Context()
		ctx = context.WithValue(ctx, keyTenantID, claims.TenantID)
		ctx = context.WithValue(ctx, keyMemberID, claims.MemberID)
		ctx = context.WithValue(ctx, keyUserRole, claims.Role)
		ctx = context.WithValue(ctx, keyUserID, claims.UserID)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// validateToken decodes and verifies an HS256 JWT.
func validateToken(token string, secret []byte) (*Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("malformed token: expected 3 parts, got %d", len(parts))
	}

	// Verify signature (HS256)
	signingInput := parts[0] + "." + parts[1]
	expectedSig := hmacSHA256([]byte(signingInput), secret)
	actualSig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("invalid signature encoding: %w", err)
	}
	if !hmac.Equal(expectedSig, actualSig) {
		return nil, fmt.Errorf("signature mismatch")
	}

	// Decode payload
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid payload encoding: %w", err)
	}

	var claims Claims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, fmt.Errorf("invalid claims JSON: %w", err)
	}

	if claims.TenantID == "" {
		return nil, fmt.Errorf("missing tenant_id claim")
	}
	if claims.Role == "" {
		return nil, fmt.Errorf("missing role claim")
	}

	return &claims, nil
}

func hmacSHA256(data, secret []byte) []byte {
	h := hmac.New(sha256.New, secret)
	h.Write(data)
	return h.Sum(nil)
}

func writeAuthError(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	fmt.Fprintf(w, `{"error":{"code":"UNAUTHORIZED","message":"%s"}}`, msg)
}
```

Also create a test helper in `platform/auth/auth_test.go` (append to existing):

```go
// testToken creates a signed HS256 JWT for testing.
func testToken(t *testing.T, tenantID, role, memberID string) string {
	t.Helper()

	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	claims := fmt.Sprintf(`{"tenant_id":"%s","role":"%s","member_id":"%s","sub":"user-1"}`,
		tenantID, role, memberID)
	payload := base64.RawURLEncoding.EncodeToString([]byte(claims))

	signingInput := header + "." + payload
	secret := []byte("dev-secret-do-not-use-in-production")
	h := hmac.New(sha256.New, secret)
	h.Write([]byte(signingInput))
	sig := base64.RawURLEncoding.EncodeToString(h.Sum(nil))

	return signingInput + "." + sig
}
```

**Step 5: Run tests to verify they pass**

Run: `cd platform/auth && go test ./... -v -count=1`
Expected: 6 PASS

**Step 6: Commit**

```bash
git add platform/auth/
git commit -m "[platform/auth] Add JWT authentication middleware with context helpers"
```

---

### Task 2: Wire Auth Middleware Into All 7 Services (Track A — Wiring)

**This task is highly parallelizable — 7 independent services, same pattern.**

**Files to modify (each service's main.go):**
- `platform/dataaccess/main.go` — lines 31-35 (mux → server wiring)
- `platform/intelligence/main.go` — lines 38-41
- `platform/crm/main.go` — lines 32-35
- `platform/correspondence/main.go` — lines 30-33
- `platform/dataquality/main.go` — lines 30-33
- `platform/knowledgebase/main.go` — lines 31-34
- `platform/casemanagement/main.go` — lines 30-33

**Files to modify (each service's go.mod):**
- Add `require github.com/noui/platform/auth v0.0.0` + `replace` directive

**Pattern for each service (example: casemanagement):**

**Step 1: Add auth dependency to go.mod**

In `platform/casemanagement/go.mod`, add:

```
require github.com/noui/platform/auth v0.0.0
replace github.com/noui/platform/auth => ../auth
```

Then run: `cd platform/casemanagement && go mod tidy`

**Step 2: Update main.go middleware chain**

Change the middleware chain from:
```go
wrappedMux := corsMiddleware(mux)
```
To:
```go
wrappedMux := corsMiddleware(auth.Middleware(mux))
```

Add import: `"github.com/noui/platform/auth"`

**Step 3: Remove tenantFromHeader function**

In `platform/casemanagement/api/handlers.go`, remove the `tenantFromHeader` function (lines 449-454) and the `defaultTenantID` constant.

Replace all calls to `tenantFromHeader(r)` with `auth.TenantID(r.Context())`.

**Step 4: Verify build**

Run: `cd platform/casemanagement && go build ./...`
Expected: clean build

**Step 5: Run existing tests**

Run: `cd platform/casemanagement && go test ./... -v -count=1`
Expected: existing tests pass (they create requests directly, not through middleware)

**Step 6: Commit**

```bash
git add platform/casemanagement/
git commit -m "[platform/casemanagement] Wire JWT auth middleware, remove header-based tenant"
```

**Repeat Steps 1-6 for each of the other 6 services.**

Services WITHOUT `tenantFromHeader` (dataaccess, intelligence): only add the middleware to main.go, no handler changes needed.

---

### Task 3: Structured Logging Foundation (Track B — Foundation)

**Files:**
- Modify: `platform/dataaccess/main.go` (representative — pattern applies to all 7)
- Create: `platform/logging/go.mod`
- Create: `platform/logging/logging.go`
- Create: `platform/logging/logging_test.go`

**Step 1: Create shared logging package**

```bash
cd platform && mkdir -p logging
cd logging
go mod init github.com/noui/platform/logging
```

**Step 2: Write the failing test**

Create `platform/logging/logging_test.go`:

```go
package logging

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequestLogger_LogsRequestFields(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := RequestLogger(logger)(inner)
	req := httptest.NewRequest("GET", "/api/v1/cases", nil)
	req.Header.Set("X-Request-ID", "req-123")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	var entry map[string]any
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("log output is not valid JSON: %v\nbuf: %s", err, buf.String())
	}

	if entry["method"] != "GET" {
		t.Errorf("expected method=GET, got %v", entry["method"])
	}
	if entry["path"] != "/api/v1/cases" {
		t.Errorf("expected path=/api/v1/cases, got %v", entry["path"])
	}
	if entry["request_id"] != "req-123" {
		t.Errorf("expected request_id=req-123, got %v", entry["request_id"])
	}
	if entry["status"] == nil {
		t.Error("expected status in log entry")
	}
	if entry["duration_ms"] == nil {
		t.Error("expected duration_ms in log entry")
	}
}

func TestRequestLogger_CapturesStatusCode(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})

	handler := RequestLogger(logger)(inner)
	req := httptest.NewRequest("GET", "/missing", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	var entry map[string]any
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	status, ok := entry["status"].(float64)
	if !ok || int(status) != 404 {
		t.Errorf("expected status=404, got %v", entry["status"])
	}
}

func TestSetup_ReturnsJSONLogger(t *testing.T) {
	var buf bytes.Buffer
	logger := Setup("test-service", &buf)

	logger.Info("hello", "key", "value")

	var entry map[string]any
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if entry["service"] != "test-service" {
		t.Errorf("expected service=test-service, got %v", entry["service"])
	}
}
```

**Step 3: Run test to verify it fails**

Run: `cd platform/logging && go test ./... -v -count=1`
Expected: FAIL — `RequestLogger`, `Setup` undefined

**Step 4: Write the implementation**

Create `platform/logging/logging.go`:

```go
// Package logging provides structured JSON logging and HTTP request logging
// middleware for noui platform services.
package logging

import (
	"io"
	"log/slog"
	"net/http"
	"os"
	"time"
)

// Setup creates a JSON structured logger with a service name attribute.
// If w is nil, writes to os.Stdout.
func Setup(serviceName string, w io.Writer) *slog.Logger {
	if w == nil {
		w = os.Stdout
	}
	return slog.New(slog.NewJSONHandler(w, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})).With("service", serviceName)
}

// RequestLogger returns middleware that logs every HTTP request as structured JSON.
// Log fields: method, path, status, duration_ms, request_id, tenant_id.
func RequestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			lw := &statusWriter{ResponseWriter: w, statusCode: http.StatusOK}

			next.ServeHTTP(lw, r)

			duration := time.Since(start)
			logger.Info("request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", lw.statusCode,
				"duration_ms", duration.Milliseconds(),
				"request_id", r.Header.Get("X-Request-ID"),
				"tenant_id", r.Header.Get("X-Tenant-ID"),
			)
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	statusCode int
}

func (w *statusWriter) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}
```

**Step 5: Run tests to verify they pass**

Run: `cd platform/logging && go test ./... -v -count=1`
Expected: 3 PASS

**Step 6: Commit**

```bash
git add platform/logging/
git commit -m "[platform/logging] Add structured JSON logging package with request logger middleware"
```

---

### Task 4: Wire Logging Into All 7 Services (Track B — Wiring)

**Same parallelization pattern as Task 2 — 7 independent services.**

**Pattern for each service (example: dataaccess):**

**Step 1: Add logging dependency to go.mod**

In `platform/dataaccess/go.mod`, add:
```
require github.com/noui/platform/logging v0.0.0
replace github.com/noui/platform/logging => ../logging
```

Then run: `cd platform/dataaccess && go mod tidy`

**Step 2: Update main.go**

Replace:
```go
import (
	"log"
	// ...
)
```

With:
```go
import (
	"log/slog"
	"github.com/noui/platform/logging"
	// ...
)
```

At service startup, before mux creation:
```go
logger := logging.Setup("dataaccess", nil)
slog.SetDefault(logger)
```

Update middleware chain from:
```go
wrappedMux := corsMiddleware(auth.Middleware(mux))
```
To:
```go
wrappedMux := corsMiddleware(logging.RequestLogger(logger)(auth.Middleware(mux)))
```

**Step 3: Replace log.Printf calls with slog**

In `platform/dataaccess/api/handlers.go`, replace all `log.Printf("error ...")` with:
```go
slog.Error("description", "error", err, "endpoint", "handler_name")
```

In `platform/dataaccess/db/postgres.go`, replace connection retry logging:
```go
slog.Info("database connected", "host", host, "dbname", dbname)
slog.Warn("database connection failed, retrying", "attempt", i, "error", err)
```

In `platform/dataaccess/main.go`, replace startup log:
```go
slog.Info("server starting", "port", port)
```

**Step 4: Verify build + tests**

Run: `cd platform/dataaccess && go build ./... && go test ./... -v -count=1`
Expected: clean build, all existing tests pass

**Step 5: Commit**

```bash
git add platform/dataaccess/
git commit -m "[platform/dataaccess] Wire structured logging + request logger middleware"
```

**Repeat Steps 1-5 for each of the other 6 services.**

Approximate `log.Printf` replacement counts per service:
- dataaccess: 22 calls
- intelligence: 8 calls
- crm: 5 calls
- correspondence: 5 calls
- dataquality: 5 calls
- knowledgebase: 5 calls
- casemanagement: 5 calls

---

### Task 5: Session 1 Integration Verification

**Step 1: Build all services**

```bash
cd platform/dataaccess && go build ./...
cd ../intelligence && go build ./...
cd ../crm && go build ./...
cd ../correspondence && go build ./...
cd ../dataquality && go build ./...
cd ../knowledgebase && go build ./...
cd ../casemanagement && go build ./...
cd ../../connector && go build ./...
cd ../frontend && npx tsc --noEmit
```

Expected: all clean

**Step 2: Run all tests**

```bash
cd platform/auth && go test ./... -v -count=1
cd ../logging && go test ./... -v -count=1
cd ../dataaccess && go test ./... -v -count=1
cd ../intelligence && go test ./... -v -count=1
cd ../crm && go test ./... -v -count=1
cd ../correspondence && go test ./... -v -count=1
cd ../dataquality && go test ./... -v -count=1
cd ../knowledgebase && go test ./... -v -count=1
cd ../casemanagement && go test ./... -v -count=1
cd ../../frontend && npm test -- --run
```

Expected: all pass, zero regressions

**Step 3: Commit + push**

```bash
git push origin claude/silly-antonelli
```

---

## Session 2: Row-Level Security + CORS Lockdown

### Task 6: RLS Migration — Enable + Tenant Policies

**Files:**
- Create: `domains/pension/schema/026_row_level_security.sql`

**Content:** Migration that:
1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on every content table
2. Creates tenant isolation policies using `current_setting('app.tenant_id')`
3. Creates member isolation policies (staff bypass, member self-only)
4. Tables: `member`, `salary_history`, `contribution`, `beneficiary`, `retirement_case`, `case_note`, `case_document`, `case_stage_history`, `case_flag`, `correspondence_history`, `correspondence_template`, `crm_contact`, `crm_conversation`, `crm_interaction`, `crm_commitment`, `dq_check`, `dq_issue`

### Task 7: Go Services — set_config Per Request

**Files:** Modify each service's middleware or DB layer to call:
```sql
SELECT set_config('app.tenant_id', $1, true),
       set_config('app.member_id', $2, true),
       set_config('app.user_role', $3, true)
```
...at the start of every request, using claims from auth middleware context.

### Task 8: RLS Integration Tests

**Files:**
- Create: `platform/dataaccess/db/rls_test.go`

Tests:
- Member A queries — only sees own salary/contribution/beneficiary data
- Tenant A queries — cannot see tenant B data
- Staff role — sees all members within tenant
- Raw SQL with wrong member_id — returns empty (not error)

### Task 9: CORS Lockdown

**Files:**
- Modify: `connector/service/handlers.go` — replace `*` with env-configured origin
- Modify: all 7 `platform/*/main.go` — verify CORS uses env var
- Modify: `docker-compose.yml` — add `CORS_ORIGIN` env var
- Modify: `infrastructure/helm/` — add CORS_ORIGIN to Helm values

---

## Session 3: Input Validation + Go Tests Batch 1

### Task 10: Create Validation Package

**Files:**
- Create: `platform/validate/go.mod`
- Create: `platform/validate/validate.go`
- Create: `platform/validate/validate_test.go`

Validators: `StringLength(min, max)`, `Enum(allowed...)`, `DateRange(min, max)`, `PositiveInt()`, `UUID()`

### Task 11: Wire Validation Into Handlers

**Files:** Modify handlers in all services to validate inputs before processing.

### Task 12: Go Tests — dataaccess DB Layer

**Files:**
- Create: `platform/dataaccess/db/members_test.go`
- Create: `platform/dataaccess/db/salary_test.go`

Tests: member search queries, salary history queries, contribution queries with sqlmock.

### Task 13: Go Tests — intelligence DB + Logic Layer

**Files:**
- Create: `platform/intelligence/db/dro_test.go`
- Create: `platform/intelligence/api/scenario_test.go`

Tests: DRO calculation, scenario analysis, payment options.

### Task 14: Go Tests — crm DB Layer

**Files:**
- Create: `platform/crm/db/commitments_test.go`
- Create: `platform/crm/db/conversations_test.go`

Tests: commitment CRUD, conversation threading, interaction queries.

---

## Session 4: Rate Limiting + Go Tests Batch 2

### Task 15: Rate Limiting Middleware

**Files:**
- Create: `platform/ratelimit/go.mod`
- Create: `platform/ratelimit/ratelimit.go`
- Create: `platform/ratelimit/ratelimit_test.go`

Token bucket per IP. Configurable limits per endpoint pattern.

### Task 16: Go Tests — correspondence DB Layer

Tests: template queries, history filtering, merge field resolution.

### Task 17: Go Tests — dataquality DB Layer

Tests: score computation, issue CRUD, trend queries.

### Task 18: Go Tests — knowledgebase DB Layer

Tests: article search, stage lookup, rule references.

---

## Session 5: Frontend Test Gaps + Test Tiering

### Task 19: Frontend Component Tests — Dashboard Cards

Test ~15 untested dashboard/detail components using fetch-mock pattern.

### Task 20: Frontend Component Tests — Detail Overlays

Test remaining overlay components (props-based, no mocking needed).

### Task 21: Test Tiering Implementation

- Tag Go tests with `testing.Short()` skip for DB-dependent tests
- Add coverage configuration to vitest
- Document tier commands in CLAUDE.md
- Add pre-commit hook for Tier 1

---

## Session 6: Query Audit + Connection Pooling

### Task 22: EXPLAIN ANALYZE Audit

Run EXPLAIN ANALYZE on all queries against tables with projected 250K+ rows. Identify missing indexes. Create index migration.

### Task 23: Pagination Enforcement

Ensure every list endpoint has enforced limit/offset or cursor pagination. No unbounded SELECTs.

### Task 24: PgBouncer + Pool Right-Sizing

Add PgBouncer to Docker Compose in transaction pooling mode. Right-size per-service connection pools.

---

## Session 7: Caching + Timeouts + Frontend Guards

### Task 25: Server-Side Caching

In-memory cache for static data (stage definitions, KB articles). Cache-Control headers on GET endpoints.

### Task 26: Request Timeouts

AbortController in frontend apiClient.ts. Context timeouts on Go DB queries. Nginx proxy timeouts.

### Task 27: Frontend Auth Context + Route Guards

Auth context provider. Role-based portal access. Field-level masking utilities.

---

## Session 8: Code Quality + Final Regression

### Task 28: TypeScript Strictness

Replace `any` types. Verify strict mode. Add `noUncheckedIndexedAccess`.

### Task 29: Component Decomposition

Split App.tsx. Split large portal components. Target: no component >250 lines.

### Task 30: Dead Code + Dependency Cleanup

Remove unused exports. npm audit. go mod tidy. Remove deprecated Docker Compose version.

### Task 31: API Consistency

Standardize error response shape. Standardize pagination. Correct HTTP status codes.

### Task 32: Final Regression Suite

Full test run: all Go services, all frontend tests, Docker E2E. Verify zero regressions from Session 1 baseline.

---

*Plan v1.0 — 2026-03-15 — Covers Sessions 1-8*
*Session 1 tasks are fully specified. Sessions 2-8 are outlined — expand at session start.*
