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

### 1.4 Fix dataaccess health check service name
**File:** `platform/dataaccess/api/handlers.go` line 45
**Change:** `Service: "connector"` → `Service: "dataaccess"`
**Why:** Health check reports wrong service name to monitoring dashboards. Same copy-paste origin as the Dockerfile bug.
**Time:** 2 minutes

### 1.5 Standardize Dockerfile binary names
**Files:** 4 Dockerfiles need updates

| Service | Current Binary | Should Be | Also Missing |
|---------|---------------|-----------|--------------|
| `platform/crm/Dockerfile` | `/crm-service` | `/crm` | `-ldflags="-s -w"` |
| `platform/correspondence/Dockerfile` | `/corr-service` | `/correspondence` | `-ldflags="-s -w"` |
| `platform/dataquality/Dockerfile` | `/dq-service` | `/dataquality` | `-ldflags="-s -w"` |
| `platform/knowledgebase/Dockerfile` | `/kb-service` | `/knowledgebase` | `-ldflags="-s -w"` |

**Pattern to follow:** `platform/intelligence/Dockerfile` and `platform/dataaccess/Dockerfile` (both use full service name + `-ldflags="-s -w"` for smaller binaries).

**For each file, update three lines:**
- `RUN ... go build -ldflags="-s -w" -o /{servicename} .`
- `COPY --from=builder /{servicename} /{servicename}`
- `ENTRYPOINT ["/{servicename}"]`

**Time:** 15 minutes

### 1.6 Add .dockerignore files to all service directories
**Files to create:** 8 identical `.dockerignore` files:
- `connector/.dockerignore`
- `platform/dataaccess/.dockerignore`
- `platform/crm/.dockerignore`
- `platform/intelligence/.dockerignore`
- `platform/correspondence/.dockerignore`
- `platform/dataquality/.dockerignore`
- `platform/knowledgebase/.dockerignore`
- `frontend/.dockerignore`

**Content for Go services:**
```
.git
.env
*_test.go
**/*_test.go
README.md
CLAUDE.md
.vscode
```

**Content for frontend:**
```
.git
.env
node_modules
dist
coverage
.vscode
```

**Why:** Without .dockerignore, Docker copies everything including .git, .env (with potential secrets), test files, and IDE configs into the build context. This slows builds and risks credential exposure.
**Time:** 15 minutes

---

## Phase 2: Type Safety (2-3 hours)

### 2.1 Replace `any` types in workflow stage props
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

## Phase 3: Test Coverage (2-3 sessions)

### 3.1 Add dataaccess API handler tests
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

### 3.2 Add CRM API handler tests
**File to create:** `platform/crm/api/handlers_test.go`
**Endpoints to test (20+):** contacts CRUD, conversations, interactions, commitments, audit trail
**Pattern:** Same as 3.1 — use httptest, mock DB layer
**Time:** 6-8 hours

### 3.3 Add workflow stage component tests
**Files to create:** Test files in `frontend/src/components/workflow/stages/`
**Components:** EligibilityStage, BenefitStage, VerifyEmploymentStage, DROStage, ElectionStage, SubmitStage, IntakeStage
**Pattern:** Follow existing Vitest + React Testing Library conventions in the project
**Time:** 4-6 hours

---

## Phase 4: Frontend Architecture (2-3 hours)

### 4.1 Configure Vite code splitting
**File:** `frontend/vite.config.ts`

**Strategy:**
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-ui': ['lucide-react'],
        // Lazy-load portals as separate chunks
      }
    }
  }
}
```

Plus add `React.lazy()` for the three portal entry points: `StaffPortal`, `MemberPortal`, `RetirementApplication`.

**Why:** Currently all 88 components ship as a single chunk. A staff user loads all member portal code and vice versa. Code splitting reduces initial load by ~40-60%.
**Time:** 2 hours

### 4.2 Add React Error Boundary
**File to create:** `frontend/src/components/ErrorBoundary.tsx`
**Wrap:** Each portal's root with an error boundary
**Behavior:** Catch unhandled exceptions, show user-friendly error state, log error details to console
**Time:** 1 hour

### 4.3 Improve API error handling
**File:** `frontend/src/lib/api.ts` (and per-service API clients)
**Changes:**
- Stop swallowing errors silently (empty catch blocks)
- Add structured error logging
- Surface user-facing error messages
- Add retry logic for transient failures (503, network errors)
**Time:** 2 hours

---

## Phase 5: Infrastructure Hardening (1-2 hours)

### 5.1 Improve CORS middleware
**Files:** `main.go` in all 6 platform services
**Changes:**
- Add `Access-Control-Allow-Credentials: true`
- Add `Access-Control-Max-Age: 86400`
- Add `Access-Control-Expose-Headers: X-Request-ID`
- Extract to shared middleware package or ensure consistency

**Note:** All 6 services have copy-pasted CORS middleware. Consider extracting to a shared file, but this must NOT violate layer boundaries (platform services are independent Go modules). Each service keeps its own copy; changes should be applied consistently.
**Time:** 30 minutes

### 5.2 Add X-Request-ID propagation in frontend
**File:** `frontend/src/lib/api.ts`
**Change:** Generate UUID for each API call, send as `X-Request-ID` header
**Why:** Enables end-to-end request tracing across frontend → backend
**Time:** 30 minutes

### 5.3 Align connector lib/pq dependency
**File:** `connector/go.mod`
**Change:** `github.com/lib/pq v1.11.2` — verify this is intentionally newer than platform's `v1.10.9`, or align them. The connector uses Go 1.26 so it may have picked up a newer compatible version.
**Action:** Check release notes for lib/pq v1.10.9 → v1.11.2 for any breaking changes or security fixes.
**Time:** 15 minutes

---

## Priority Summary

| Phase | Effort | Impact | When |
|-------|--------|--------|------|
| **Phase 1: Quick Fixes** | 30 min | High — eliminates copy-paste bugs, adds security (.dockerignore) | Next session |
| **Phase 2: Type Safety** | 2-3 hrs | Critical — fiduciary components need type safety | Next session |
| **Phase 3: Test Coverage** | 2-3 sessions | Critical — zero-test services are a deployment risk | Spread across sessions |
| **Phase 4: Frontend Arch** | 2-3 hrs | High — bundle size, error handling | Dedicated session |
| **Phase 5: Infra Hardening** | 1-2 hrs | Medium — consistency and observability | Can batch with any session |

---

## Already Completed (PR #11)

| Item | Commit |
|------|--------|
| Align codebase with Boris Cherny best practices | edc6d24 |
| Fix tsc hook (tsconfig.app.json) | edc6d24 |
| Fix dataaccess Dockerfile binary name | c2dd8f5 |
| Create connector Dockerfile | c2dd8f5 |
| Add connector to docker-compose.yml | c2dd8f5 |
| Add .env.example | c2dd8f5 |
