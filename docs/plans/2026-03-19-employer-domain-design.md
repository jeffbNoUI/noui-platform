# Employer Domain — Full Roadmap Design

**Date:** 2026-03-19
**Scope:** All 7 employer domains (Portal, Reporting, Enrollment, Terminations, WARET, SCP, Customer Service)
**Authoritative spec:** `docs/noui-copera-employer-domain-functionality.md`
**Execution model:** Autonomous multi-session worktree, review at phase boundaries

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backend | 6 new Go services (one per domain) | Maximum isolation; independent scaling and deployment |
| Frontend | New `employer-portal/` directory | Zero conflict with existing `portal/` components; swap at merge |
| Database | Additive schema files (020-025) | No changes to existing schema; all new tables |
| Shared code | `platform/employer-shared/` Go module | Types, rate table lookups, division config shared at compile time |
| Conflict strategy | All new directories, new ports, new schema files | Zero overlap with concurrent work on existing codebase |
| Data gaps | Real COPERA data only — no mocks | User will source rate tables; schema ready to receive |

---

## Service Topology

| Service | Directory | Port | Purpose |
|---|---|---|---|
| employer-portal | `platform/employer-portal/` | 8094 | Role management, onboarding, dashboards, alerts, file upload routing |
| employer-reporting | `platform/employer-reporting/` | 8095 | Contribution validation engine, exceptions, payment setup |
| employer-enrollment | `platform/employer-enrollment/` | 8096 | New member enrollment, duplicate detection, PERAChoice |
| employer-terminations | `platform/employer-terminations/` | 8097 | Certification, holds, refund calculation, disbursement |
| employer-waret | `platform/employer-waret/` | 8098 | Designation management, hour/day tracking, penalties |
| employer-scp | `platform/employer-scp/` | 8099 | Service credit purchase, cost factors, exclusion flags |
| employer-shared | `platform/employer-shared/` | N/A | Shared Go module (types, rate tables, division config) |

Customer Service (Domain 7) enhances existing `platform/casemanagement/` and `platform/crm/` — no new service.

---

## Build Phases (Spec Section 10 — Dependency Order)

### Phase 1: Foundation — Portal Core + Shared Infrastructure

**Services:** employer-shared, employer-portal
**Database:** 020_employer_shared.sql
**Frontend:** employer-portal/ layout, navigation, communications, dashboards

**Deliverables:**
- employer-shared Go module: types (Employer, Division, ContributionCategory, RateTable), division config (5 COPERA divisions), rate table DB lookups
- employer-portal service: role management (SUPER_USER, PAYROLL_CONTACT, HR_CONTACT, READ_ONLY), onboarding modules, dashboards (tasks, exceptions, submissions), system alerts, COPERA staff impersonation (audit-logged), communication preferences
- Database: employer_portal_user, employer_division, contribution_rate_table, employer_alert
- Frontend: EmployerPortalApp router, OrgBanner, AlertBanner, TaskNav, SecureMessaging, role-based navigation
- Integration: Wire new frontend into App.tsx (single merge point)

### Phase 2: Reporting Engine

**Services:** employer-reporting
**Database:** 021_employer_reporting.sql
**Frontend:** employer-portal/reporting/

**Deliverables:**
- File upload (text/Excel) with real-time format validation
- Manual grid entry with row-level validation feedback
- Contribution rate validation: plan_type x tier x salary x division against rate tables
- Enrollment check: SSN must match active member; flag unrecognized/wrong SSN/wrong plan
- Retiree/IC detection: working retiree flag → WARET path, IC comment → IC review
- Salary spreading detection for school employees
- Partial posting: valid records proceed, failed records to exception queue
- Exception workflow: categorized by status/age/type, employer resolves individual records
- DC team auto-routing for 401k/457 exceptions
- Payment setup: ACH debit (COPERA-initiated) or wire transfer (employer-initiated)
- File replacement and correction merging
- Late interest accrual and payment
- Database: contribution_file, contribution_record, contribution_exception, contribution_payment, late_interest_accrual

