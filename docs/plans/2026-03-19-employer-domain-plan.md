# Employer Domain — Full Roadmap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build all 7 employer domains — 6 new Go services, 6 new database schemas, and a full frontend employer portal — following COPERA BPI spec in dependency order.

**Architecture:** 6 independent Go services (ports 8094-8099) + shared Go module, all following the existing platform service patterns (apiresponse, auth middleware, slog, dbcontext). New `employer-portal/` frontend directory replaces existing shell. All new files — zero conflict with existing codebase.

**Tech Stack:** Go 1.22, PostgreSQL, React/TypeScript, Zustand, React Query, Vite, Tailwind (inline styles matching existing designSystem.ts)

**Authoritative spec:** `docs/noui-copera-employer-domain-functionality.md` — read relevant section before implementing each domain.

---

## Reference: Existing Patterns to Follow

### Go Service Boilerplate

Every new service follows this exact pattern from `platform/crm/`:

**`main.go`:** Import auth, dbcontext, healthutil, logging, ratelimit, apiresponse. Setup: `logging.Setup(serviceName, nil)` → `db.ConfigFromEnv()` → `db.Connect(cfg)` → `api.NewHandler(database)` → `handler.RegisterRoutes(mux)` → middleware chain: `corsMiddleware(auth.Middleware(rl(dbcontext.DBMiddleware(...)(healthutil.CounterMiddleware(...)(logging.RequestLogger(...)(...))))))`. Graceful shutdown via signal.

**`go.mod`:** Module path `github.com/noui/platform/{service}`, Go 1.22.0. Required deps: `github.com/google/uuid`, `github.com/lib/pq`, plus replace directives for all shared packages (auth, dbcontext, envutil, healthutil, logging, ratelimit, validation, apiresponse). Copy `platform/crm/go.mod` as template.

**`Dockerfile`:** Multi-stage build. Context is `./platform` (parent dir). COPY shared packages + service dir. Build with `CGO_ENABLED=0 GOOS=linux`. Use `gcr.io/distroless/static-debian12:nonroot` for runtime. Copy `platform/crm/Dockerfile` as template.

**`api/handlers.go`:** Use `apiresponse.WriteSuccess`, `apiresponse.WriteError`, `apiresponse.WritePaginated`. Parse path params with `r.PathValue("id")`. Validate with `validation.Validate()`. Read auth context with `auth.TenantID(r.Context())`, `auth.UserRole(r.Context())`.

**`db/queries.go`:** Use `database/sql` with `lib/pq`. All queries use `$N` placeholders. Use `dbcontext.Exec`/`dbcontext.Query` for tenant-scoped queries. Return `(result, error)` tuples.

### Frontend API Pattern

**API client:** Use helpers from `lib/apiClient.ts`: `fetchAPI<T>`, `postAPI<T>`, `putAPI<T>`, `deleteAPI<T>`, `fetchPaginatedAPI<T>`, `toQueryString`. All routes go through Vite proxy (`/api/v1/...`).

**Hooks:** React Query pattern: `useQuery({ queryKey: [...], queryFn: () => fetchAPI<T>(url) })` for reads, `useMutation({ mutationFn: ... })` for writes. See `hooks/useCRM.ts` for examples.

### Database Schema

SQL files in `domains/pension/schema/`. Tables use `UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `TIMESTAMPTZ DEFAULT now()` for created_at, `TEXT NOT NULL CHECK (x IN (...))` for enums. All NUMERIC types for monetary values — never float.

### Test Pattern

Go: `_test.go` in same package. Use `httptest.NewRecorder()` + `httptest.NewRequest()` for handler tests. Use `sqlmock` for DB tests. Run with `go test ./... -short`.

Frontend: `__tests__/` directories. Use vitest + @testing-library/react. Mock fetch with `vi.stubGlobal('fetch', ...)`. Run with `npm test -- --run`.

### Commit Format

`[layer/component] Brief description` — e.g., `[platform/employer-portal] Add role management handlers`

---

## Phase 1: Foundation — Shared Module + Portal Service

**Read first:** Spec Sections 1 (Employer Portal) and 8 (Cross-Domain Relationships)
**Delivers:** employer-shared types, employer-portal service, database schema, frontend portal shell

---

### Task 1.1: Create employer-shared Go module

**Files:**
- Create: `platform/employer-shared/go.mod`
- Create: `platform/employer-shared/types.go`
- Create: `platform/employer-shared/divisions.go`

**Step 1: Create go.mod**

```
platform/employer-shared/go.mod
```
```go
module github.com/noui/platform/employer-shared

go 1.22.0
```

**Step 2: Create types.go — shared types for all employer services**

```go
// platform/employer-shared/types.go
package employershared

// PortalRole defines employer portal access levels (Spec Section 1: Role Model)
type PortalRole string

