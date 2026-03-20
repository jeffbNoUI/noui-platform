# Employer Ops Desktop Redesign — Design Document

**Date:** 2026-03-20
**Status:** Approved
**Branch:** `claude/sharp-wu`

---

## Problem

The current Employer Ops desktop is a two-panel layout (sidebar org list + tabbed detail) designed for 3 test employers. Pension funds serve several hundred employers. The current design doesn't scale — a flat sidebar list becomes unusable, and 5 deep tabs per employer violates the NoUI hub principle.

## Design Decisions

| Question | Decision |
|----------|----------|
| Primary workflow | Alert-first triage — staff works a prioritized queue of problems |
| Secondary workflow | Employer lookup via rich search (name, ID, contact name) |
| Profile depth | Summary dashboard with deep links to specialized views (hub, not destination) |
| Communication history | Unified activity feed: CRM interactions + correspondence + case activity |
| Contributions & Balances | "Coming Soon" cards — reuses Employer Portal Reporting when ready |
| Search mechanism | Persistent top-of-screen search bar, client-side filtering, dropdown overlay |

## Layout

Single-panel, full-width, two states in one container.

### Top Bar (always visible)

```
┌─────────────────────────────────────────────────────────────┐
│ [N] NoUI    [Staff Portal] [Member Portal] ... [Employer Ops]│
├─────────────────────────────────────────────────────────────┤
│ 🔍 Search employers by name, ID, or contact...   [12 alerts]│
└─────────────────────────────────────────────────────────────┘
```

- Standard TopNav (existing, unchanged)
- Full-width search bar with alert count badge on the right
- Alert badge is clickable — returns to triage view from anywhere
- Search is client-side (org list + contacts already in React Query cache)

### State 1: Triage View (default on load)

Full-width alert table showing every employer issue that needs attention.

```
SEVERITY   EMPLOYER                  ISSUE             METRIC   AGE
──────────────────────────────────────────────────────────────────
● CRITICAL City and County of Denver DQ Score Critical    23%   2d
● CRITICAL Denver Water              SLA Breach            3    4h
● CRITICAL Metro Wastewater          DQ Score Critical    41%   1d
● WARNING  Adams County              Case Volume High     14    3d
● WARNING  Arapahoe County           DQ Score Low         72%   6h
● INFO     Aurora Water              Open DQ Issues        4   12h

Showing 12 alerts across 8 employers
```

**Behavior:**
- Sorted by severity (critical → warning → info), then by age (newest first)
- Severity toggle buttons: `[All] [Critical] [Warning] [Info]`
- Each row clickable → navigates to employer profile
- Rows show: severity dot (color-coded), employer name, issue type, metric value, alert age

**Below the alert table:** Compact "All Employers" section — every employer alphabetically with inline DQ score and case count badges. Virtual-scrolled for 500+ employers.

### State 2: Employer Profile (selected employer)

Three zones stacked vertically.

#### Zone 1: Org Banner

Dense single-row banner showing key employer details at a glance.

- Employer name (prominent) + DQ score badge (color-coded)
- Employer ID, address, primary contact (name, email, phone)
- Bank on file (masked), member count, active case count

#### Zone 2: Summary Card Grid (4x2 responsive)

Eight cards. Each shows title + 2-3 key metrics + a link action.

| Card | Metrics | Links To |
|------|---------|----------|
| DQ Health | Score, issue count, critical count | Data Quality view |
| Cases | Active, at-risk, overdue counts | Case Management |
| Members | Total, tier breakdown (T1/T2/T3) | Member search filtered to employer |
| Contacts & Users | Portal user count, contact count | CRM contacts view |
| Correspondence | Recent letter count, last sent date | Correspondence panel |
| Contributions | "Coming Soon" badge | Employer Portal Reporting (future) |
| Balances | "Coming Soon" badge | Employer Portal Reporting (future) |
| Actions | Log Call, New Case, Send Letter buttons | Opens action dialogs inline |

The **Actions card** is a quick-action launcher — the three most common staff operations without navigating away. Reuses existing dialog components.

#### Zone 3: Unified Activity Feed

Chronological timeline of all employer touchpoints.

- Event types: CRM interactions, correspondence, case state changes, DQ issue opens/resolves
- Each entry: icon + relative timestamp + one-line summary
- Icons by type: 📞 call, ✉️ letter, 📋 DQ issue, 🔴 case at-risk, ✅ case resolved
- Truncated to last ~10 events with "Show more" to expand
- Assembled client-side by merging data from existing CRM, correspondence, and case endpoints