### Phase 3: New Member Enrollment

**Services:** employer-enrollment
**Database:** 022_employer_enrollment.sql
**Frontend:** employer-portal/enrollment/

**Deliverables:**
- Employer-initiated enrollment (~70-80% of enrollments): submit new hire data, auto-notify member
- Member-initiated enrollment (~20-30%): member submits, auto-notify employer to validate
- Mandatory field enforcement: SSN, hire_date, plan_code, division_code, name
- Duplicate detection: SSN exact match + name+DOB fuzzy match, admin review before processing
- Conflict resolution: employer vs. member data disagree → resolution workflow with both notified
- Tier/division assignment based on hire date + employer division
- PERAChoice 60-day election window: detect eligible members, track window, route to DC team
- Re-hire workflow: returning member, prior service credit, refund redeposit check
- Downloadable validation report for employer
- W2 address cross-check (flag inconsistencies)
- Database: enrollment_submission, enrollment_duplicate_flag, perachoice_election

### Phase 4: Terminations & Refund

**Services:** employer-terminations
**Database:** 023_employer_terminations.sql
**Frontend:** employer-portal/terminations/

**Deliverables:**
- Termination certification: employer submits last day worked + final contribution
- Ad-hoc certification: employer can submit outside monthly file cycle via portal
- Certification hold logic: auto-create "Pending Employer Certification" when refund form received with no termination date
- Configurable countdown (45-day default) with auto-reminders, auto-escalation, auto-cancellation
- Refund application: member submits with signature, notarization, ACH/rollover info, W-9
- Eligibility check: separation waiting period, vesting (5 years), disability application check (<2 years blocks refund)
- Refund calculation: employee contributions + compound interest (board-set rate, annually June 30) - 20% federal tax - DRO deductions
- Payment: direct, rollover, or partial rollover. Payment lock N business days before disbursement.
- Special cases: retiree re-employment segment separation, DRO alternate payee, DPS Audit trigger, PreRet hold
- Vested member forfeiture acknowledgment requirement
- Database: termination_certification, certification_hold, refund_application

### Phase 5: WARET (Working After Retirement)

**Services:** employer-waret
**Database:** 024_employer_waret.sql
**Frontend:** employer-portal/waret/

**Deliverables:**
- Three designation types: Standard (110 days/720 hours), 140-Day (140/960, school employers), Critical Shortage (no cap, rural schools/BOCES)
- Designation validation: eligible employer type, capacity check (10 per district), consecutive year limit (6 years + 1-year break)
- ORP loophole: 1990s ORP electors with continuous employment → exempt from limits
- Effective month rule: no work on first business day (full cancellation), 5% per day after
- Penalty calculation: 5% of monthly benefit per day over cap, non-disclosure recovery (both shares)
- Deduction spreading: split across months when single month deduction exceeds net benefit
- PERACare subsidy interaction: detect conflict with Critical Shortage, 30-day letter, auto-remove if no response
- IC detection: retiree-owned company flag, annual Disclosure of Compensation form
- Annual reconciliation: WARET Limit Worksheet (March 31 deadline), W2/1099 tax data cross-check
- WARRC Monthly Report: active retirees with deductions
- Database: waret_designation, waret_tracking, waret_ytd_summary (view), waret_penalty, waret_ic_disclosure

### Phase 6: Service Credit Purchase

**Services:** employer-scp
**Database:** 025_employer_scp.sql
**Frontend:** employer-portal/scp/

**Note:** SCP BPI not available. Schema designed for confirmed rules; implementation details pending BPI retrieval.