const (
	RoleSuperUser      PortalRole = "SUPER_USER"
	RolePayrollContact PortalRole = "PAYROLL_CONTACT"
	RoleHRContact      PortalRole = "HR_CONTACT"
	RoleReadOnly       PortalRole = "READ_ONLY"
)

// Division represents one of COPERA's five employer divisions (Spec Section 3)
type Division struct {
	DivisionCode    string `json:"divisionCode"`
	DivisionName    string `json:"divisionName"`
	GoverningStatute string `json:"governingStatute"`
}

// ContributionCategory codes (Spec Section 2: Contribution Categories)
type ContributionCategory string

const (
	CatEmployeeContrib   ContributionCategory = "EMPLOYEE"
	CatEmployerContrib   ContributionCategory = "EMPLOYER_NORMAL"
	CatAED               ContributionCategory = "AED"
	CatSAED              ContributionCategory = "SAED"
	CatWARET             ContributionCategory = "WARET"
	CatWARRC             ContributionCategory = "WARRC"
	CatORP               ContributionCategory = "ORP"
)

// PlanType for tier determination
type PlanType string

const (
	PlanDB  PlanType = "DB"
	PlanDC  PlanType = "DC"
	PlanORP PlanType = "ORP"
)

// Tier determines benefit formula multiplier
type Tier string

const (
	TierOne   Tier = "T1"
	TierTwo   Tier = "T2"
	TierThree Tier = "T3"
)

// FileStatus tracks contribution file lifecycle (Spec Section 2: Submission Lifecycle)
type FileStatus string

const (
	FileUploaded       FileStatus = "UPLOADED"
	FileValidating     FileStatus = "VALIDATING"
	FileValidated      FileStatus = "VALIDATED"
	FilePartialPost    FileStatus = "PARTIAL_POST"
	FileException      FileStatus = "EXCEPTION"
	FilePaymentSetup   FileStatus = "PAYMENT_SETUP"
	FilePaymentPending FileStatus = "PAYMENT_PENDING"
	FileProcessed      FileStatus = "PROCESSED"
	FileReplaced       FileStatus = "REPLACED"
	FileRejected       FileStatus = "REJECTED"
)

// ExceptionStatus for contribution exceptions
type ExceptionStatus string

const (
	ExceptionUnresolved      ExceptionStatus = "UNRESOLVED"
	ExceptionPendingResponse ExceptionStatus = "PENDING_RESPONSE"
	ExceptionEscalated       ExceptionStatus = "ESCALATED"
	ExceptionResolved        ExceptionStatus = "RESOLVED"
	ExceptionDCRouted        ExceptionStatus = "DC_ROUTED"
)

// EnrollmentType distinguishes enrollment initiation paths (Spec Section 3)
type EnrollmentType string

const (
	EnrollEmployerInitiated EnrollmentType = "EMPLOYER_INITIATED"
	EnrollMemberInitiated   EnrollmentType = "MEMBER_INITIATED"
	EnrollRehire            EnrollmentType = "REHIRE"
)

// DesignationType for WARET (Spec Section 5)
type DesignationType string

const (
	DesigStandard             DesignationType = "STANDARD"
	Desig140Day               DesignationType = "140_DAY"
	DesigCriticalShortage     DesignationType = "CRITICAL_SHORTAGE"
	DesigCriticalShortageBOCES DesignationType = "CRITICAL_SHORTAGE_BOCES"
)

// ServiceCreditType for SCP (Spec Section 6)
type ServiceCreditType string

const (
	SCRefundedPriorPERA    ServiceCreditType = "REFUNDED_PRIOR_PERA"
	SCMilitaryUSERRA       ServiceCreditType = "MILITARY_USERRA"
	SCPriorPublicEmployment ServiceCreditType = "PRIOR_PUBLIC_EMPLOYMENT"
	SCLeaveOfAbsence       ServiceCreditType = "LEAVE_OF_ABSENCE"
	SCPERAChoiceTransfer   ServiceCreditType = "PERACHOICE_TRANSFER"
)
```

**Step 3: Create divisions.go — COPERA 5-division reference**

```go
// platform/employer-shared/divisions.go
package employershared

// COPERADivisions returns the five COPERA employer divisions.
// This is reference data — real effective dates and statutes come from DB.
var COPERADivisions = []Division{
	{DivisionCode: "STATE", DivisionName: "State Division", GoverningStatute: "CRS Title 24, Article 51"},
	{DivisionCode: "SCHOOL", DivisionName: "School Division", GoverningStatute: "CRS Title 24, Article 51"},
	{DivisionCode: "LOCAL_GOV", DivisionName: "Local Government Division", GoverningStatute: "CRS Title 24, Article 51"},
	{DivisionCode: "JUDICIAL", DivisionName: "Judicial Division", GoverningStatute: "CRS Title 24, Article 51"},
	{DivisionCode: "DPS", DivisionName: "DPS (Denver Public Schools)", GoverningStatute: "CRS Title 24, Article 51"},
}

