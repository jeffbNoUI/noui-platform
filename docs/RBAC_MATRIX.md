# RBAC Matrix — NoUI Platform Access Control

**Date:** 2026-03-22
**Type:** Phase 1 Security Artifact
**Status:** Defining target-state roles; enforcement layer operational

---

## How to Use This Document

This document defines who can do what across the NoUI platform. It covers:
- **Current enforcement** — what's actually implemented and running today
- **Target roles** — the six roles required before any client goes live
- **Service access matrix** — per-role access to each of 21 platform services
- **Change authorization categories** — A/B/C classification from the architecture
- **Enforcement roadmap** — how to get from current state to target state

The enforcement layer (JWT auth middleware + PostgreSQL RLS) is operational.
The role definitions in this document formalize what each role can do within
that enforcement layer.

---

## 1. Current Enforcement (What's Real Today)

### 1.1 Authentication Layer

Every API request passes through `platform/auth/auth.go`:

| Mechanism | Implementation | Source |
|-----------|---------------|--------|
| JWT signing | HS256, validated on every request | `auth.go` |
| Algorithm check | Rejects non-HS256 tokens | `auth.go` |
| Expiration check | Rejects expired tokens | `auth.go` |
| Header stripping | `X-Tenant-ID` removed before processing | `auth.go` |
| Bypass paths | `/healthz`, `/health`, `/health/detail`, `/ready`, `/metrics` only | `auth.go` |

### 1.2 JWT Claims

Extracted from every valid token and placed into request context:

| Claim | Context Key | Required | Default | Notes |
|-------|------------|----------|---------|-------|
| `tenant_id` | `tenant_id` | Yes | Rejected if empty | Determines data partition |
| `role` | `role` | Yes | Rejected if empty | Determines RLS branch |
| `member_id` | `member_id` | No | Empty string | Set for member self-service |
| `sub` | `user_id` | No | Empty string | JWT subject = user identity |

### 1.3 Row-Level Security (RLS)

Enforced at the PostgreSQL layer via `platform/dbcontext/dbcontext.go`.
Per-request session variables injected before any query executes:

```sql
SELECT set_config('app.tenant_id', $1, false),
       set_config('app.member_id', $2, false),
       set_config('app.user_role', $3, false),
       set_config('app.user_id', $4, false)
```

**43 RLS policies** across 4 categories:

| Category | Tables | Policy Pattern | Count |
|----------|--------|---------------|-------|
| 1. Direct tenant isolation | crm_contact, crm_organization, crm_sla_definition, crm_conversation, crm_interaction, crm_commitment, crm_outreach, crm_audit_log, crm_category_taxonomy, crm_note_template, kb_article, dq_check_definition, dq_check_result, dq_issue, correspondence_template, correspondence_history, retirement_case | `tenant_id = app.tenant_id` | 17 |
| 2. Parent-join tenant isolation | crm_contact_address, crm_contact_preference, crm_org_contact, crm_interaction_link, crm_note, crm_sla_tracking, kb_rule_reference, case_flag, case_stage_history, case_note, case_document | `parent_id IN (SELECT ... WHERE tenant_id = app.tenant_id)` | 11 |
| 3. Tenant + member isolation | member_master, salary_hist, contribution_hist, beneficiary, svc_credit, employment_hist, dro_master, benefit_payment, case_hist, transaction_log, member_summary_log | `staff` sees all tenant members; `member` sees own data only | 11 |
| 4. User-scoped (preferences) | preference_events, user_preferences, role_suggestions, suggestion_responses | `tenant_id + user_id` | 4 |

**Shared reference tables (no RLS):** `department_ref`, `position_ref`, `case_stage_definition`

### 1.4 Current RLS Role Branching

Today, RLS policies recognize exactly two role values:

| RLS Role | Behavior | Used By |
|----------|----------|---------|
| `staff` | Sees all member data within their tenant | All fund staff, employers, engineers, admins |
| `member` | Sees only own data (`member_id` match) | Member self-service portal |

All other role values fall through to `staff` behavior (the `dbcontext` default is `staff`).

### 1.5 Employer Portal Roles (Application-Level)

The employer portal service enforces four sub-roles within the `employer_hr` JWT role.
These are **application-level** restrictions stored in the `portal_user` table, not
RLS policies:

| Portal Role | Description |
|-------------|-------------|
| `SUPER_USER` | Full employer portal access — manage users, submit files, view all reports |
| `PAYROLL_CONTACT` | Contribution file submission, payment management |
| `HR_CONTACT` | Enrollment, terminations, member event reporting |
| `READ_ONLY` | View dashboards and reports, no write actions |