**Deliverables:**
- Cost quote: actuarial cost factor lookup (versioned tables by tier, hire date, age at purchase)
- Quote expiration with recalculation after expiry
- Eligibility verification: service type validation (refunded prior PERA, military/USERRA, prior public employment, leave of absence, PERAChoice transfer)
- Payment: lump sum, direct rollover, installment (rules from SCP BPI)
- Exclusion flags enforced at record creation: NOT counted for Rule of 75/85, NOT counted for IPR, NOT counted for vesting
- Database: scp_cost_factor, scp_request

### Phase 7: Customer Service Enhancements (Deferred)

**Services:** Existing casemanagement + crm (enhanced, not new)
**Scope:** Context surfacing, skill-based routing, SLA tracking

**Note:** This phase touches existing services and should NOT run in parallel with other work on those services. Schedule as a separate effort after Phases 1-6.

**Deliverables:**
- Context surfacing: query across employer services by inquiry type (contribution issue → submission history + exceptions; enrollment → tier/division + duplicate flag; termination → certification status + countdown; WARET → designation + YTD tracking + penalties; SCP → purchase balance + exclusion flags)
- Skill-based routing: configurable skill_tags on cases (WARET, contribution_exception, survivor_benefits, etc.)
- SLA tracking: due dates on work items, % on target dashboard, alerts before breach
- Unified agent desktop: single interface with all context panels (deferred if Genesys integration not ready)

---

## Database Schema Summary

| Migration File | Tables | Domain |
|---|---|---|
| 020_employer_shared.sql | employer_portal_user, employer_division, contribution_rate_table, employer_alert | Shared + Portal |
| 021_employer_reporting.sql | contribution_file, contribution_record, contribution_exception, contribution_payment, late_interest_accrual | Reporting |
| 022_employer_enrollment.sql | enrollment_submission, enrollment_duplicate_flag, perachoice_election | Enrollment |
| 023_employer_terminations.sql | termination_certification, certification_hold, refund_application | Terminations |
| 024_employer_waret.sql | waret_designation, waret_tracking, waret_ytd_summary (view), waret_penalty, waret_ic_disclosure | WARET |
| 025_employer_scp.sql | scp_cost_factor, scp_request | SCP |

All tables are new — zero modifications to existing schema files 001-013.

---

## Frontend Structure

```
frontend/src/components/employer-portal/
├── EmployerPortalApp.tsx
├── EmployerPortalNav.tsx
├── layout/                    # OrgBanner, AlertBanner, TaskNav
├── communications/            # SecureMessaging, ExceptionResponses
├── reporting/                 # FileUpload, ManualGrid, ValidationProgress, ExceptionDashboard, CorrectionWorkflow, PaymentSetup
├── enrollment/                # NewHireForm, StatusChangeForm, DuplicateResolution, PERAChoiceTracker
├── terminations/              # TerminationForm, CertificationHold, RefundStatus
├── waret/                     # DesignationForm, DesignationDashboard, LimitTracker, AnnualWorksheet
├── scp/                       # CostQuote, PurchaseRequest, PaymentTracker
├── shared/                    # EmployerDashboard, ExceptionBadge, RateDisplay
└── __tests__/                 # Tests mirror component structure
```

New hooks in `frontend/src/hooks/`:
- useEmployerPortal.ts — portal user, dashboard, alerts
- useEmployerReporting.ts — file upload, validation, exceptions, payments
- useEmployerEnrollment.ts — submissions, duplicates, PERAChoice
- useEmployerTerminations.ts — certifications, holds, refund apps
- useEmployerWaret.ts — designations, tracking, penalties
- useEmployerScp.ts — quotes, requests, cost factors

New API client in `frontend/src/lib/`:
- employerApi.ts — HTTP client for all 6 employer services (port-routed via nginx/vite proxy)

---

## Conflict Avoidance Strategy

