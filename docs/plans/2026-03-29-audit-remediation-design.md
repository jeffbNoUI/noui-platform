# Audit Remediation Design — P0 + P1 Fixes

**Date:** 2026-03-29
**Trigger:** Full codebase audit (Boris Cherney perspective)
**Scope:** 12 CRITICAL, 35 WARNING findings across 4 domains

## Work Packages

### WP-1: Close PATCH Gate Bypass (P0)
- Remove status field from PATCH `/engagements/{id}` handler
- Remove `StatusComplete` from `ValidTransitions[StatusReconciling]`
- Add test confirming PATCH rejects status changes
- Files: `engagement_handlers.go`, `types.go`, new test

### WP-2: Require JWT `exp` Claim (P0)
- Reject tokens where `Exp == 0`
- Remove `/health/detail` and `/api/v1/errors/report` from bypass paths
- Add test for missing-exp rejection
- Files: `auth.go`, `auth_test.go`

### WP-3: nginx Security Hardening (P1)
- Security headers: X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy
- Rate limiting: `limit_req_zone` on `/api/` routes
- Strip X-Tenant-ID at nginx (replace forwarding with empty string)
- Add missing routes: `/api/v1/scenarios`, `/api/v1/notifications`
- Files: `nginx.conf`

### WP-4: Docker Security Fixes (P1)
- Remove host port exposure: postgres (5432), pgbouncer (6432), migration-intelligence (8101)
- Add health checks to 20 services missing them
- Add 6 missing schema/seed volume mounts
- Files: `docker-compose.yml`

### WP-5: Intelligence Monetary Refactor (P0)
- Create `money/money.go` — Money type wrapping `big.Rat`
- Replace 48 float64 monetary fields across 15 structs
- Rewrite 10 formula functions to use Money arithmetic
- Fix roundToCents: current `math.Round` is NOT banker's rounding
- JSON serialization: emit `"10639.45"` strings, accept both on input
- Keep non-monetary floats (age, service years, factors) as float64
- Files: new `money/`, `models/types.go`, `rules/*.go`, `config/plan_config.go`, tests

## Execution Order
1. WP-1 through WP-4 in parallel (independent, ~10 min each)
2. WP-5 sequentially with test verification loops

## Not In Scope
- employer-reporting float64 fixes
- Frontend component decomposition
- Helm chart security contexts / NetworkPolicy
- Docker credential externalization
- Migration job queue retry_after fix