Enforced at: `platform/employer-portal/api/handlers.go` (line 94, 127)

---

## 2. Target Roles

Six platform roles required before any client engagement goes live. These map
to JWT `role` claim values and determine both RLS behavior and service-level
access control.

### 2.1 Role Definitions

| Role (JWT `role`) | Description | RLS Mapping | Scope |
|--------------------|-------------|-------------|-------|
| `system_admin` | NoUI platform operations staff | Bypasses RLS (superuser connection) | Cross-tenant |
| `pension_admin` | Fund staff — full operational access within tenant | `staff` | Single tenant, all members |
| `noui_engineer` | NoUI rules/migration engineer assigned to tenant | `staff` | Single tenant, all members |
| `employer_hr` | Employer portal user (sub-roles in portal_user table) | `staff` + application filtering | Single employer within tenant |
| `member` | Member accessing own data via self-service portal | `member` | Own member_id only |
| `auditor` | External or internal auditor — read-only access | `staff` + write-blocking | Single tenant, all members, no writes |

### 2.2 Role Hierarchy

```
system_admin          (cross-tenant, NoUI ops — platform maintenance)
  └── noui_engineer   (single-tenant, NoUI staff — rules/migration work)
  └── pension_admin   (single-tenant, fund staff — full operations)
        └── auditor   (single-tenant, read-only — regulatory examination)
  └── employer_hr     (employer-scoped — payroll/HR reporting)
  └── member          (member-scoped — self-service only)
```

No role inherits permissions from another. Each role is independently defined.
The hierarchy shows scope narrowing, not permission inheritance.

---

## 3. Service Access Matrix

Access level per role per service. Services grouped by function.

**Legend:** `R` = Read, `W` = Read+Write, `A` = Admin (full), `—` = No access

### 3.1 Core Platform Services

| Service (Port) | system_admin | pension_admin | noui_engineer | employer_hr | member | auditor |
|----------------|:---:|:---:|:---:|:---:|:---:|:---:|
| dataaccess (8081) | A | W | W | R | R | R |
| intelligence (8082) | A | W | W | — | R | R |
| crm (8083) | A | W | W | — | — | R |
| correspondence (8085) | A | W | W | — | R | R |
| dataquality (8086) | A | W | W | — | — | R |
| knowledgebase (8087) | A | R | W | R | R | R |
| casemanagement (8088) | A | W | W | — | R | R |
| preferences (8089) | A | W | W | W | W | R |

**Notes:**
- `member` reads from `dataaccess` are scoped by RLS to own data only
- `member` reads from `intelligence` are benefit estimate requests for own member_id
- `member` reads from `correspondence` are own correspondence history
- `member` reads from `casemanagement` are own case status
- `employer_hr` reads from `dataaccess` are employer roster only (application-filtered)
- `auditor` has no write access to any service — enforced at middleware level

### 3.2 Infrastructure Services

| Service (Port) | system_admin | pension_admin | noui_engineer | employer_hr | member | auditor |
|----------------|:---:|:---:|:---:|:---:|:---:|:---:|
| connector (8090) | A | — | W | — | — | — |
| healthagg (8091) | A | R | R | — | — | R |
| issues (8092) | A | W | W | — | — | R |
| security (8093) | A | R | R | — | — | R |

**Notes:**
- `connector` is NoUI infrastructure — only engineers and admins interact with it
- `healthagg` is unauthenticated (bypass path) but listed here for completeness
- `security` read access shows auth event logs — sensitive, limited to admin/audit

### 3.3 Employer Services

| Service (Port) | system_admin | pension_admin | noui_engineer | employer_hr | member | auditor |
|----------------|:---:|:---:|:---:|:---:|:---:|:---:|
| employer-portal (8094) | A | R | R | W | — | R |
| employer-reporting (8095) | A | R | R | W | — | R |
| employer-enrollment (8096) | A | R | R | W | — | R |
| employer-terminations (8097) | A | R | R | W | — | R |
| employer-waret (8098) | A | R | R | W | — | R |
| employer-scp (8099) | A | R | R | W | — | R |

**Notes:**
- `employer_hr` write access is further scoped by employer portal sub-role
  (SUPER_USER, PAYROLL_CONTACT, HR_CONTACT, READ_ONLY)
- `pension_admin` has read access to employer data for oversight
- `auditor` has read access to all employer data for examination

