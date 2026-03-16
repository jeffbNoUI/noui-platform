# Comprehensive Quality, Security & Performance Review — Design Document

**Date:** 2026-03-15
**Scope:** Entire noui-platform codebase
**Duration:** ~8 sessions across 4 parallel workstreams
**Scale parameters:** 2–500 staff users, up to 250K member portal users, 30 years transactional data, burst traffic pattern

---

## Motivation

The noui-platform has been built over 20 rapid development sessions. The codebase is functional — all builds clean, 592+ frontend tests pass, 130+ Go tests pass, Docker stack runs end-to-end. But it was built for demo-scale (12 members, 4 cases) and lacks the security, performance, and test hardening required for production with 250K members, 30 years of pension contribution/payroll history, and burst traffic from member portal events.

This review prepares the system for:
- Role-based security (field-level masking + organizational scoping)
- Member portal at scale (250K users, burst-heavy traffic patterns)
- Fiduciary-grade data isolation (members must never see other members' data)
- Sustainable development velocity (comprehensive tests, clean code)

---

## Approach: Parallel Workstreams

Four independent workstreams, executed 2–3 per session with parallel agents.

### WS-1: Security Hardening (Sessions 1–4)

**S1.1 — Auth Middleware (CRITICAL)**
- Create shared `platform/auth/` package with JWT validation middleware
- Wire into all 7 Go services; extract tenant/member/role from validated token claims
- Reject raw `X-Tenant-ID` headers — must come from token
- Health endpoint bypass (`/healthz`)
- Service-to-service internal auth for inter-service calls

**S1.7 — Row-Level Security (CRITICAL)**
- Oracle VPD equivalent: PostgreSQL RLS on every content table
- Two isolation dimensions:
  - Tenant isolation: `tenant_id = current_setting('app.tenant_id')::TEXT`
  - Member isolation: staff sees all within tenant; members see only their own rows
- Transaction-local `set_config` in Go auth middleware (compatible with connection pooling)
- Migration enabling RLS + policies on: member, salary_history, contribution, beneficiary, retirement_case, correspondence_history, case_note, case_document, crm tables
- Integration tests: member A cannot see member B's data; tenant A cannot see tenant B's data

**S1.2 — CORS Lockdown (HIGH)**
- Remove wildcard `*` from connector service
- Standardize CORS middleware across all services via environment-configured origin
- Update Docker Compose + Helm with `CORS_ORIGIN` env var

**S1.3 — Input Validation (HIGH)**
- Create shared `platform/validate/` package
- String length limits, enum validation, date range validation
- Request body size limit via `http.MaxBytesReader` on all services

**S1.4 — Rate Limiting (MEDIUM)**
- Per-IP and per-tenant rate limits on public-facing endpoints
- Burst-friendly limits for member portal (high ceiling, short window)
- Stricter limits on search/query endpoints

**S1.5 — Frontend Route Guards (MEDIUM)**
- Auth context provider wrapping the app
- Role-based view access enforcement (UX layer, backend remains security boundary)
- Field-level masking utilities for sensitive data (SSN, salary)

**S1.6 — Security Headers (MEDIUM)**
- CSP, X-Frame-Options, X-Content-Type-Options, HSTS via nginx or middleware
- Disable server version headers
- Audit Docker images for unnecessary packages

### WS-2: Performance & Scalability (Sessions 5–7)

**P2.1 — Database Query Audit (HIGH)**
- EXPLAIN ANALYZE on all queries touching member/salary/contribution/benefit tables at 250K scale
- Missing index identification and creation
- Enforce pagination on all list endpoints (no unbounded SELECTs)
- Cursor-based pagination for member portal endpoints
- Key risk: ILIKE member search, case stats aggregation (5 queries per dashboard load), salary/contribution history (~90M rows at scale)

**P2.2 — Connection Pooling (HIGH)**
- Current: 7 services × 25 max = 175 connections (PostgreSQL default max is 100)
- Add PgBouncer to Docker stack (transaction pooling mode for RLS compatibility)
- Right-size per-service pools based on actual load profile
- Add connection pool health metrics

**P2.3 — Caching Strategy (MEDIUM)**
- In-memory cache for static data (stage definitions: 24hr, KB articles: 1hr)
- Evaluate Redis for member data caching
- Cache-Control headers on read-only GET endpoints
- Reduce frontend React Query stale time to 2 min for member portal

**P2.4 — Request Timeout & Resilience (MEDIUM)**
- Frontend: AbortController with 30s timeout in apiClient.ts
- Go: per-query context timeouts (5s reads, 15s aggregations)
- Nginx proxy timeout configuration

**P2.5 — Payload Optimization (LOW)**
- Trim unnecessary fields from list endpoints
- Enable gzip in nginx
- Field selection for high-traffic endpoints

### WS-3: Test Suite Optimization (Sessions 3–6)

**T3.1 — Go Service Test Gaps (HIGH)**
- Add DB-layer tests to 6 underserved services (dataaccess, intelligence, crm, correspondence, dataquality, knowledgebase)
- Highly parallelizable: 1 agent per service, zero shared code
- Target: double Go test count

**T3.2 — Frontend Component Coverage Gaps (MEDIUM)**
- ~30 components lacking tests (dashboard cards, detail overlays, panels)
- Fetch-mock pattern at network layer (per established testing strategy)
- renderWithProviders for all components using React Query hooks

**T3.3 — Test Tiering (MEDIUM)**
- Tier 1 (dev loop, <15s): `go test -short` + `vitest run`
- Tier 2 (CI, <3min): full Go tests + vitest with coverage + E2E
- Tag DB-dependent Go tests with `testing.Short()` skip
- Document tier commands in CLAUDE.md

**T3.4 — Test Quality Audit (LOW)**
- Identify over-mocked tests (testing mock behavior, not real behavior)
- Find render-only tests with no meaningful assertions
- Check for hardcoded values that could drift

### WS-4: Code Quality Sweep (Sessions 1, 7–8)

**Q4.1 — Structured Logging (MEDIUM)**
- Migrate all Go services from `log.Printf` to `slog` (JSON structured)
- Add request logging middleware to all platform services
- Include request ID, tenant ID, duration in every log line

**Q4.2 — TypeScript Strictness (MEDIUM)**
- Replace `any` types in apiClient with proper generics
- Verify `strict: true` in tsconfig.json
- Consider `noUncheckedIndexedAccess`

**Q4.3 — Component Decomposition (LOW)**
- Split App.tsx (714 lines) into routing, dispatch, command palette
- Split large portal components into container + presentational
- Target: no component >250 lines

**Q4.4 — Dead Code & Dependency Cleanup (LOW)**
- Remove unused exports, demo data references
- `npm audit` + `go mod tidy`
- Remove deprecated Docker Compose `version` attribute

**Q4.5 — API Consistency (LOW)**
- Standardize error response shape: `{error: {code, message}}`
- Standardize pagination: `{data: [], meta: {total, limit, offset}}`
- Correct HTTP status codes (201 creates, 204 deletes)

---

## Session Roadmap

| Session | Workstreams | Key Deliverables |
|---------|------------|-----------------|
| 1 | S1.1 Auth Middleware + Q4.1 Structured Logging | JWT validation package, slog migration, request logging |
| 2 | S1.7 RLS + S1.2 CORS | RLS migration on all tables, member isolation policies, CORS lockdown |
| 3 | S1.3 Input Validation + T3.1 Go Tests (batch 1) | Validation package, tests for dataaccess + intelligence + crm |
| 4 | S1.4 Rate Limiting + T3.1 Go Tests (batch 2) | Rate limiter, tests for correspondence + dataquality + knowledgebase |
| 5 | T3.2 Frontend Gaps + T3.3 Test Tiering | ~30 component tests, tier documentation |
| 6 | P2.1 Query Audit + P2.2 Connection Pooling | Index additions, PgBouncer, pool right-sizing |
| 7 | P2.3 Caching + P2.4 Timeouts + S1.5 Frontend Guards | Cache layer, abort controllers, route guards |
| 8 | Q4.2–Q4.5 Code Quality + Final Regression | TS strictness, dead code removal, component splits, full test run |

## Completion Gates

- **WS-1:** All CRITICAL/HIGH findings resolved. JWT on every service. RLS on every content table. CORS locked. Member A cannot see member B's data.
- **WS-2:** Query plans verified at 250K scale. PgBouncer in stack. Pagination enforced. No unbounded queries.
- **WS-3:** Go test count doubled. Frontend component gaps filled. Two-tier test model documented and working.
- **WS-4:** Zero `any` in production TS. Structured JSON logging. No component >250 lines. Clean dependency audit.

---

*NoUI Platform — Quality, Security & Performance Review Design v1.0*
*2026-03-15 — Provaliant TPM Confidential*
