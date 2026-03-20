# Employer Operations Agent Desktop — Design Document

**Date:** 2026-03-19
**Status:** Approved
**Depends on:** Phase 8 (Cross-Service Enhancement) — all 13 endpoints

---

## 1. Purpose

A staff-facing operational desktop for monitoring and managing employer relationships.
Aggregates cross-service data (DQ, cases, CRM, correspondence, member roster) into a
single two-panel workspace with an alert-first landing experience.

**Not** the employer self-service portal (that's `EmployerPortalApp`). This is for
internal staff triaging employer health, SLA compliance, and operational issues.

---

## 2. User & Workflow

**Primary user:** Internal staff (roles: `staff`, `admin`)
**Workflow:** Hybrid alert-first → org-detail

1. Desktop opens to a prioritized alert queue (left panel)
2. Staff scans alerts sorted by severity (critical → warning → info)
3. Clicking an alert or org name loads the org detail view (right panel)
4. Staff works within tabbed detail view: inspect issues, create cases, log interactions, generate letters
5. Actions are inline — no need to navigate to other portals

---

## 3. Layout — Two-Panel (CRM-style)

```
┌─────────────────────────────────────────────────────┐
│ Employer Operations                    [search] [⚙]  │
├──────────────┬──────────────────────────────────────┤
│ ALERT QUEUE  │  ORG DETAIL VIEW                     │
│              │                                       │
│ ⚠ DQ: Acme  │  [OrgBanner: Acme Corp]              │
│   Score: 62  │                                       │
│ ⚠ Case: SLA │  ┌─────┬──────┬──────┬──────┬──────┐ │
│   overdue    │  │Health│Cases │ CRM  │Ltrs  │Mbrs  │ │
│ ⚠ Contrib   │  └─────┴──────┴──────┴──────┴──────┘ │
│   exception  │                                       │
│              │  [Tab content: DQ score, issues,      │
│ ─────────── │   member roster, actions...]           │
│ ALL ORGS     │                                       │
│ > Acme Corp  │                                       │
│   Beta Inc   │                                       │
│   City of... │                                       │
└──────────────┴──────────────────────────────────────┘
```

- Left panel: ~280px fixed width, scrollable
- Right panel: flex-1, fills remaining width
- Design system: uses `C`, `BODY`, `DISPLAY` from `lib/designSystem.ts`

---

## 4. Left Panel — Alert Queue

### Alert Sources

| Alert Type | Source Endpoint | Trigger Condition |
|---|---|---|
| DQ Score Drop | `GET /api/v1/dq/employer/{orgId}/score` | Score < `VITE_DQ_SCORE_WARNING` |
| DQ Issues | `GET /api/v1/dq/employer/{orgId}/issues` | Open issues count > 0 |
| Case SLA Breach | `GET /api/v1/employer/{orgId}/cases/summary` | `overdue > 0` |
| Case Volume | `GET /api/v1/employer/{orgId}/cases` | Open cases > `VITE_CASE_VOLUME_WARNING` |

### Alert Severity

- **Critical (red):** DQ score < `VITE_DQ_SCORE_CRITICAL`
- **Warning (yellow):** DQ score < `VITE_DQ_SCORE_WARNING`, SLA overdue > 0, high case volume
- **Info:** Low-priority operational notes

### Behavior

- On mount: fetches summary data for all orgs via `useQueries` fan-out
- Alerts sorted by severity, then by org name
- Clicking alert/org sets `selectedOrgId` → right panel loads
- Selected org highlighted in both alert and org-list sections
- 60-second `refetchInterval` on alert-generating queries

### Below Alerts: Full Org List

- All employers from CRM `usePortalOrganizations()`
- Badge with alert count per org (0 = no badge)
- Serves as fallback navigation when no alerts exist

---

## 5. Right Panel — Org Detail View

### Org Banner (always visible when org selected)

Displays: org name, EIN, active member count, DQ score, status.
Data from: `usePortalOrganization(orgId)` + DQ score endpoint + member summary endpoint.

### Five Tabs

| Tab | Endpoints | Content | Actions |
|---|---|---|---|
| **Health** | DQ score, issues, checks | Score gauge, issue table, check results | "Create Case from Issue" per row |
| **Cases** | Cases list, case summary, create case | Summary cards (open/overdue/resolved), case table | "New Case" → CreateCaseDialog |
| **CRM** | Org interactions, org contacts, create interaction | Interaction timeline, contact list | "Log Interaction" → LogInteractionDialog |
| **Correspondence** | Employer templates, generate letter | Template picker, merge field preview | "Generate Letter" → GenerateLetterDialog |
| **Members** | Member roster, member summary | Tier/status breakdown cards, paginated roster | View-only |

### Tab Behavior

- Health tab is default (alert-first philosophy)
- Each tab lazy-loads data on first visit
- All queries scoped to `selectedOrgId`
- Changing org invalidates cache via React Query key structure

---

## 6. Build-Time Configuration

Thresholds are configurable via Vite environment variables with sensible defaults:

```bash
# .env (defaults, committed)
VITE_DQ_SCORE_CRITICAL=60
VITE_DQ_SCORE_WARNING=80
VITE_SLA_OVERDUE_WARNING=1
VITE_CASE_VOLUME_WARNING=10
```

Consumed via a single config module:

```typescript
// lib/employerOpsConfig.ts
export const OPS_THRESHOLDS = {
  dqScoreCritical: Number(import.meta.env.VITE_DQ_SCORE_CRITICAL ?? 60),
  dqScoreWarning:  Number(import.meta.env.VITE_DQ_SCORE_WARNING ?? 80),
  slaOverdueWarning: Number(import.meta.env.VITE_SLA_OVERDUE_WARNING ?? 1),
  caseVolumeWarning: Number(import.meta.env.VITE_CASE_VOLUME_WARNING ?? 10),
} as const;
```

Override per-deployment via `.env.local` (gitignored) or Vercel environment settings.

---

## 7. Navigation Integration

- New `ViewMode`: `'employer-ops'`
- Accessible to: `admin`, `staff` roles only
- TopNav label: **"Employer Ops"** — positioned after "Employer Portal"
- Lazy-loaded: `const EmployerOpsDesktop = lazy(() => import(...))`

---

## 8. API Layer

### New Files

- `lib/employerOpsApi.ts` — 13 fetch functions (one per Phase 8 endpoint)
- `hooks/useEmployerOps.ts` — React Query wrappers
- `types/EmployerOps.ts` — TypeScript response types

### Endpoints Consumed

```
# Data Access (port 8081)
GET  /api/v1/employer/{orgId}/members
GET  /api/v1/employer/{orgId}/members/summary

# CRM (port 8083)
GET  /api/v1/crm/organizations/{id}/interactions
GET  /api/v1/crm/organizations/{id}/contacts
POST /api/v1/crm/interactions/employer

# Correspondence (port 8085)
GET  /api/v1/correspondence/templates/employer
POST /api/v1/correspondence/generate/employer

# Data Quality (port 8086)
GET  /api/v1/dq/employer/{orgId}/score
GET  /api/v1/dq/employer/{orgId}/issues
GET  /api/v1/dq/employer/{orgId}/checks

# Case Management (port 8088)
GET  /api/v1/employer/{orgId}/cases
GET  /api/v1/employer/{orgId}/cases/summary
POST /api/v1/employer/cases
```

### Query Key Structure

```typescript
['employer-ops', 'dq-score', orgId]
['employer-ops', 'dq-issues', orgId]
['employer-ops', 'cases', orgId]
// etc.
```

### Alert Fan-Out

Uses `useQueries` to call DQ score + case summary for all orgs simultaneously.
React Query deduplicates — switching to an org already fetched for alerts costs zero requests.

---

## 9. File Manifest

### New Files (12)

| File | Est. Lines | Purpose |
|---|---|---|
| `components/employer-ops/EmployerOpsDesktop.tsx` | ~80 | Two-panel layout container |
| `components/employer-ops/AlertQueue.tsx` | ~150 | Left panel: alerts + org list |
| `components/employer-ops/OrgDetailView.tsx` | ~60 | Right panel: banner + tab router |
| `components/employer-ops/tabs/HealthTab.tsx` | ~120 | DQ score, issues, checks |
| `components/employer-ops/tabs/CasesTab.tsx` | ~130 | Case list, summary, create trigger |
| `components/employer-ops/tabs/CRMTab.tsx` | ~100 | Interactions, contacts, log action |
| `components/employer-ops/tabs/CorrespondenceTab.tsx` | ~100 | Templates, letter generation |
| `components/employer-ops/tabs/MembersTab.tsx` | ~90 | Roster table, tier/status summary |
| `hooks/useEmployerOps.ts` | ~120 | React Query hooks for 13 endpoints |
| `lib/employerOpsApi.ts` | ~100 | Fetch functions for Phase 8 endpoints |
| `lib/employerOpsConfig.ts` | ~15 | Build-time threshold config |
| `types/EmployerOps.ts` | ~60 | TypeScript response types |

### Modified Files (2)

| File | Change |
|---|---|
| `types/auth.ts` | Add `'employer-ops'` to ViewMode, staff/admin role access |
| `App.tsx` | Lazy import, TopNav entry, view-mode case |

### Total

~1,125 new lines, 12 new files, 2 modified files. Zero backend changes. No new dependencies.

---

## 10. Non-Goals

- **Not replacing the employer portal** — portal remains for self-service workflows
- **No new backend endpoints** — consumes only existing Phase 8 endpoints
- **No WebSocket/real-time** — polling at 60s is sufficient for staff operational use
- **No employer-role access** — staff/admin only