### 3.4 Migration Services

| Service (Port) | system_admin | pension_admin | noui_engineer | employer_hr | member | auditor |
|----------------|:---:|:---:|:---:|:---:|:---:|:---:|
| migration (8100) | A | R | W | — | — | R |
| migration-intelligence (8101) | A | — | W | — | — | — |

**Notes:**
- Migration services are NoUI engineer tools — fund staff can observe, not operate
- `migration-intelligence` (AI scoring) is restricted to engineers and admins

---

## 4. Change Authorization Categories

Three categories govern what level of approval is required for platform changes.
These apply to rule changes, configuration changes, and data corrections.

### Category A: Threshold Adjustments

**What:** Modifying numeric values within existing rule/configuration structures.
Examples: contribution rate change, COLA cap adjustment, escalation percentage update.

**Authorization:** Plan Administrator approval.

**Audit:** Change logged with before/after values, approver identity, effective date.

**Risk:** Low — existing structure, new values. Testable against existing test suite.

### Category B: Structural Changes

**What:** Adding, removing, or restructuring rules, workflows, templates, or process definitions.
Examples: new correspondence template, new workflow stage, new data quality check rule,
new employer portal feature.

**Authorization:** NoUI Rules Engineer technical validation + Plan Administrator approval.

**Audit:** Full change package — test results, before/after state, approval chain, effective date.

**Risk:** Medium — new structure requires new test coverage.

### Category C: Benefit Values / Eligibility Determinations

**What:** Any change that affects computed benefit amounts, eligibility paths, or
payment calculations. Examples: benefit accrual formula change, vesting schedule
modification, early retirement reduction factor change.

**Authorization:** NoUI Rules Engineer technical validation + Plan Administrator policy
approval + Executive/Board sign-off (for material changes).

**Audit:** Full regression suite results, demo-case verification to the penny,
compliance sign-off, actuary review (if applicable), effective date.

**Risk:** High — fiduciary impact. Incorrect changes affect member benefits.
All Category C changes must be verified against demo-case expected values
before any approval is granted.

### Category/Role Authorization Matrix

| Action | system_admin | pension_admin | noui_engineer | employer_hr | member | auditor |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| Category A: Initiate | — | Yes | Yes | — | — | — |
| Category A: Approve | — | Yes | — | — | — | — |
| Category B: Initiate | Yes | — | Yes | — | — | — |
| Category B: Approve (technical) | — | — | Yes | — | — | — |
| Category B: Approve (policy) | — | Yes | — | — | — | — |
| Category C: Initiate | — | — | Yes | — | — | — |
| Category C: Approve (technical) | — | — | Yes | — | — | — |
| Category C: Approve (policy) | — | Yes | — | — | — | — |
| Category C: Approve (executive) | — | Yes* | — | — | — | — |

*Executive approval may be the Plan Administrator or a designated board member,
depending on the fund's governance structure.

---

## 5. Data Sensitivity Classification

### 5.1 Sensitivity Tiers

| Tier | Examples | Access Restriction |
|------|----------|-------------------|
| **Public** | Plan provisions, stage definitions, department codes | Any authenticated user |
| **Internal** | Aggregate statistics, system health, employer counts | Staff roles only (not member) |
| **Confidential** | Member names, addresses, employment history, case status | Tenant-scoped, role-filtered |
| **Restricted** | SSN, bank accounts, medical/disability records, tax documents | Field-level encryption (AES-256-GCM), authorized roles only |

### 5.2 Restricted Field Access

| Field | pension_admin | noui_engineer | employer_hr | member | auditor |
|-------|:---:|:---:|:---:|:---:|:---:|
| SSN (full) | Last 4 only | No | No | Last 4 only | Last 4 only |
| SSN (masked) | Yes | Yes | Yes | Yes | Yes |
| Bank account | No | No | No | Own only | No |
| Medical/disability | Authorized staff only | No | No | Own only | With justification |
| Tax documents | Yes | No | No | Own only | Yes |

**Note:** Field-level restrictions are target-state. Current implementation uses
RLS for row-level isolation. Field-level masking is Phase 3 (ABAC).

---

## 6. Audit Event Requirements

Every role-controlled action generates an audit event. Events are immutable
records in the `transaction_log` table with 7-year retention.

### 6.1 Event Categories

