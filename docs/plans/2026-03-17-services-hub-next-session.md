# Services Hub — Next Session Starter

## Context

The Services Hub is complete for Phase A. It replaced the "Platform Health" sidebar entry with a 7-tab admin center. All tabs are functional — three consume live backend APIs (Health, Audit Trail, Metrics), two use existing frontend data (Data Quality, Security), one uses demo data (Issues), and one mixes live API + static data (Config).

**947 tests passing, typecheck clean, production build clean.**

## What's Done

- ServicesHub shell with ARIA-compliant tab bar
- Health tab (existing ServiceHealthDashboard, FeatureBurndown removed)
- Data Quality tab (existing DataQualityPanel, unchanged)
- Audit Trail tab (CRM audit API, filters, CSV export, pagination)
- Operational Metrics tab (case stats, SLA, volume, commitments)
- Security & Access tab (role definitions, access matrix from auth types)
- Issue Management tab (demo data, 4 filters, expandable detail)
- Configuration & Rules tab (KB rules API, system params, FeatureBurndown)

## Phase B — Backend Work Needed

### 1. Security Events Service (Priority: High)

**Why:** Pension systems require NIST SP 800-53 AC-2 (Account Management) and AU-6 (Audit Review) compliance. Currently no visibility into login events, role changes, or session management.

**What:**
- Clerk webhook integration for authentication events (login success/failure, role changes)
- New tables or extend CRM audit for security-specific events
- Active session tracking
- Wire into SecurityAccessPanel to replace Phase B placeholder cards

**Scope:** Medium — Clerk webhook setup + new API endpoint + frontend wiring

### 2. Issue Management Service (Priority: Medium)

**Why:** Currently demo data only. Need structured defect/incident tracking for production.

**What:**
- New `platform/issues/` service (port 8092)
- PostgreSQL tables: `issues` + `issue_comments` with tenant isolation
- CRUD API + stats endpoint
- Status workflow: open → triaged → in-work → resolved → closed
- Replace demo data in `IssueManagementPanel` with live API calls

**Scope:** Large — new Go service, DB migration, API client, hooks, panel rewiring

**Design spec:** See `memory/project_services_hub_phase_b.md` for full details.

## Other High-Value Next Steps

### Visual Polish
- The tab bar clips "Issues" and "Config" labels on narrow viewports — consider responsive behavior or icon-only mode at small widths
- The Metrics tab shows "-" for all KPIs when backend isn't running — could add a graceful "Backend services unavailable" banner like the Health tab does

### Audit Trail Enhancements
- Backend: Add date range query params to `GET /api/v1/crm/audit` so filtering happens server-side instead of client-side
- Backend: Add `agent_id` query param for server-side agent filtering
- Cross-service audit: Extend audit viewer to consume logs from case management, correspondence, etc.

### Integration Testing
- With Docker stack running, verify all 7 tabs show live data end-to-end
- Verify CSV export produces valid output with real audit entries

## Quick Start

```bash
# Verify build state
cd frontend && npx tsc --noEmit && npm run build && npx vitest run

# Visual verification
cd frontend && npx vite  # then navigate to Services Hub tab

# Key files
frontend/src/components/admin/ServicesHub.tsx          # Shell
frontend/src/components/admin/AuditTrailPanel.tsx      # Audit
frontend/src/components/admin/OperationalMetricsPanel.tsx  # Metrics
frontend/src/components/admin/SecurityAccessPanel.tsx   # Security
frontend/src/components/admin/IssueManagementPanel.tsx  # Issues
frontend/src/components/admin/ConfigRulesPanel.tsx      # Config
```
