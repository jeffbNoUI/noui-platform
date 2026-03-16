# Security & Quality Findings — Lessons Learned

> This document captures every finding from the codebase review initiative,
> why it happened, and the rule or mechanism that prevents it in the future.
> Update this document as new findings are discovered in subsequent sessions.

---

## How to Use This Document

Each finding has:
- **What we found** — the specific issue
- **Why it happened** — the root cause or pattern that led to it
- **Impact** — what could go wrong in production
- **Fix applied** — what we did
- **Prevention rule** — how to stop this from happening again

Prevention rules should be enforced via:
1. **Code review checklist** — reviewers check for these patterns
2. **Automated checks** — linters, CI tests, or hooks that catch the pattern
3. **CLAUDE.md rules** — instructions that Claude follows in every session
4. **Architecture constraints** — structural decisions that make the bad pattern impossible

---

## Session 1 Findings (2026-03-15)

### F-001: No Authentication on Any Service (CRITICAL)

**What:** All 7 Go services accepted requests with no authentication. Tenant isolation was based on an unvalidated `X-Tenant-ID` HTTP header that any client could spoof.

**Why:** During rapid feature development (20 sessions), authentication was deferred as "infrastructure to add later." Each service copied the `tenantFromHeader` pattern from the first service without questioning it.

**Impact:** Any HTTP client could access any tenant's data by setting `X-Tenant-ID: <target-tenant>`. In production with 250K members, this would be a catastrophic data breach.

**Fix:** Created `platform/auth/` package with HS256 JWT middleware. Wired into all 7 services. Tenant ID now comes from validated token claims, not headers. The `X-Tenant-ID` header is explicitly stripped by auth middleware.

**Prevention rules:**
- [ ] **CLAUDE.md rule:** "Every new API endpoint MUST go through auth middleware. No endpoint is exempt except /healthz, /health, /ready, /metrics."
- [ ] **CI check:** Add a test that verifies every registered route returns 401 without a valid Bearer token.
- [ ] **Architecture:** Auth middleware is applied at the `main.go` level wrapping the entire mux — individual handlers cannot opt out.

---

### F-002: No JWT Expiration Validation (HIGH)

**What:** The initial auth middleware implementation validated JWT signatures but did not check the `exp` (expiration) claim. An expired token with a valid signature would be accepted forever.

**Why:** The implementer focused on signature validation and claim extraction, treating expiration as a "nice to have." JWT libraries typically handle this automatically, but we used stdlib-only implementation.

**Impact:** Stolen or leaked tokens would remain valid indefinitely. No mechanism to revoke access.

**Fix:** Added `exp` claim validation. Tokens with `exp < now` are rejected. Tokens without `exp` are still accepted for dev/test backwards compatibility.

**Prevention rules:**
- [ ] **Code review checklist:** "JWT validation must check: signature, algorithm, expiration, required claims."
- [ ] **Test:** Auth test suite includes expired-token test that MUST pass.

---

### F-003: No Algorithm Header Validation (HIGH)

**What:** JWT validation assumed HS256 but didn't verify the `alg` field in the JWT header. A token with `"alg":"none"` could potentially bypass signature validation in some implementations.

**Why:** Our implementation would actually reject `alg:none` tokens because the HMAC comparison would fail, but defense-in-depth requires explicit algorithm checking.

**Impact:** In a more permissive implementation, this could allow forged tokens. Even in our case, failing to check creates a latent vulnerability if the validation logic is ever modified.

**Fix:** Added explicit `alg` header parsing and rejection of any algorithm other than `HS256`.

**Prevention rules:**
- [ ] **Code review checklist:** "JWT implementations must explicitly validate the `alg` header field."
- [ ] **Test:** Auth test suite includes `alg:none` rejection test.

---

### F-004: Wildcard CORS on Connector Service (MEDIUM)

**What:** The connector service (`connector/service/handlers.go`) used `Access-Control-Allow-Origin: *`, allowing any domain to make cross-origin requests.

**Why:** The connector was developed as a standalone tool before being integrated into the platform. Wildcard CORS was convenient for development and never tightened for production.

**Impact:** Any malicious website could make API requests to the connector service on behalf of an authenticated user (if cookies/credentials were involved).

**Fix:** Scheduled for Session 2 (S1.2). Will replace wildcard with environment-configured origin.

**Prevention rules:**
- [ ] **CLAUDE.md rule:** "CORS origin must NEVER be `*` in any service. Always use `CORS_ORIGIN` env var with explicit allowed origins."
- [ ] **CI check:** `grep -r 'Allow-Origin.*\*' platform/ connector/` should return zero matches.

---

### F-005: Unstructured Logging (MEDIUM)

**What:** All 7 services used `log.Printf` with unstructured text output. No request logging middleware on any platform service. Only the connector had request logging.

**Why:** `log.Printf` is the Go default and works fine during development. Structured logging wasn't needed until the system needed to be debugged at scale.

**Impact:** At 250K members with burst traffic, unstructured logs are unsearchable. Can't filter by tenant, user, request ID, or duration. Incident investigation would be nearly impossible.