// DivisionByCode looks up a division by code. Returns nil if not found.
func DivisionByCode(code string) *Division {
	for i := range COPERADivisions {
		if COPERADivisions[i].DivisionCode == code {
			return &COPERADivisions[i]
		}
	}
	return nil
}
```

**Step 4: Build and verify**

Run: `cd platform/employer-shared && go build ./...`
Expected: Clean build, no errors

**Step 5: Commit**

```bash
git add platform/employer-shared/
git commit -m "[platform/employer-shared] Add shared types module — divisions, roles, contribution categories, enums"
```

---

### Task 1.2: Create employer database schema (020_employer_shared.sql)

**Files:**
- Create: `domains/pension/schema/020_employer_shared.sql`

**Step 1: Write the schema**

See design doc section "Domain 1 — Employer Portal" for full DDL. Tables:
- `employer_portal_user` — portal access, roles, linked to crm_organization + crm_contact
- `employer_division` — 5 COPERA divisions with governing statute references
- `contribution_rate_table` — versioned, effective-dated rates by division/plan/tier (employee, employer, AED, SAED)
- `employer_alert` — system-wide and org-specific alert banners

Key constraints:
- `portal_role` CHECK IN ('SUPER_USER','PAYROLL_CONTACT','HR_CONTACT','READ_ONLY')
- `alert_type` CHECK IN ('DEADLINE','TASK','CRITICAL','POLICY_CHANGE')
- All monetary columns use NUMERIC(n,2) or NUMERIC(8,6) for rates
- Foreign keys to crm_organization(org_id) and crm_contact(contact_id)
- `effective_from` / `effective_to` DATE pattern for rate versioning (NULL effective_to = current)
- `board_resolution_ref` TEXT for traceability to board action

**Step 2: Verify SQL syntax**

Run: `psql -f domains/pension/schema/020_employer_shared.sql` (or validate in Docker later)

**Step 3: Commit**

```bash
git add domains/pension/schema/020_employer_shared.sql
git commit -m "[pension/schema] Add employer shared schema — portal users, divisions, rate tables, alerts"
```

---

### Task 1.3: Create employer-portal Go service scaffold

**Files:**
- Create: `platform/employer-portal/go.mod`
- Create: `platform/employer-portal/go.sum`
- Create: `platform/employer-portal/main.go`
- Create: `platform/employer-portal/db/store.go`
- Create: `platform/employer-portal/db/config.go`
- Create: `platform/employer-portal/api/handlers.go`
- Create: `platform/employer-portal/Dockerfile`

**Step 1: Create go.mod** (copy from crm/go.mod, change module path and port)

Module: `github.com/noui/platform/employer-portal`. Add replace directive for `github.com/noui/platform/employer-shared => ../employer-shared`.

**Step 2: Create db/config.go and db/store.go**

Follow exact pattern from `platform/crm/db/`. ConfigFromEnv reads DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSLMODE. Connect returns *sql.DB with pool settings from DB_MAX_OPEN_CONNS, DB_MAX_IDLE_CONNS.

**Step 3: Create main.go**

Follow exact pattern from `platform/crm/main.go`. Service name: "employer-portal". Default port: "8094". Same middleware chain: CORS → Auth → RateLimit → DBContext → Counter → Logging → Handler.

**Step 4: Create api/handlers.go — initial endpoints**

```go
// RegisterRoutes sets up employer portal API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
    mux.HandleFunc("GET /healthz", h.HealthCheck)

    // Portal Users — role management (Spec Section 1: Role Model)
    mux.HandleFunc("GET /api/v1/employer/users", h.ListPortalUsers)
    mux.HandleFunc("POST /api/v1/employer/users", h.CreatePortalUser)
    mux.HandleFunc("PUT /api/v1/employer/users/{id}/role", h.UpdatePortalUserRole)
    mux.HandleFunc("DELETE /api/v1/employer/users/{id}", h.RevokePortalUser)

    // Dashboard
    mux.HandleFunc("GET /api/v1/employer/dashboard", h.GetDashboard)

    // Alerts
    mux.HandleFunc("GET /api/v1/employer/alerts", h.ListAlerts)
    mux.HandleFunc("POST /api/v1/employer/alerts", h.CreateAlert)

    // Rate tables (read-only for portal, managed by COPERA staff)
    mux.HandleFunc("GET /api/v1/employer/rate-tables", h.ListRateTables)

    // Divisions reference
    mux.HandleFunc("GET /api/v1/employer/divisions", h.ListDivisions)
}
```

Implement each handler following the apiresponse pattern. Initial handlers can return minimal data — the full business logic builds in later tasks.

**Step 5: Create Dockerfile**

Copy from `platform/crm/Dockerfile`. Change service name to employer-portal. Add `COPY employer-shared/ employer-shared/` to builder stage. EXPOSE 8094.

**Step 6: Build and test**

Run: `cd platform/employer-portal && go build ./...`
Expected: Clean build

**Step 7: Write handler tests**

Create `platform/employer-portal/api/handlers_test.go`. Test HealthCheck returns 200. Test ListPortalUsers returns proper envelope. Use httptest pattern from `platform/crm/api/handlers_test.go`.

Run: `cd platform/employer-portal && go test ./... -short -v`
Expected: All tests pass

**Step 8: Commit**

```bash
git add platform/employer-portal/
git commit -m "[platform/employer-portal] Add service scaffold — role mgmt, dashboard, alerts, rate tables"
```

---

### Task 1.4: Create frontend employer-portal directory scaffold

**Files:**
- Create: `frontend/src/components/employer-portal/EmployerPortalApp.tsx`
- Create: `frontend/src/components/employer-portal/layout/OrgBanner.tsx`
- Create: `frontend/src/components/employer-portal/layout/AlertBanner.tsx`
- Create: `frontend/src/components/employer-portal/layout/PortalNav.tsx`
- Create: `frontend/src/components/employer-portal/communications/SecureMessaging.tsx`
- Create: `frontend/src/lib/employerApi.ts`
- Create: `frontend/src/hooks/useEmployerPortal.ts`
- Create: `frontend/src/types/Employer.ts`

**Step 1: Create TypeScript types** (`frontend/src/types/Employer.ts`)

Define interfaces matching Go types: `PortalUser`, `EmployerDivision`, `ContributionRateTable`, `EmployerAlert`, `ContributionFile`, `ContributionRecord`, `ContributionException`, `EnrollmentSubmission`, `TerminationCertification`, `CertificationHold`, `RefundApplication`, `WaretDesignation`, `WaretTracking`, `WaretPenalty`, `ScpRequest`.

**Step 2: Create API client** (`frontend/src/lib/employerApi.ts`)

```typescript
import { fetchAPI, postAPI, putAPI, deleteAPI, fetchPaginatedAPI, toQueryString } from './apiClient';
import type { PortalUser, EmployerAlert, ContributionRateTable, EmployerDivision } from '@/types/Employer';

