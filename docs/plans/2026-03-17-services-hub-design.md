# Services Hub — Design Document

**Date:** 2026-03-17
**Goal:** Transform the "Platform Health" tab into a comprehensive Services Hub with 7 functional sections covering system monitoring, data quality, audit, operations, security, issue management, and configuration.

---

## Context

The current Platform Health tab is monitoring-only — it answers "are services running?" but not "is the platform healthy?" in the broader sense required by pension administrators, auditors, and board oversight. Enterprise pension platforms organize admin capabilities into 6-9 functional domains. The NoUI platform already has significant backend capabilities (CRM audit logs with tamper detection, data quality scoring, case stats, health aggregation) that aren't surfaced in a unified admin experience.

## Architecture: Tabbed Sub-Navigation

The "Platform Health" sidebar entry becomes **"Services Hub"**. A horizontal tab bar provides navigation across 7 sections:

```
Services Hub
┌──────────┬──────────┬───────┬─────────┬──────────┬────────┬────────┐
│ Health   │ Data     │ Audit │ Metrics │ Security │ Issues │ Config │
│          │ Quality  │ Trail │         │          │        │        │
└──────────┴──────────┴───────┴─────────┴──────────┴────────┴────────┘
```

- `ServicesHub.tsx` replaces `ServiceHealthDashboard` in StaffPortal
- Internal state manages active sub-tab (default: "Health")
- Each sub-tab lazy-loads its panel component
- Existing `ServiceHealthDashboard` and `DataQualityPanel` become sub-tab panels as-is

---

## Section 1: System Health (existing — no changes)

Current `ServiceHealthDashboard` component. Live service monitoring, health cards, Recharts trends, predictive alerts, architecture layers diagram.

FeatureBurndown **moves to Config tab** (see Section 7).

## Section 2: Data Quality (existing — no changes)

Current `DataQualityPanel` component. DQ scores, check definitions, issue management with resolution workflow.

## Section 3: Audit Trail Viewer (NEW — frontend only)

**Purpose:** Browse CRM audit logs by entity, user, date range. View field-level diffs.

**Backend:** `GET /api/v1/crm/audit` already exists with immutable hash-chain logging, entity-scoped queries.

**Features:**
- Filter by entity type (Contact, Conversation, Interaction, Commitment, Outreach, Organization)
- Filter by date range (presets: 24h, 7d, 30d, 90d, Custom)
- Filter by user (agent_id text search)
- Free-text search across summary field
- Expandable entries showing full field_changes JSON diff, agent IP, device, hash chain
- CSV export of filtered results
- Cursor-based "Load More" pagination

**Components:** `AuditTrailPanel.tsx`, `AuditEntry.tsx`, `auditApi.ts`, `useAuditLog()` hook

**Scope note:** Currently covers CRM entities only. Other services can plug into the same viewer pattern in future sessions.

## Section 4: Operational Metrics (NEW — frontend only)

**Purpose:** Unified operational view of case pipeline, SLA compliance, processing trends, and commitment follow-ups.

**Backend:** All endpoints exist — `cases/stats`, `cases/stats/sla`, `cases/stats/volume`, `crm/commitments`.

**Features:**
- KPI cards: Active cases, SLA on-track %, avg processing days, DQ score
- Pipeline by stage: horizontal bars showing case distribution across 7 stages
- SLA health gauge: on-track / at-risk / breached breakdown
- Volume trend: 6-month bar chart with current month highlighted
- Commitments due: overdue / this week / upcoming counts

**Differentiation from Executive Dashboard:** Executive is leadership reporting (high-level KPIs). Metrics is operational admin (pipeline depth, bottlenecks, commitment follow-ups).

**Components:** `OperationalMetricsPanel.tsx`, pipeline/SLA/volume sub-components, `useCommitmentStats()` hook

## Section 5: Security & Access (NEW — phased)

**Purpose:** Visibility into who has access to what and security events.

### Phase A (this session — frontend only)
- Role definitions table (5 roles with portal access and key permissions)
- Access matrix visualization (role × portal grid)
- Static summary cards (role count, portal count)
- Data sourced from existing `AuthContext` type definitions

### Phase B (future session — needs backend)
- Security event log (Clerk webhook integration)
- Active session tracking
- Failed login monitoring
- See `memory/project_services_hub_phase_b.md` for full spec

**Components:** `SecurityAccessPanel.tsx`, `RoleDefinitionsTable.tsx`, `AccessMatrix.tsx`

## Section 6: Issue Management (NEW — phased)

**Purpose:** Internal defect/incident tracker with severity, assignment, and status workflow.

### Phase A (this session — frontend with demo data)
- Summary cards: open issues, critical count, avg resolution time, resolved (30d)
- Filterable issue list: status, severity, category, assigned
- Expandable issue detail with description, affected service, activity log
- Status workflow: open → triaged → in-work → resolved → closed

### Phase B (future session — needs backend)
- New `platform/issues/` service (port 8092)
- Database: `issues` + `issue_comments` tables with tenant isolation
- CRUD API + stats endpoint
- See `memory/project_services_hub_phase_b.md` for full spec

**Data model:**
```
Issue { issue_id, title, description, severity (critical|high|medium|low),
        category (defect|incident|enhancement|question),
        status (open|triaged|in-work|resolved|closed),
        affected_service, reported_by, assigned_to, resolution_note,
        created_at, updated_at, resolved_at }

IssueComment { comment_id, issue_id, author, body, created_at }
```

**Components:** `IssueManagementPanel.tsx`, `IssueRow.tsx`, `IssueDetailModal.tsx`, `issueApi.ts`

## Section 7: Configuration & Rules (NEW — frontend only)

**Purpose:** Read-only viewer for plan provisions, system parameters, and service catalog.

**Backend:** `GET /api/v1/kb/rules` already exists in knowledge base service.

**Features:**
- Plan provisions tree: expandable by domain (eligibility, benefit calc, service credit, DRO)
- System parameters table: SLA targets, DQ thresholds, contribution rates, poll intervals
- Service catalog: `FeatureBurndown` component relocated from Health tab

**Components:** `ConfigRulesPanel.tsx`, `RulesTree.tsx`, `SystemParamsTable.tsx`, `useKBRules()` hook

---

## Implementation Priority

| Priority | Section | Backend Work | Estimated Scope |
|----------|---------|-------------|-----------------|
| 1 | Hub shell + tab navigation | None | S (2-3 files) |
| 2 | Audit Trail Viewer | None (API exists) | M (5-6 files) |
| 3 | Operational Metrics | None (APIs exist) | M (4-5 files) |
| 4 | Security & Access (Phase A) | None | S (3-4 files) |
| 5 | Issue Management (Phase A) | None (demo data) | M (4-5 files) |
| 6 | Configuration & Rules | None (API exists) | M (4-5 files) |
| 7 | Health tab cleanup (move burndown) | None | S (1-2 files) |

**Total estimated scope:** L (25-30 files)

## Testing Strategy

- Each new panel gets a co-located test file
- Mock at fetch/network layer, not hooks (per project convention)
- Existing ServiceHealthDashboard and DataQualityPanel tests must not regress
- TypeScript typecheck must remain clean throughout

---

*NoUI Platform — Provaliant TPM — Confidential*