### Search Dropdown

Typing in the search bar opens a dropdown overlay without navigating away.

```
┌─────────────────────────────────────────────────────┐
│  City and County of Denver    EMP-00142  2,847 mbrs │
│  Denver Water                 EMP-00089    412 mbrs │
│                                                     │
│  CONTACTS MATCHING "den"                            │
│  Dennis Park — Cherry Creek Schools (EMP-00156)     │
└─────────────────────────────────────────────────────┘
```

- Two sections: **Employers** (name/ID match) and **Contacts** (contact name match, showing their employer)
- Client-side fuzzy filtering — no network requests
- Minimum 2 characters to trigger
- Escape or click-outside to close
- Selecting a result navigates to that employer's profile

## Component Architecture

### Replaced (rewrite)
- `EmployerOpsDesktop.tsx` — two-panel → single-panel with triage/profile states
- `OrgBanner.tsx` — minimal → dense info banner

### Removed
- `tabs/HealthTab.tsx` — replaced by DQ Health summary card + deep link
- `tabs/CasesTab.tsx` — replaced by Cases summary card + deep link
- `tabs/CRMTab.tsx` — replaced by activity feed + Contacts card + deep link
- `tabs/CorrespondenceTab.tsx` — replaced by Correspondence card + deep link
- `tabs/MembersTab.tsx` — replaced by Members summary card + deep link

### New Components
- `AlertTable.tsx` — sortable/filterable alert table for triage view
- `EmployerSearch.tsx` — search bar with dropdown overlay
- `SummaryCardGrid.tsx` — 8-card responsive grid layout
- `SummaryCard.tsx` — reusable card (title, metrics, link/action)
- `ActivityFeed.tsx` — unified timeline merging CRM + correspondence + cases
- `ActionCard.tsx` — quick-action launcher with dialog triggers

### Kept As-Is
- `useEmployerOps.ts` — all existing hooks remain
- `employerOpsApi.ts` — all fetch functions remain
- `employerOpsConfig.ts` — thresholds unchanged
- `types/EmployerOps.ts` — existing types unchanged
- `CreateCaseDialog.tsx` — reused from Actions card
- `LogInteractionDialog.tsx` — reused from Actions card
- `GenerateLetterDialog.tsx` — reused from Actions card

### New Additions to Existing Files
- `useEmployerOps.ts` — add `useEmployerActivity(orgId)` hook (merges CRM + correspondence + cases into sorted timeline)
- `types/EmployerOps.ts` — add `ActivityEvent` type

## Data Flow

```
Page Load
    ↓
usePortalOrganizations() → orgIds[], orgNames{}     (cached, 60s refetch)
useEmployerAlerts(orgIds, orgNames) → alerts[]       (fans out DQ + case queries)
    ↓
Triage View renders alert table + all-employers list
    ↓
User clicks alert/employer or searches
    ↓
setSelectedOrgId(orgId) → Profile View renders
    ↓
Per-card hooks fire (scoped to orgId, React Query deduplicates):
  useEmployerDQScore(orgId)
  useEmployerDQIssues(orgId)
  useEmployerCases(orgId)
  useEmployerCaseSummary(orgId)
  useEmployerMemberSummary(orgId)
  useOrgContacts(orgId)
  useEmployerActivity(orgId)    ← NEW: merges interactions + correspondence + cases
    ↓
Summary cards render with metrics + deep links
Activity feed renders unified timeline
Action card enables inline operations via existing dialogs
```

## Performance Considerations

- **Virtual scrolling** on the "All Employers" list for 500+ orgs
- **Client-side search** — org list and contacts are already cached from alert aggregation
- **React Query deduplication** — clicking an org already fetched for alerts costs zero network
- **Key-based remounting** (`key={selectedOrgId}`) resets card state on employer switch
- **Activity feed assembly** — client-side merge of 3 data sources, sorted by timestamp, truncated to 10

## NoUI Alignment

This design follows the NoUI philosophy:
- **AI composes the workspace** — the alert queue surfaces what matters without staff searching for it
- **Hub, not destination** — profile cards link out to specialized views instead of recreating them
- **The workspace surfaces what matters** — severity-sorted alerts, unified activity feed, quick actions
- **Graceful degradation** — if any backend service is down, individual cards show loading/error states while others remain functional