const BASE = '/api/v1/employer';

export const employerPortalAPI = {
  // Portal Users
  listUsers: (orgId: string) => fetchAPI<PortalUser[]>(`${BASE}/users${toQueryString({ orgId })}`),
  createUser: (data: Partial<PortalUser>) => postAPI<PortalUser>(`${BASE}/users`, data),
  updateRole: (id: string, role: string) => putAPI<PortalUser>(`${BASE}/users/${id}/role`, { role }),
  revokeUser: (id: string) => deleteAPI<void>(`${BASE}/users/${id}`),

  // Dashboard
  getDashboard: (orgId: string) => fetchAPI<unknown>(`${BASE}/dashboard${toQueryString({ orgId })}`),

  // Alerts
  listAlerts: (orgId?: string) => fetchAPI<EmployerAlert[]>(`${BASE}/alerts${toQueryString({ orgId: orgId ?? '' })}`),

  // Rate Tables
  listRateTables: (divisionCode?: string) => fetchAPI<ContributionRateTable[]>(`${BASE}/rate-tables${toQueryString({ divisionCode: divisionCode ?? '' })}`),

  // Divisions
  listDivisions: () => fetchAPI<EmployerDivision[]>(`${BASE}/divisions`),
};
```

**Step 3: Create hooks** (`frontend/src/hooks/useEmployerPortal.ts`)

React Query hooks wrapping the API client: `usePortalUsers(orgId)`, `useEmployerAlerts(orgId)`, `useEmployerDashboard(orgId)`, `useRateTables(divisionCode)`, `useCreatePortalUser()`, `useUpdatePortalUserRole()`, `useRevokePortalUser()`.

**Step 4: Create EmployerPortalApp.tsx** — Main router component

Tab-based navigation: Dashboard, Communications, Reporting, Enrollment, Terminations, WARET, SCP. Uses the same org selector pattern as existing EmployerPortal.tsx but with the new hook infrastructure.

**Step 5: Create layout components** — OrgBanner, AlertBanner, PortalNav

Follow existing designSystem.ts patterns (BODY font, inline styles). OrgBanner shows org name, member count, last contribution date, reporting frequency. AlertBanner renders system-wide + org-specific alerts. PortalNav provides tab navigation.

**Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean

**Step 7: Write component tests**

Create `frontend/src/components/employer-portal/__tests__/EmployerPortalApp.test.tsx`. Test: renders without crash, shows org selector, tab navigation works. Mock fetch for API calls.

Run: `cd frontend && npm test -- --run`
Expected: All tests pass (existing + new)

**Step 8: Commit**

```bash
git add frontend/src/components/employer-portal/ frontend/src/lib/employerApi.ts frontend/src/hooks/useEmployerPortal.ts frontend/src/types/Employer.ts
git commit -m "[frontend/employer-portal] Add portal scaffold — types, API client, hooks, layout components"
```

---

### Task 1.5: Add Vite proxy routes for new services

**Files:**
- Modify: `frontend/vite.config.ts` — add proxy entries for ports 8094-8099

**Step 1: Add proxy entries**

Add to the existing `server.proxy` config:

```typescript
'/api/v1/employer': { target: 'http://localhost:8094', changeOrigin: true },
'/api/v1/reporting': { target: 'http://localhost:8095', changeOrigin: true },
'/api/v1/enrollment': { target: 'http://localhost:8096', changeOrigin: true },
'/api/v1/terminations': { target: 'http://localhost:8097', changeOrigin: true },
'/api/v1/waret': { target: 'http://localhost:8098', changeOrigin: true },
'/api/v1/scp': { target: 'http://localhost:8099', changeOrigin: true },
```

**Note:** This modifies an existing file — potential merge conflict at phase boundary. Keep the diff minimal (append to existing proxy list).

**Step 2: Commit**

```bash
git add frontend/vite.config.ts
git commit -m "[frontend] Add Vite proxy routes for employer services (ports 8094-8099)"
```

---

### Task 1.6: Phase 1 verification

**Step 1: Build all Go services**

```bash
cd platform/employer-shared && go build ./...
cd ../employer-portal && go build ./... && go test ./... -short -v
```

**Step 2: Typecheck + test frontend**

```bash
cd frontend && npx tsc --noEmit && npm test -- --run
```

**Step 3: Commit phase summary**

Update BUILD_HISTORY.md with Phase 1 completion summary.

```bash
git add BUILD_HISTORY.md
git commit -m "[docs] Phase 1 complete — employer-shared + employer-portal service + frontend scaffold"
```

---

## Phase 2: Reporting Engine

**Read first:** Spec Section 2 (Employer Reporting) — all 8 submission lifecycle stages
**Delivers:** employer-reporting service, contribution validation, exception workflow, payment setup

---

### Task 2.1: Create employer reporting database schema (021_employer_reporting.sql)

**Files:**
- Create: `domains/pension/schema/021_employer_reporting.sql`

Tables: `contribution_file`, `contribution_record`, `contribution_exception`, `contribution_payment`, `late_interest_accrual`. See design doc for full DDL. Key: all monetary columns NUMERIC, status enums as CHECK constraints, foreign keys between file→record→exception.

**Commit:** `[pension/schema] Add employer reporting schema — files, records, exceptions, payments`

---

### Task 2.2: Create employer-reporting Go service

**Files:**
- Create: `platform/employer-reporting/go.mod`
- Create: `platform/employer-reporting/main.go`
- Create: `platform/employer-reporting/db/store.go`
- Create: `platform/employer-reporting/db/config.go`
- Create: `platform/employer-reporting/api/handlers.go`
- Create: `platform/employer-reporting/domain/validator.go`
- Create: `platform/employer-reporting/domain/exceptions.go`
- Create: `platform/employer-reporting/domain/payment.go`
- Create: `platform/employer-reporting/Dockerfile`

**Endpoints to implement:**

```
POST   /api/v1/reporting/files/upload          — multipart file upload
GET    /api/v1/reporting/files                  — list submissions
GET    /api/v1/reporting/files/{fileId}         — file detail
GET    /api/v1/reporting/files/{fileId}/records — paginated records
DELETE /api/v1/reporting/files/{fileId}         — delete before processing
POST   /api/v1/reporting/manual-entry           — grid-entered rows
GET    /api/v1/reporting/exceptions             — exception queue
GET    /api/v1/reporting/exceptions/{id}        — exception detail
PUT    /api/v1/reporting/exceptions/{id}/resolve — resolve exception
PUT    /api/v1/reporting/exceptions/{id}/escalate — escalate
POST   /api/v1/reporting/files/{fileId}/payment-setup — configure payment
GET    /api/v1/reporting/payments               — payment history
DELETE /api/v1/reporting/payments/{paymentId}   — cancel pending
POST   /api/v1/reporting/corrections            — correction file
GET    /api/v1/reporting/interest/{orgId}       — accrued late interest
```

**domain/validator.go — business rules:**

1. Rate validation: lookup `contribution_rate_table` for division × plan × tier, compare submitted rates
2. Enrollment check: query member table by SSN, flag unrecognized
3. Retiree/IC detection: check employment status for retiree flag
4. Partial posting: separate valid records from failed, post valid immediately

**domain/exceptions.go:** Exception creation, categorization (RATE_MISMATCH, UNKNOWN_MEMBER, WRONG_PLAN, etc.), DC team auto-routing for 401k/457 types.

**domain/payment.go:** Payment setup validation, ACH vs wire, discrepancy threshold check.

**Tests:** Write unit tests for validator.go (rate validation math, enrollment check logic). Write handler tests for upload, exception CRUD, payment setup.

Run: `cd platform/employer-reporting && go build ./... && go test ./... -short -v`

**Commit:** `[platform/employer-reporting] Add reporting service — validation engine, exceptions, payment setup`

---

### Task 2.3: Create frontend reporting components

**Files:**
- Create: `frontend/src/components/employer-portal/reporting/FileUpload.tsx`
- Create: `frontend/src/components/employer-portal/reporting/ManualGrid.tsx`
- Create: `frontend/src/components/employer-portal/reporting/ValidationProgress.tsx`
- Create: `frontend/src/components/employer-portal/reporting/ExceptionDashboard.tsx`
- Create: `frontend/src/components/employer-portal/reporting/CorrectionWorkflow.tsx`
- Create: `frontend/src/components/employer-portal/reporting/PaymentSetup.tsx`
- Create: `frontend/src/hooks/useEmployerReporting.ts`

**API client additions** to `employerApi.ts`:

```typescript
export const employerReportingAPI = {
  uploadFile: (orgId: string, file: File, periodStart: string, periodEnd: string) => { /* multipart POST */ },
  listFiles: (orgId: string) => fetchPaginatedAPI<ContributionFile>(`/api/v1/reporting/files${toQueryString({ orgId })}`),
  getFile: (fileId: string) => fetchAPI<ContributionFile>(`/api/v1/reporting/files/${fileId}`),
  getRecords: (fileId: string, limit: number, offset: number) => fetchPaginatedAPI<ContributionRecord>(`/api/v1/reporting/files/${fileId}/records${toQueryString({ limit, offset })}`),
  listExceptions: (orgId: string, status?: string) => fetchPaginatedAPI<ContributionException>(`/api/v1/reporting/exceptions${toQueryString({ orgId, status: status ?? '' })}`),
  resolveException: (id: string, note: string) => putAPI<ContributionException>(`/api/v1/reporting/exceptions/${id}/resolve`, { note }),
  escalateException: (id: string) => putAPI<ContributionException>(`/api/v1/reporting/exceptions/${id}/escalate`, {}),
  setupPayment: (fileId: string, method: string) => postAPI<unknown>(`/api/v1/reporting/files/${fileId}/payment-setup`, { method }),
};
```

**Hooks:** `useContributionFiles(orgId)`, `useContributionRecords(fileId)`, `useExceptions(orgId, status)`, `useUploadFile()`, `useResolveException()`, `useSetupPayment()`.

**Components:**
- `FileUpload.tsx` — drag-drop zone, file type detection (text/Excel), multipart upload with progress
- `ManualGrid.tsx` — editable table for row-by-row contribution entry with inline validation
- `ValidationProgress.tsx` — real-time status bar (validating → partial post → complete)
- `ExceptionDashboard.tsx` — filterable table: status (unresolved/pending/escalated), age, category
- `CorrectionWorkflow.tsx` — edit individual failed records, resubmit for validation
- `PaymentSetup.tsx` — ACH/wire selection, amount confirmation

**Tests:** Component smoke tests + hook tests with mocked fetch.

**Commit:** `[frontend/employer-portal] Add reporting UI — file upload, exceptions, payment setup`

---

### Task 2.4: Phase 2 verification

Build all, test all, update BUILD_HISTORY.md.

**Commit:** `[docs] Phase 2 complete — employer reporting engine with validation + exceptions`

---

## Phase 3: New Member Enrollment

**Read first:** Spec Section 3 (New Member Enrollment)
**Delivers:** employer-enrollment service, duplicate detection, PERAChoice tracking

---

### Task 3.1: Create enrollment database schema (022_employer_enrollment.sql)

Tables: `enrollment_submission`, `enrollment_duplicate_flag`, `perachoice_election`. See design doc for full DDL.

**Commit:** `[pension/schema] Add employer enrollment schema — submissions, duplicates, PERAChoice`

### Task 3.2: Create employer-enrollment Go service

Port 8096. Endpoints: new-hire submission, member-submit, duplicate detection/resolution, PERAChoice election, conflict resolution, validation report download.

Key domain logic:
- `domain/enrollment.go` — Mandatory field enforcement (SSN, hire_date, plan_code, division_code, name). Tier assignment from hire_date + division.
- `domain/duplicates.go` — SSN exact match + name+DOB fuzzy match. Flag for admin review before processing.
- `domain/perachoice.go` — 60-day election window calculation from hire_date. DC team notification trigger.

**Commit:** `[platform/employer-enrollment] Add enrollment service — submissions, duplicates, PERAChoice`

### Task 3.3: Create frontend enrollment components

Components: `NewHireForm.tsx`, `StatusChangeForm.tsx`, `DuplicateResolution.tsx`, `PERAChoiceTracker.tsx`. Hooks: `useEnrollmentSubmissions(orgId)`, `useDuplicates()`, `usePERAChoicePending()`, `useCreateEnrollment()`.

**Commit:** `[frontend/employer-portal] Add enrollment UI — new hire form, duplicate resolution, PERAChoice`

### Task 3.4: Phase 3 verification + commit

---

## Phase 4: Terminations & Refund

**Read first:** Spec Section 4 (Terminations)
**Delivers:** employer-terminations service, certification hold logic, refund calculation

---

### Task 4.1: Create terminations database schema (023_employer_terminations.sql)

Tables: `termination_certification`, `certification_hold`, `refund_application`. See design doc for full DDL.

**Commit:** `[pension/schema] Add terminations schema — certification, holds, refund applications`

### Task 4.2: Create employer-terminations Go service

Port 8097. Key domain logic:
- `domain/certification.go` — Hold logic: auto-create "Pending Employer Certification" when refund form exists but no termination date. Configurable countdown (45 days default). Reminder scheduling. Auto-escalation. Auto-cancellation.
- `domain/refund.go` — Refund calculation: employee contributions + compound interest (board-set rate, compounded annually June 30). 20% federal tax withholding. DRO deductions. Payment method selection.
- `domain/eligibility.go` — Separation waiting period check. Vesting check (5 years). Disability application check (<2 years blocks refund).

**Critical:** Refund calculation must be $0.00 accurate. Use `math/big.Rat` for all monetary arithmetic. Never float64. Write extensive unit tests comparing against hand-calculated expected values.

**Commit:** `[platform/employer-terminations] Add terminations service — certification holds, refund calc`

### Task 4.3: Create frontend terminations components

Components: `TerminationForm.tsx`, `CertificationHold.tsx`, `RefundStatus.tsx`. Hooks: `useCertifications(orgId)`, `useCertificationHolds()`, `useRefundStatus(memberId)`.

**Commit:** `[frontend/employer-portal] Add terminations UI — certification form, hold tracker, refund status`

### Task 4.4: Phase 4 verification + commit

---

## Phase 5: WARET (Working After Retirement)

**Read first:** Spec Section 5 (WARET)
**Delivers:** employer-waret service, designation management, penalty calculation

---

### Task 5.1: Create WARET database schema (024_employer_waret.sql)

Tables: `waret_designation`, `waret_tracking`, `waret_ytd_summary` (view), `waret_penalty`, `waret_ic_disclosure`. See design doc for full DDL.

**Commit:** `[pension/schema] Add WARET schema — designations, tracking, penalties, IC disclosure`

### Task 5.2: Create employer-waret Go service

Port 8098. Key domain logic:
- `domain/designation.go` — Validate eligible employer type per designation. Capacity check (10 per district for 140-day). Consecutive year limit (6 years + 1-year break). ORP loophole exemption.
- `domain/tracking.go` — Day definition: >4 hours = 1 day. Accumulate hours/days against annual limits (110/720 standard, 140/960 for 140-day, unlimited for Critical Shortage).
- `domain/penalty.go` — 5% of monthly benefit per day over limit. Effective month rule: first business day = full cancellation, subsequent days = 5% each. Non-disclosure: recover both retiree + employer contributions. Deduction spreading across months.
- `domain/peracare.go` — PERACare subsidy conflict detection when Critical Shortage designation submitted. 30-day response window. Auto-remove subsidy if no response.

**Critical:** Penalty calculations must be $0.00 accurate. Use `math/big.Rat`.

**Commit:** `[platform/employer-waret] Add WARET service — designations, tracking, penalties, PERACare`

### Task 5.3: Create frontend WARET components

Components: `DesignationForm.tsx`, `DesignationDashboard.tsx`, `LimitTracker.tsx`, `AnnualWorksheet.tsx`. Hooks: `useDesignations(orgId)`, `useWaretTracking(retireeId)`, `useWaretPenalties(retireeId)`.

**Commit:** `[frontend/employer-portal] Add WARET UI — designation forms, limit tracker, worksheet`

### Task 5.4: Phase 5 verification + commit

---

## Phase 6: Service Credit Purchase

**Read first:** Spec Section 6 (SCP) — NOTE: incomplete, SCP BPI not available
**Delivers:** employer-scp service, cost factor lookup, exclusion flag enforcement

---

### Task 6.1: Create SCP database schema (025_employer_scp.sql)

Tables: `scp_cost_factor`, `scp_request`. See design doc for full DDL.

**CRITICAL exclusion flags on scp_request:**
- `excludes_from_rule_of_75_85 BOOLEAN NOT NULL DEFAULT true`
- `excludes_from_ipr BOOLEAN NOT NULL DEFAULT true`
- `excludes_from_vesting BOOLEAN NOT NULL DEFAULT true`

These are enforced at record creation and NEVER changed. Purchased service contributes to benefit calculation but NOT to eligibility tests.

**Commit:** `[pension/schema] Add SCP schema — cost factors, purchase requests with exclusion flags`

### Task 6.2: Create employer-scp Go service

Port 8099. Domain logic:
- `domain/costfactor.go` — Lookup cost factor by tier, hire date window, age at purchase. Calculate cost. Quote expiration.
- `domain/eligibility.go` — Service type validation. Documentation requirements.
- `domain/exclusions.go` — Enforce exclusion flags at record creation. Verify flags are immutable after creation.

**Note:** Implementation limited by missing SCP BPI. Build the framework and cost factor lookup; fill details when BPI is retrieved.

**Commit:** `[platform/employer-scp] Add SCP service — cost factors, eligibility, exclusion flags`

### Task 6.3: Create frontend SCP components + Phase 6 verification

Components: `CostQuote.tsx`, `PurchaseRequest.tsx`, `PaymentTracker.tsx`.

**Commit:** `[frontend/employer-portal] Add SCP UI — cost quote, purchase request, payment tracker`

---

## Phase 7: Integration — Docker, CI, App.tsx Wiring

**This phase touches shared files — coordinate merge checkpoint with user.**

---

### Task 7.1: Add 6 new services to docker-compose.yml

Add service entries for employer-portal (8094), employer-reporting (8095), employer-enrollment (8096), employer-terminations (8097), employer-waret (8098), employer-scp (8099). Follow exact pattern from existing crm service entry. All depend on pgbouncer healthy. Add schema + seed volume mounts for 020-025.

**Commit:** `[infrastructure] Add 6 employer services to docker-compose`

### Task 7.2: Add services to CI matrix

Add to `.github/workflows/ci.yml` platform-services matrix: `employer-portal, employer-reporting, employer-enrollment, employer-terminations, employer-waret, employer-scp`.

**Commit:** `[ci] Add employer services to CI matrix`

### Task 7.3: Wire frontend App.tsx to new EmployerPortalApp

Replace the import of existing `EmployerPortal` with new `EmployerPortalApp` from `employer-portal/` directory. Single line change in the conditional rendering block.

**Commit:** `[frontend] Wire new EmployerPortalApp into App.tsx router`

### Task 7.4: Add nginx routing for employer services

Update `infrastructure/nginx/nginx.conf` (if exists) or docker-compose frontend proxy config to route `/api/v1/employer/*`, `/api/v1/reporting/*`, `/api/v1/enrollment/*`, `/api/v1/terminations/*`, `/api/v1/waret/*`, `/api/v1/scp/*` to the correct upstream service ports.

**Commit:** `[infrastructure] Add nginx routing for employer services`

### Task 7.5: Full stack smoke test

```bash
# Build all Go services
for svc in employer-shared employer-portal employer-reporting employer-enrollment employer-terminations employer-waret employer-scp; do
  cd platform/$svc && go build ./... && go test ./... -short -v && cd ../..
done

# Frontend
cd frontend && npx tsc --noEmit && npm run build && npm test -- --run

# Docker
docker compose config > /dev/null  # validate compose file
```

**Commit:** `[docs] Phase 7 complete — all employer services integrated, CI + Docker + frontend wired`

---

## Phase 8 (Deferred): Customer Service Enhancements

**Read first:** Spec Section 7 (Customer Service)
**Note:** This phase modifies existing services (casemanagement, crm) — do NOT run in parallel with other work on those services. Schedule as separate effort.

**Scope:**
- Add context surfacing endpoints to casemanagement (query across employer services by inquiry type)
- Add skill_tags to case management for routing
- Add SLA tracking (due dates, % on target dashboard, breach alerts)
- Enhance CRM workspace with unified agent desktop panels

**This phase is documented but intentionally not detailed at task-level** since it touches existing services and requires a separate conflict-avoidance strategy. Create a dedicated plan when ready to execute.

---

## Verification Commands Reference

```bash
# Individual service build + test
cd platform/employer-portal && go build ./... && go test ./... -short -v
cd platform/employer-reporting && go build ./... && go test ./... -short -v
cd platform/employer-enrollment && go build ./... && go test ./... -short -v
cd platform/employer-terminations && go build ./... && go test ./... -short -v
cd platform/employer-waret && go build ./... && go test ./... -short -v
cd platform/employer-scp && go build ./... && go test ./... -short -v

# Frontend
cd frontend && npx tsc --noEmit && npm run build && npm test -- --run

# Docker compose validation
docker compose config > /dev/null
```

---

## Data Dependencies Checklist

Before executing each phase, confirm data availability:

- [ ] **Phase 2:** AED/SAED rate tables by division + effective date
- [ ] **Phase 2:** Contribution rate matrix (plan × tier × salary → rate)
- [ ] **Phase 2:** Payment setup discrepancy threshold
- [ ] **Phase 3:** Complete mandatory enrollment field set
- [ ] **Phase 3:** PERAChoice eligible employer/position categories
- [ ] **Phase 4:** Separation waiting period statute + exceptions
- [ ] **Phase 4:** Board-set interest rate history
- [ ] **Phase 5:** CRS statute citations for WARET day/hour limits
- [ ] **Phase 6:** COPERA SCP BPI document (entire domain depends on this)
