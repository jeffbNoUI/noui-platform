# Code Audit Plan — Remaining Findings

> Generated 2026-03-09 from end-to-end code audit.
> Items already fixed in PR #11 are marked ✅.

---

## Phase 1: Quick Fixes (30 min)

These are one-line or one-file fixes that can be done in a single pass.

### 1.1 ✅ Fix dataaccess Dockerfile comment and binary name
**Status:** Done (PR #11, commit c2dd8f5)

### 1.2 ✅ Create connector Dockerfile + docker-compose entry
**Status:** Done (PR #11, commit c2dd8f5)

### 1.3 ✅ Add .env.example
**Status:** Done (PR #11, commit c2dd8f5)

### 1.4 ✅ Fix dataaccess health check service name
**Status:** Done (PR #11, commit 3baf68f)

### 1.5 ✅ Standardize Dockerfile binary names
**Status:** Done (PR #11, commit 3baf68f)

### 1.6 ✅ Add .dockerignore files to all service directories
**Status:** Done (PR #11, commit 3baf68f)

---

## Phase 2: Type Safety ✅

### 2.1 ✅ Replace `any` types in workflow stage props
**Status:** Done (PR #11, commit 76a2e7c). Created `Member` and `BenefitCalculation` interfaces in `frontend/src/types/`, replaced all 16 `any` annotations across 7 stage components.
**Location:** `frontend/src/components/workflow/stages/`
**Scope:** 16 instances of `: any` across 7 files

**Files and their `any` props:**
| File | Props using `any` |
|------|-------------------|
| `EligibilityStage.tsx` | `member`, `calculation`, `serviceCredit` |
| `BenefitStage.tsx` | `member`, `calculation`, `serviceCredit` |
| `VerifyEmploymentStage.tsx` | `member`, `employment`, `serviceCredit` |
| `DROStage.tsx` | `calculation` |
| `ElectionStage.tsx` | `member`, `calculation`, `buildPaymentOptions(calculation: any)` |
| `SubmitStage.tsx` | `member`, `calculation` |
| `IntakeStage.tsx` | `member?` |

**Approach:**
1. Check if shared types already exist in `frontend/src/types/` or `frontend/src/lib/`
2. If not, create `frontend/src/types/domain.ts` with interfaces for:
   - `Member` (id, name, hireDate, tier, etc.)
   - `BenefitCalculation` (ams, multiplier, yearsOfService, monthlyBenefit, etc.)
   - `ServiceCredit` (earnedYears, purchasedYears, totalYears)
   - `Employment` (employer, startDate, endDate, etc.)
3. Replace all `any` annotations with proper types
4. Run `npx tsc -p tsconfig.app.json --noEmit` to verify

**Why this matters:** These components handle fiduciary-critical data (benefit calculations, eligibility, retirement elections). Type safety catches data shape mismatches at compile time rather than runtime, where they could produce incorrect benefit amounts.
**Time:** 2-3 hours

---

## Phase 3: Test Coverage (partial)

### 3.1 ✅ Add dataaccess API handler tests
**Status:** Done (PR #12, commit 59c29a2)
**File to create:** `platform/dataaccess/api/handlers_test.go`
**Endpoints to test (8 total):**
1. `GET /healthz` — returns correct service name and status
2. `GET /api/v1/members/{id}` — valid ID, invalid ID, not found
3. `GET /api/v1/members/{id}/employment` — returns employment array
4. `GET /api/v1/members/{id}/salary` — returns salary history
5. `GET /api/v1/members/{id}/salary/ams` — AMS calculation correctness
6. `GET /api/v1/members/{id}/beneficiaries` — returns beneficiary list
7. `GET /api/v1/members/{id}/dro` — DRO status
8. `GET /api/v1/members/{id}/contributions` — contribution records
9. `GET /api/v1/members/{id}/service-credit` — earned vs purchased distinction

**Testing pattern:** Follow `platform/correspondence/api/handlers_test.go` and `platform/dataquality/api/handlers_test.go` as examples. Use `httptest.NewServer` with mock DB or in-memory fixtures.

**Critical test:** Service credit must test earned-only vs total service credit (CLAUDE.md "Service Purchase Exclusion" rule).
**Time:** 4-6 hours

### 3.2 ✅ Add CRM API handler tests
**Status:** Done (PR #12, commit 59c29a2)

### 3.3 Add workflow stage component tests
**Files to create:** Test files in `frontend/src/components/workflow/stages/`
**Components:** EligibilityStage, BenefitStage, VerifyEmploymentStage, DROStage, ElectionStage, SubmitStage, IntakeStage
**Pattern:** Follow existing Vitest + React Testing Library conventions in the project
**Time:** 4-6 hours

---

## Phase 4: Frontend Architecture ✅

### 4.1 ✅ Configure Vite code splitting
**Status:** Done (this PR). Added `manualChunks` for vendor-react and vendor-query in `vite.config.ts`. Converted 7 portal components to `React.lazy()` with `Suspense` fallbacks in `App.tsx`.
**Result:** Single 510 KB chunk → 16 chunks, largest 134 KB. Initial index.js dropped to 42 KB.

### 4.2 ✅ Add React Error Boundary
**Status:** Done (this PR). Created `ErrorBoundary.tsx` class component. Wraps each portal's `Suspense` in App.tsx with named error boundaries for structured error logging.

### 4.3 ✅ Improve API error handling
**Status:** Done (this PR). Created shared `apiClient.ts` module consolidating 5 duplicate `fetchAPI`/`postAPI`/`patchAPI`/`putAPI` helpers. Adds:
- `APIError` class with status, requestId, URL
- X-Request-ID header on every request (also covers Phase 5.2)
- Retry with exponential backoff on 502/503/504 and network errors (max 2 retries)
- Structured `console.error` / `console.warn` logging
- Fixed silent catch in `ExecutiveDashboard.tsx`

---

## Phase 5: Infrastructure Hardening ✅

### 5.1 ✅ Improve CORS middleware
**Status:** Done (this PR). Standardized all 6 platform services to identical CORS config:
- Methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- Headers: `Content-Type, Authorization, X-Tenant-ID, X-Request-ID`
- Added `Access-Control-Allow-Credentials: true`
- Added `Access-Control-Max-Age: 86400` on preflight responses
- Added `Access-Control-Expose-Headers: X-Request-ID`

### 5.2 ✅ Add X-Request-ID propagation in frontend
**Status:** Done (this PR, combined with Phase 4.3). Shared `apiClient.ts` generates UUID via `crypto.randomUUID()` and sends as `X-Request-ID` header on every request.

### 5.3 ✅ Align connector lib/pq dependency — reviewed, no action needed
**Status:** Reviewed. Connector uses `v1.11.2` (Go 1.26), platform uses `v1.10.9` (Go 1.22). Both are within semver v1.x — no breaking changes. Different Go module versions are expected since these are separate modules per layer boundary rules. No security advisories between versions.

---

## Priority Summary

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1: Quick Fixes** | ✅ Complete | PR #11, commit 3baf68f |
| **Phase 2: Type Safety** | ✅ Complete | PR #11, commit 76a2e7c |
| **Phase 3: Test Coverage** | Partial | 3.1 + 3.2 done (PR #12). 3.3 (workflow stage component tests) remains |
| **Phase 4: Frontend Arch** | ✅ Complete | This PR |
| **Phase 5: Infra Hardening** | ✅ Complete | This PR |

---

## Already Completed

### PR #11 (claude/angry-galileo → main)
| Item | Commit |
|------|--------|
| Align codebase with Boris Cherny best practices | 431ba95 |
| Fix tsc hook (tsconfig.app.json) | edc6d24 |
| Fix dataaccess Dockerfile binary name | c2dd8f5 |
| Create connector Dockerfile | c2dd8f5 |
| Add connector to docker-compose.yml | c2dd8f5 |
| Add .env.example | c2dd8f5 |
| Fix health check name, standardize Dockerfiles, add .dockerignore | 3baf68f |
| Replace 16 `any` types in workflow stages with proper interfaces | 76a2e7c |

### PR #12 (claude/heuristic-kare → angry-galileo)
| Item | Commit |
|------|--------|
| Add dataaccess + CRM API handler tests (Phase 3.1-3.2) | 59c29a2 |

### This PR (Phases 4-5)
| Item | Files |
|------|-------|
| Vite code splitting + React.lazy() for 7 portals | `vite.config.ts`, `App.tsx` |
| ErrorBoundary component wrapping each portal | `ErrorBoundary.tsx`, `App.tsx` |
| Shared API client with retry, logging, X-Request-ID | `apiClient.ts`, `api.ts`, `crmApi.ts`, `correspondenceApi.ts`, `dqApi.ts`, `kbApi.ts` |
| CORS middleware standardized across 6 services | `platform/*/main.go` |

## Remaining Work

- **Phase 3.3**: Workflow stage component tests (7 components, Vitest + RTL)
