# Phase 7: Inactive Member Experience — Execution Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the inactive member experience — deferred benefit explorer, refund estimate/application, and backend endpoints for refund estimates, payment history, and tax documents.

**Architecture:** Frontend components in `frontend/src/components/portal/inactive/`, following existing wizard and section patterns. Go endpoints in `platform/dataaccess/`. All calculations server-side — frontend displays only.

**Tech Stack:** React + TypeScript, Vitest, Go 1.22, sqlmock, existing design system (C colors, DISPLAY/BODY fonts).

---

## Task 51: Deferred Benefit Explorer

**Files:**
- Create: `frontend/src/components/portal/inactive/DeferredBenefitExplorer.tsx`
- Create: `frontend/src/components/portal/inactive/__tests__/DeferredBenefitExplorer.test.tsx`

Adapts GuidedWizard pattern for inactive members:
- 4 steps: Retirement Date → Service Purchase → Payment Option → Results
- No salary growth step (salary frozen at separation)
- Uses `useWhatIfCalculator` with frozen salary flag
- Earliest date = deferred vesting date, not current date

**Tests:** Loading state, step navigation, validation (date required), frozen salary display, results rendering, save scenario. ~10 tests.

**Commit:** `[frontend] Add deferred benefit explorer for inactive members`

---

## Task 52: Refund Estimate Display

**Files:**
- Create: `frontend/src/components/portal/inactive/RefundEstimate.tsx`
- Create: `frontend/src/components/portal/inactive/__tests__/RefundEstimate.test.tsx`

Shows employee contributions + interest = total refundable amount.
Tax comparison: 20% mandatory withholding vs. IRA rollover (tax-deferred).
Uses `refundAPI.estimate()` from memberPortalApi.ts.

**Tests:** Loading, data display, tax comparison rendering, error state. ~8 tests.

**Commit:** `[frontend] Add refund estimate with tax implications display`

---

## Task 53: Refund Application Flow

**Files:**
- Create: `frontend/src/components/portal/inactive/RefundApplication.tsx`
- Create: `frontend/src/components/portal/inactive/__tests__/RefundApplication.test.tsx`

5-stage flow: Verify Info → Upload Docs → Review Amount (tax/rollover choice) → Acknowledge (double confirm) → Staff Processing Status.
Follows ApplicationSection pattern (stage tracker, stage-based rendering).

**Tests:** Stage navigation, double confirmation requirement, submission, status display. ~10 tests.

**Commit:** `[frontend] Add refund application flow with double confirmation`

---

## Task 54: Backend — Refund Estimate Endpoint

**Files:**
- Modify: `platform/dataaccess/api/handlers.go` — add `GetRefundEstimate`
- Modify: `platform/dataaccess/main.go` — register route
- Modify: `platform/dataaccess/api/handlers_test.go` — add tests

`GET /api/v1/members/{id}/refund-estimate`
Response: `{ employee_contributions, interest, total, mandatory_withhold_20pct, net_after_withhold }`
Query: SUM from contribution_hist table.

**Tests:** Valid request, invalid ID, no data (zero contributions). ~3 tests.

**Commit:** `[platform/dataaccess] Add refund estimate endpoint`

---

## Task 55: Backend — Payment History & Tax Document Endpoints

**Files:**
- Modify: `platform/dataaccess/api/handlers.go` — add 4 handlers
- Modify: `platform/dataaccess/main.go` — register 4 routes
- Modify: `platform/dataaccess/api/handlers_test.go` — add tests

Endpoints:
- `GET /api/v1/members/{id}/payments` — paginated payment history
- `GET /api/v1/members/{id}/tax-documents` — tax document list
- `GET /api/v1/members/{id}/addresses` — address records
- `PUT /api/v1/members/{id}/addresses/{aid}` — update address

**Tests:** 2 per endpoint (valid + invalid ID) + 1 update test. ~9 tests.

**Commit:** `[platform/dataaccess] Add payment history, tax documents, and address endpoints`

---

## Wiring (after all tasks)

- Wire `DeferredBenefitExplorer`, `RefundEstimate`, `RefundApplication` into `MemberPortal.tsx` for inactive persona
- Add nav items in sidebar config
- Update test counts

**Commit:** `[frontend] Wire inactive member components into portal router`

---

## Execution Order

Tasks 51–53 (frontend) are independent of Tasks 54–55 (backend) — frontend already has mock-compatible API calls. Execute sequentially: 51 → 52 → 53 → 54 → 55 → wire.