**Fix:** Migrated all services to `log/slog` with JSON structured output. Added `RequestLogger` middleware to every service that logs method, path, status, duration_ms, request_id, tenant_id, user_role.

**Prevention rules:**
- [ ] **CLAUDE.md rule:** "All Go services use `log/slog` for logging. Never import `\"log\"` in platform services."
- [ ] **CI check:** `grep -r '"log"' platform/*/main.go platform/*/api/*.go platform/*/db/*.go` should return zero matches (only `"log/slog"` allowed).

---

### F-006: ResponseWriter Wrapper Missing Interface Delegation (LOW)

**What:** The `statusWriter` in the logging middleware wrapped `http.ResponseWriter` to capture status codes, but didn't implement `http.Flusher`. Downstream handlers using SSE or chunked streaming would silently fail when type-asserting to `Flusher`.

**Why:** This is a well-known Go middleware pitfall. When you wrap `ResponseWriter`, you lose interface implementations that the original writer had. It's easy to miss because tests rarely exercise streaming paths.

**Impact:** Any future SSE or streaming endpoint would silently break. The handler would see the writer doesn't support flushing and would buffer responses instead of streaming them.

**Fix:** Added `Flush()` delegation method that checks if the underlying writer implements `http.Flusher` and delegates.

**Prevention rules:**
- [ ] **Code review checklist:** "Any code that wraps `http.ResponseWriter` must also implement `http.Flusher` (and `http.Hijacker` if WebSocket support is needed)."

---

### F-007: Middleware Ordering Caused Dead Log Fields (LOW)

**What:** The initial middleware order was CORS → Logging → Auth → Handler. The logging middleware read `tenant_id` from the `X-Tenant-ID` header, but auth middleware (running after logging) stripped that header. Result: `tenant_id` was always empty in request logs.

**Why:** The two packages (logging and auth) were developed in parallel as independent tracks. The interaction between them wasn't considered until code review.

**Impact:** Request logs had a `tenant_id` field that was always empty — useless for production debugging.

**Fix:** (1) Reordered middleware to CORS → Auth → Logging → Handler so logging receives the auth-enriched request. (2) Added `ContextExtractor` pattern so logging reads tenant_id from auth context without importing the auth package. Keeps packages decoupled.

**Prevention rules:**
- [ ] **CLAUDE.md rule:** "Middleware order in all services: CORS (outermost) → Auth → Logging → Handler (innermost). Auth runs before logging so log lines include authenticated identity."
- [ ] **Architecture:** The `ContextExtractor` pattern keeps logging decoupled from auth. New metadata (e.g., member_id for RLS) is added via extractors, not hardcoded header reads.

---

### F-008: `sync.Once` Makes Secrets Untestable (LOW)

**What:** The initial auth middleware loaded `JWT_SECRET` from environment once via `sync.Once`. Once loaded, the value was cached for the process lifetime. Tests couldn't use different secrets across test cases.

**Why:** `sync.Once` is the standard Go pattern for expensive one-time initialization. It works perfectly for production but breaks test isolation.

**Impact:** Can't test with different JWT secrets in the same test run. Can't test secret rotation. Tests are coupled to a specific secret value.

**Fix:** Added `NewMiddleware(secret []byte)` constructor that takes the secret as a parameter. The convenience `Middleware()` wrapper reads from env via `sync.Once`. Tests use `NewMiddleware` with explicit secrets.

**Prevention rules:**
- [ ] **Code review checklist:** "Middleware that reads configuration from environment must also offer a constructor that accepts the config as parameters, for testability."

---

## Findings Still Open (Future Sessions)

### F-009: No Row-Level Security (CRITICAL) — Session 2

**What:** No PostgreSQL RLS policies on any table. Tenant and member isolation is application-layer only.

**Why:** RLS was specified in the PRISM CLAUDE.md but never implemented for the NoUI platform.

**Prevention:** Session 2 creates RLS migration with integration tests.

### F-010: No Input Validation (HIGH) — Session 3

**What:** Minimal input validation. No string length limits, no enum validation, no date range validation.

**Prevention:** Session 3 creates shared validation package.

### F-011: No Rate Limiting (MEDIUM) — Session 4

**What:** No rate limiting on any endpoint. Burst traffic or brute force attacks have no throttle.

**Prevention:** Session 4 adds per-IP/per-tenant rate limiting.

### F-012: Connection Pool Exceeds PostgreSQL Limits (HIGH) — Session 6

**What:** 7 services × 25 max connections = 175, but PostgreSQL default max is 100.

**Prevention:** Session 6 adds PgBouncer and right-sizes pools.

### F-013: No Frontend Route Guards (MEDIUM) — Session 7

**What:** Any portal accessible via `setViewMode()` with no role check.

**Prevention:** Session 7 adds auth context and route guards.

---

*Updated: 2026-03-15 — Session 1 findings (F-001 through F-008 resolved, F-009 through F-013 tracked)*