| Category | Trigger | Required Fields |
|----------|---------|-----------------|
| AUTH | Login, logout, token refresh, failed auth attempt | user_id, tenant_id, timestamp, IP, result |
| DATA_READ | Member record access (any PII field) | user_id, member_id, fields_accessed, timestamp |
| DATA_WRITE | Any mutation to member/case/financial data | user_id, before_value, after_value, timestamp |
| CONFIG_CHANGE | Category A/B/C change (see Section 4) | user_id, category, change_package, approvals |
| ROLE_CHANGE | Role assignment, removal, or modification | admin_user_id, target_user_id, old_role, new_role |
| EXPORT | Data export or report generation | user_id, export_type, record_count, timestamp |

### 6.2 Current vs. Target Audit Coverage

| Event | Current State | Target State |
|-------|--------------|--------------|
| AUTH events | Security service (8093) captures login/session | Expand to failed auth trending |
| DATA_WRITE | transaction_log captures mutations | Add before/after values |
| DATA_READ | Not captured | Phase 2 — add for PII fields |
| CONFIG_CHANGE | Not applicable yet (no config UI) | Phase 2 — with rules engine |
| ROLE_CHANGE | Not captured | Phase 2 — with role management UI |
| EXPORT | Not captured | Phase 2 — with report generation |

---

## 7. Enforcement Roadmap

### Phase 1 (Current) — Tenant Isolation + Two-Branch RLS

**Status: Operational**

- JWT auth on every endpoint (platform/auth/auth.go)
- RLS with `staff`/`member` branching on 47 policies
- Employer portal sub-roles (application-level)
- Health/readiness bypass paths only
- Header stripping (X-Tenant-ID)

### Phase 2 — Role-Based Endpoint Filtering

**Status: Design (this document)**

Implementation:
- Auth middleware reads `role` claim and checks against per-service allowed-role list
- Each service registers its role requirements (e.g., migration endpoints require
  `system_admin` or `noui_engineer`)
- `auditor` role gets write-blocking middleware (HTTP methods GET/HEAD/OPTIONS only)
- `employer_hr` gets service-level filtering (employer services only)
- New RLS policy branches for `auditor` (staff data scope, no WITH CHECK)

**Trigger:** Before first client engagement goes live.

### Phase 3 — Attribute-Based Access Control (ABAC)

**Status: Future**

Implementation:
- Field-level masking (SSN, bank accounts, medical records)
- Context-aware rules (e.g., "staff can see SSN only during active case work")
- Break-glass access with justification and time-limited elevation
- Delegated permissions with expiration

**Trigger:** When restricted-field access patterns are defined by client policy.

---

## Appendix A: Service Port Registry

| Port | Service | Module Path |
|------|---------|------------|
| 3000 | frontend | React/Vite |
| 8081 | dataaccess | github.com/noui/platform/dataaccess |
| 8082 | intelligence | github.com/noui/platform/intelligence |
| 8083 | crm | github.com/noui/platform/crm |
| 8085 | correspondence | github.com/noui/platform/correspondence |
| 8086 | dataquality | github.com/noui/platform/dataquality |
| 8087 | knowledgebase | github.com/noui/platform/knowledgebase |
| 8088 | casemanagement | github.com/noui/platform/casemanagement |
| 8089 | preferences | github.com/noui/platform/preferences |
| 8090 | connector | github.com/noui/platform/connector |
| 8091 | healthagg | github.com/noui/platform/healthagg |
| 8092 | issues | github.com/noui/platform/issues |
| 8093 | security | github.com/noui/platform/security |
| 8094 | employer-portal | github.com/noui/platform/employer-portal |
| 8095 | employer-reporting | github.com/noui/platform/employer-reporting |
| 8096 | employer-enrollment | github.com/noui/platform/employer-enrollment |
| 8097 | employer-terminations | github.com/noui/platform/employer-terminations |
| 8098 | employer-waret | github.com/noui/platform/employer-waret |
| 8099 | employer-scp | github.com/noui/platform/employer-scp |
| 8100 | migration | github.com/noui/platform/migration |
| 8101 | migration-intelligence | Python FastAPI |

## Appendix B: Auth Bypass Paths

These endpoints skip JWT validation entirely. They must never return
tenant-specific or member-specific data.

```
/healthz        — Kubernetes liveness probe
/health         — Basic health check
/health/detail  — Detailed health (service internals only, no tenant data)
/ready          — Kubernetes readiness probe
/metrics        — Prometheus metrics (counters and gauges only)
```

---

*NoUI Platform — RBAC Matrix v1.0 — 2026-03-22 — Confidential*