| Area | Safe? | Notes |
|---|---|---|
| `platform/employer-*` (6 dirs) | 100% safe | New directories, no overlap |
| `platform/employer-shared/` | 100% safe | New directory |
| `frontend/src/components/employer-portal/` | 100% safe | New directory |
| `frontend/src/hooks/useEmployer*.ts` | 100% safe | New files |
| `frontend/src/lib/employerApi.ts` | 100% safe | New file |
| `domains/pension/schema/020-025` | 100% safe | New files, high number prefix |
| `docker-compose.yml` | Merge checkpoint | Add 6 new service entries — single merge |
| `frontend/src/App.tsx` | Merge checkpoint | Swap employer-portal route — single merge |
| `.github/workflows/ci.yml` | Merge checkpoint | Add 6 new services to CI matrix |
| `infrastructure/helm/` | Merge checkpoint | Add 6 new Helm charts |

**Strategy:** Build everything in new directories. At phase boundaries, do a targeted merge of the 4 shared files (docker-compose, App.tsx, CI, Helm).

---

## Data Dependencies (User Must Source)

| Data | Needed By | Phase |
|---|---|---|
| AED/SAED rate tables by division + effective date | employer-reporting validation | Phase 2 |
| Contribution rate matrix (plan x tier x salary → rate) | employer-reporting validation | Phase 2 |
| Payment setup discrepancy threshold value(s) | employer-reporting payment | Phase 2 |
| Complete mandatory enrollment field set | employer-enrollment validation | Phase 3 |
| PERAChoice eligible employer/position categories | employer-enrollment PERAChoice | Phase 3 |
| Separation waiting period statute citation + exceptions | employer-terminations eligibility | Phase 4 |
| Board-set interest rate history table | employer-terminations refund calc | Phase 4 |
| CRS statute citations for WARET day/hour limits | employer-waret rules | Phase 5 |
| COPERA SCP BPI document | employer-scp (entire domain) | Phase 6 |

---

## Fiduciary Constraints (All Domains)

- $0.00 tolerance on: refund calculations, contribution validations, penalty calculations, cost factor applications
- All monetary values stored as NUMERIC(n,2) in PostgreSQL — never floating point
- Go code uses math/big or scaled integers for monetary arithmetic — never float64
- All calculations must trace to CRS statute section or COPERA Board resolution
- Rules engine supports effective dating — historical rules produce historically correct results
- AI role: rules configuration acceleration, workflow orchestration, exception triage — NEVER calculation execution or benefit determination
- Controlled terminology enforced (see CLAUDE.md)

---

## Test Strategy

Each service gets:
- **Unit tests:** Domain logic (validation rules, calculation accuracy, edge cases) — `go test ./... -short`
- **Handler tests:** HTTP request/response with sqlmock — `go test ./api/...`
- **Frontend tests:** Component renders + hook behavior with fetch-mock — `npm test`
- **Integration tests (Tier 2):** Real PostgreSQL with seed data — `go test ./... -count=1`

Regression gates:
- Contribution rate validation must match COPERA rate tables exactly
- Refund calculations must match hand-calculated expected results to $0.00
- WARET penalty calculations must match spec formulas exactly

---

## Open Questions (Deferred — Not Blocking Phase 1-2)

| Question | Resolution Source | Blocking Phase |
|---|---|---|
| Agency Directory current state (sync frequency, system of record) | COPERA IT | Phase 1 (directory sync feature) |
| ORP-specific validation rules | COPERA Rules Analysis session | Phase 2 (ORP contribution path) |
| Re-hire enrollment workflow (restoring service credit, vesting continuity) | COPERA Benefits team | Phase 3 |
| PreRet workflow trigger conditions (disability application age threshold) | COPERA BSD Manager | Phase 4 |
| Whether 6-year consecutive limit applies equally to 140-day and Critical Shortage | COPERA Policy team | Phase 5 |
| "Second retirement" pathway (suspend → re-enter → re-retire) | COPERA Benefits team | Phase 5 |
| Colorado recording consent requirements for call centers | COPERA Legal | Phase 7 |
| SLA target table by inquiry type | COPERA Operations | Phase 7 |
