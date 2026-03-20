# Employer Operations Agent Desktop — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a staff-facing two-panel operational desktop that aggregates all 13 Phase 8 cross-service employer endpoints into an alert-first → org-detail workspace.

**Architecture:** Two-panel layout (CRM-style): left panel shows prioritized alert queue + org list; right panel shows org banner + 5 tabbed detail views (Health, Cases, CRM, Correspondence, Members). All write actions (create case, log interaction, generate letter) are inline modal dialogs. Build-time configurable alert thresholds via Vite env vars.

**Tech Stack:** React + TypeScript, @tanstack/react-query, existing design system (`C`, `BODY` from `lib/designSystem.ts`), existing `apiClient.ts` fetch helpers.

**Design doc:** `docs/plans/2026-03-19-employer-ops-desktop-design.md`

---

## Important: Vite Proxy Routing

Phase 8 endpoints on dataaccess (port 8081) and casemanagement (port 8088) use `/api/v1/employer/{orgId}/members` and `/api/v1/employer/{orgId}/cases` paths respectively. The current Vite proxy routes ALL `/api/v1/employer` to port 8094 (employer-portal). Task 2 fixes this with a custom Vite plugin that intercepts these specific paths before the catch-all.

**Endpoint → Service routing:**
- `/api/v1/employer/{orgId}/members*` → 8081 (dataaccess)
- `/api/v1/employer/{orgId}/cases*` and `/api/v1/employer/cases` → 8088 (casemanagement)
- `/api/v1/dq/employer/*` → 8086 (dataquality) — already correct via `/api/v1/dq` proxy
- `/api/v1/crm/organizations/*` → 8084 (crm) — already correct via `/api/v1/crm` proxy
- `/api/v1/correspondence/*` → 8085 (correspondence) — already correct via `/api/v1/correspondence` proxy
- Everything else under `/api/v1/employer/*` → 8094 (employer-portal) — existing catch-all

---

## Task 1: Types + Config (foundation)

**Files:**
- Create: `frontend/src/types/EmployerOps.ts`
- Create: `frontend/src/lib/employerOpsConfig.ts`

**Step 1: Create TypeScript types for all 13 Phase 8 response shapes**

```typescript
// frontend/src/types/EmployerOps.ts

// ── Data Access (port 8081) ────────────────────────────────────────────────

export interface EmployerRosterMember {
  memberId: number;
  firstName: string;
  lastName: string;
  tier: number;
  dept: string;
  status: string;
}

export interface EmployerMemberSummary {
  org_id: string;
  total_members: number;
  active_count: number;
  retired_count: number;
  terminated_count: number;
  deferred_count: number;
  tier1_count: number;
  tier2_count: number;
  tier3_count: number;
}

// ── Data Quality (port 8086) ───────────────────────────────────────────────

export interface EmployerDQScore {
  overallScore: number;
  totalChecks: number;
  passingChecks: number;
  openIssues: number;
  criticalIssues: number;
  categoryScores: Record<string, number>;
  lastRunAt: string | null;
}

export interface EmployerDQIssue {
  issueId: string;
  resultId: string;
  checkId: string;
  tenantId: string;
  severity: string;
  recordTable: string;
  recordId: string;
  fieldName: string | null;
  currentValue: string | null;
  expectedPattern: string | null;
  description: string;
  status: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployerDQCheckResult {
  resultId: string;
  checkId: string;
  tenantId: string;
  runAt: string;
  recordsChecked: number;
  recordsPassed: number;
  recordsFailed: number;
  passRate: number;
  status: string;
  durationMs: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface EmployerDQCheck {
  checkId: string;
  tenantId: string;
  checkName: string;
  checkCode: string;
  description: string | null;
  category: string;
  severity: string;
  targetTable: string;
  checkQuery: string | null;
  threshold: number | null;
  isActive: boolean;
  schedule: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  latestResult: EmployerDQCheckResult | null;
}

// ── CRM (port 8083/8084) ──────────────────────────────────────────────────
// Reuse existing Interaction and Contact types from @/types/CRM
// Only define the create request payload here

export interface CreateEmployerInteractionRequest {
  orgId: string;
  channel: string;
  interactionType: string;
  direction: string;
  category: string;
  subcategory?: string | null;
  outcome: string;
  summary: string;
  contactId?: string;
  agentId?: string;
  conversationId?: string;
  startedAt?: string;
  visibility?: string;
}

export const EMPLOYER_INTERACTION_CATEGORIES = [
  'CONTRIBUTION_QUESTION',
  'ENROLLMENT_ISSUE',
  'TERMINATION_INQUIRY',
  'WARET_INQUIRY',
  'SCP_INQUIRY',
  'GENERAL_EMPLOYER',
] as const;

// ── Correspondence (port 8085) ─────────────────────────────────────────────
// Reuse existing Template and Correspondence types from existing types
// Only define the generate request here

export interface GenerateEmployerLetterRequest {
  templateId: string;
  orgId: string;
  contactId?: string;
  mergeData?: Record<string, string>;
}

// ── Case Management (port 8088) ────────────────────────────────────────────

export interface EmployerCaseSummary {
  orgId: string;
  totalCases: number;
  activeCases: number;
  completedCases: number;
  atRiskCases: number;
}

export interface CreateEmployerCaseRequest {
  employerOrgId: string;
  triggerType: string;
  triggerReferenceId: string;
  memberId?: number;
  priority?: string;
  assignedTo?: string;
}

export const EMPLOYER_TRIGGER_TYPES = [
  'ENROLLMENT_SUBMITTED',
  'TERMINATION_CERTIFIED',
  'CONTRIBUTION_EXCEPTION',
  'WARET_DESIGNATION',
  'SCP_APPLICATION',
] as const;

// ── Alert Queue (frontend-only) ────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface EmployerAlert {
  orgId: string;
  orgName: string;
  type: 'dq_score' | 'dq_issues' | 'sla_breach' | 'case_volume';
  severity: AlertSeverity;
  message: string;
  value: number;
}

export type EmployerOpsTab = 'health' | 'cases' | 'crm' | 'correspondence' | 'members';
```

**Step 2: Create build-time config**

```typescript
// frontend/src/lib/employerOpsConfig.ts
export const OPS_THRESHOLDS = {
  dqScoreCritical: Number(import.meta.env.VITE_DQ_SCORE_CRITICAL ?? 60),
  dqScoreWarning: Number(import.meta.env.VITE_DQ_SCORE_WARNING ?? 80),
  slaOverdueWarning: Number(import.meta.env.VITE_SLA_OVERDUE_WARNING ?? 1),
  caseVolumeWarning: Number(import.meta.env.VITE_CASE_VOLUME_WARNING ?? 10),
} as const;
```

**Step 3: Verify typecheck passes**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (no errors — new files are standalone)

**Step 4: Commit**

```bash
git add frontend/src/types/EmployerOps.ts frontend/src/lib/employerOpsConfig.ts
git commit -m "[frontend] Add Employer Ops types and build-time config"
```

---

## Task 2: Vite Proxy Fix + API Client

**Files:**
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/lib/employerOpsApi.ts`

**Step 1: Add custom Vite plugin for Phase 8 employer route proxying**

In `vite.config.ts`, add a plugin BEFORE `react()` that intercepts `/api/v1/employer/{orgId}/members` and `/api/v1/employer/{orgId}/cases` requests and proxies them to the correct backend services (8081 and 8088 respectively), before the catch-all `/api/v1/employer` → 8094 proxy handles them.

```typescript
// Add at top of vite.config.ts:
import http from 'node:http';

// Add to plugins array, BEFORE react():
{
  name: 'employer-cross-service-proxy',
  configureServer(server) {
    // Phase 8 cross-service endpoints live on different backends than
    // the employer-portal catch-all (8094). Route them correctly.
    server.middlewares.use((req, res, next) => {
      const url = req.url ?? '';
      let target: string | null = null;

      if (/^\/api\/v1\/employer\/[^/]+\/members/.test(url)) {
        target = 'http://localhost:8081'; // dataaccess
      } else if (/^\/api\/v1\/employer\/[^/]+\/cases/.test(url) ||
                 /^\/api\/v1\/employer\/cases$/.test(url)) {
        target = 'http://localhost:8088'; // casemanagement
      }

      if (!target) return next();

      const proxyReq = http.request(
        target + url,
        { method: req.method, headers: { ...req.headers, host: new URL(target).host } },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode!, proxyRes.headers);
          proxyRes.pipe(res);
        },
      );
      proxyReq.on('error', () => {
        res.writeHead(502);
        res.end('Proxy error');
      });
      req.pipe(proxyReq);
    });
  },
},
```

**Step 2: Create API client functions for all 13 endpoints**

```typescript
// frontend/src/lib/employerOpsApi.ts
import { fetchAPI, fetchPaginatedAPI, postAPI, toQueryString } from './apiClient';
import type { PaginatedResult } from './apiClient';
import type {
  EmployerRosterMember,
  EmployerMemberSummary,
  EmployerDQScore,
  EmployerDQIssue,
  EmployerDQCheck,
  EmployerCaseSummary,
  CreateEmployerCaseRequest,
  CreateEmployerInteractionRequest,
  GenerateEmployerLetterRequest,
} from '@/types/EmployerOps';
// Reuse existing CRM/Case/Correspondence types
import type { Interaction, Contact } from '@/types/CRM';
import type { RetirementCase } from '@/types/CaseManagement';
import type { Template, Correspondence } from '@/types/Correspondence';

// ── Data Access ────────────────────────────────────────────────────────────

export function fetchEmployerRoster(
  orgId: string,
  opts?: { limit?: number; offset?: number },
): Promise<PaginatedResult<EmployerRosterMember>> {
  const qs = toQueryString({ limit: opts?.limit ?? 25, offset: opts?.offset ?? 0 });
  return fetchPaginatedAPI(`/api/v1/employer/${orgId}/members${qs}`);
}

export function fetchEmployerMemberSummary(orgId: string): Promise<EmployerMemberSummary> {
  return fetchAPI(`/api/v1/employer/${orgId}/members/summary`);
}

// ── Data Quality ───────────────────────────────────────────────────────────

export function fetchEmployerDQScore(orgId: string): Promise<EmployerDQScore> {
  return fetchAPI(`/api/v1/dq/employer/${orgId}/score`);
}

export function fetchEmployerDQIssues(
  orgId: string,
  opts?: { severity?: string; status?: string; limit?: number; offset?: number },
): Promise<PaginatedResult<EmployerDQIssue>> {
  const qs = toQueryString({
    severity: opts?.severity,
    status: opts?.status,
    limit: opts?.limit ?? 25,
    offset: opts?.offset ?? 0,
  });
  return fetchPaginatedAPI(`/api/v1/dq/employer/${orgId}/issues${qs}`);
}

export function fetchEmployerDQChecks(
  orgId: string,
  opts?: { limit?: number; offset?: number },
): Promise<PaginatedResult<EmployerDQCheck>> {
  const qs = toQueryString({ limit: opts?.limit ?? 25, offset: opts?.offset ?? 0 });
  return fetchPaginatedAPI(`/api/v1/dq/employer/${orgId}/checks${qs}`);
}

// ── CRM ────────────────────────────────────────────────────────────────────

export function fetchOrgInteractions(
  orgId: string,
  opts?: { category?: string; limit?: number; offset?: number },
): Promise<PaginatedResult<Interaction>> {
  const qs = toQueryString({
    category: opts?.category,
    limit: opts?.limit ?? 25,
    offset: opts?.offset ?? 0,
  });
  return fetchPaginatedAPI(`/api/v1/crm/organizations/${orgId}/interactions${qs}`);
}

export function fetchOrgContacts(
  orgId: string,
  opts?: { limit?: number; offset?: number },
): Promise<PaginatedResult<Contact>> {
  const qs = toQueryString({ limit: opts?.limit ?? 25, offset: opts?.offset ?? 0 });
  return fetchPaginatedAPI(`/api/v1/crm/organizations/${orgId}/contacts${qs}`);
}

export function createEmployerInteraction(req: CreateEmployerInteractionRequest): Promise<Interaction> {
  return postAPI('/api/v1/crm/interactions/employer', req);
}

// ── Correspondence ─────────────────────────────────────────────────────────

export function fetchEmployerTemplates(
  opts?: { limit?: number; offset?: number },
): Promise<PaginatedResult<Template>> {
  const qs = toQueryString({ limit: opts?.limit ?? 25, offset: opts?.offset ?? 0 });
  return fetchPaginatedAPI(`/api/v1/correspondence/templates/employer${qs}`);
}

export function generateEmployerLetter(req: GenerateEmployerLetterRequest): Promise<Correspondence> {
  return postAPI('/api/v1/correspondence/generate/employer', req);
}

// ── Case Management ────────────────────────────────────────────────────────

export function fetchEmployerCases(
  orgId: string,
  opts?: { limit?: number; offset?: number },
): Promise<PaginatedResult<RetirementCase>> {
  const qs = toQueryString({ limit: opts?.limit ?? 25, offset: opts?.offset ?? 0 });
  return fetchPaginatedAPI(`/api/v1/employer/${orgId}/cases${qs}`);
}

export function fetchEmployerCaseSummary(orgId: string): Promise<EmployerCaseSummary> {
  return fetchAPI(`/api/v1/employer/${orgId}/cases/summary`);
}

export function createEmployerCase(req: CreateEmployerCaseRequest): Promise<RetirementCase> {
  return postAPI('/api/v1/employer/cases', req);
}
```

**Step 3: Verify typecheck passes**

Run: `cd frontend && npx tsc --noEmit`

Expected: PASS. If CRM/Case/Correspondence types don't export what we need, adjust the imports to match actual exported type names. Check:
- `frontend/src/types/CRM.ts` for `Interaction`, `Contact`
- `frontend/src/types/CaseManagement.ts` for `RetirementCase`
- `frontend/src/types/Correspondence.ts` for `Template`, `Correspondence`

**Step 4: Commit**

```bash
git add frontend/vite.config.ts frontend/src/lib/employerOpsApi.ts
git commit -m "[frontend] Add Employer Ops API client + Vite proxy routing fix"
```

---

## Task 3: React Query Hooks

**Files:**
- Create: `frontend/src/hooks/useEmployerOps.ts`

**Step 1: Create hooks for all 13 endpoints + alert aggregation**

Follow the project pattern from existing hooks (e.g., `useAuditLog.ts`, `useCaseManagement.ts`):
- `useQuery` for GET endpoints, `useMutation` for POST endpoints
- Query keys namespaced as `['employer-ops', endpoint-name, orgId]`
- `enabled: !!orgId` to prevent fetching with empty orgId
- `useQueries` for the alert fan-out (fetch DQ score + case summary for all orgs)
- 60-second `refetchInterval` on alert-generating queries only
- `useMutation` hooks should invalidate relevant queries on success

```typescript
// frontend/src/hooks/useEmployerOps.ts
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchEmployerRoster, fetchEmployerMemberSummary,
  fetchEmployerDQScore, fetchEmployerDQIssues, fetchEmployerDQChecks,
  fetchOrgInteractions, fetchOrgContacts, createEmployerInteraction,
  fetchEmployerTemplates, generateEmployerLetter,
  fetchEmployerCases, fetchEmployerCaseSummary, createEmployerCase,
} from '@/lib/employerOpsApi';
import { OPS_THRESHOLDS } from '@/lib/employerOpsConfig';
import type { EmployerAlert, AlertSeverity } from '@/types/EmployerOps';

const ALERT_REFETCH_MS = 60_000;

// ── Single-org hooks ───────────────────────────────────────────────────────

export function useEmployerRoster(orgId: string, limit = 25, offset = 0) {
  return useQuery({
    queryKey: ['employer-ops', 'roster', orgId, limit, offset],
    queryFn: () => fetchEmployerRoster(orgId, { limit, offset }),
    enabled: !!orgId,
  });
}

export function useEmployerMemberSummary(orgId: string) {
  return useQuery({
    queryKey: ['employer-ops', 'member-summary', orgId],
    queryFn: () => fetchEmployerMemberSummary(orgId),
    enabled: !!orgId,
  });
}

export function useEmployerDQScore(orgId: string) {
  return useQuery({
    queryKey: ['employer-ops', 'dq-score', orgId],
    queryFn: () => fetchEmployerDQScore(orgId),
    enabled: !!orgId,
  });
}

export function useEmployerDQIssues(orgId: string, opts?: { severity?: string; status?: string }) {
  return useQuery({
    queryKey: ['employer-ops', 'dq-issues', orgId, opts],
    queryFn: () => fetchEmployerDQIssues(orgId, opts),
    enabled: !!orgId,
  });
}

export function useEmployerDQChecks(orgId: string) {
  return useQuery({
    queryKey: ['employer-ops', 'dq-checks', orgId],
    queryFn: () => fetchEmployerDQChecks(orgId),
    enabled: !!orgId,
  });
}

export function useOrgInteractions(orgId: string, category?: string) {
  return useQuery({
    queryKey: ['employer-ops', 'interactions', orgId, category],
    queryFn: () => fetchOrgInteractions(orgId, { category }),
    enabled: !!orgId,
  });
}

export function useOrgContacts(orgId: string) {
  return useQuery({
    queryKey: ['employer-ops', 'contacts', orgId],
    queryFn: () => fetchOrgContacts(orgId),
    enabled: !!orgId,
  });
}

export function useEmployerTemplates() {
  return useQuery({
    queryKey: ['employer-ops', 'templates'],
    queryFn: () => fetchEmployerTemplates(),
  });
}

export function useEmployerCases(orgId: string) {
  return useQuery({
    queryKey: ['employer-ops', 'cases', orgId],
    queryFn: () => fetchEmployerCases(orgId),
    enabled: !!orgId,
  });
}

export function useEmployerCaseSummary(orgId: string) {
  return useQuery({
    queryKey: ['employer-ops', 'case-summary', orgId],
    queryFn: () => fetchEmployerCaseSummary(orgId),
    enabled: !!orgId,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function useCreateEmployerInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createEmployerInteraction,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['employer-ops', 'interactions', vars.orgId] });
    },
  });
}

export function useGenerateEmployerLetter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: generateEmployerLetter,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employer-ops', 'templates'] });
    },
  });
}

export function useCreateEmployerCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createEmployerCase,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['employer-ops', 'cases', vars.employerOrgId] });
      qc.invalidateQueries({ queryKey: ['employer-ops', 'case-summary', vars.employerOrgId] });
    },
  });
}

// ── Alert aggregation ──────────────────────────────────────────────────────

export function useEmployerAlerts(orgIds: string[], orgNames: Record<string, string>) {
  // Fan out DQ score + case summary queries for all orgs
  const dqQueries = useQueries({
    queries: orgIds.map((orgId) => ({
      queryKey: ['employer-ops', 'dq-score', orgId],
      queryFn: () => fetchEmployerDQScore(orgId),
      refetchInterval: ALERT_REFETCH_MS,
    })),
  });

  const caseQueries = useQueries({
    queries: orgIds.map((orgId) => ({
      queryKey: ['employer-ops', 'case-summary', orgId],
      queryFn: () => fetchEmployerCaseSummary(orgId),
      refetchInterval: ALERT_REFETCH_MS,
    })),
  });

  const alerts: EmployerAlert[] = [];

  orgIds.forEach((orgId, i) => {
    const dq = dqQueries[i]?.data;
    const cs = caseQueries[i]?.data;
    const name = orgNames[orgId] ?? orgId;

    if (dq) {
      if (dq.overallScore < OPS_THRESHOLDS.dqScoreCritical) {
        alerts.push({ orgId, orgName: name, type: 'dq_score', severity: 'critical', message: `DQ Score: ${dq.overallScore}`, value: dq.overallScore });
      } else if (dq.overallScore < OPS_THRESHOLDS.dqScoreWarning) {
        alerts.push({ orgId, orgName: name, type: 'dq_score', severity: 'warning', message: `DQ Score: ${dq.overallScore}`, value: dq.overallScore });
      }
      if (dq.openIssues > 0) {
        alerts.push({ orgId, orgName: name, type: 'dq_issues', severity: dq.criticalIssues > 0 ? 'critical' : 'warning', message: `${dq.openIssues} open issues`, value: dq.openIssues });
      }
    }

    if (cs) {
      if (cs.atRiskCases >= OPS_THRESHOLDS.slaOverdueWarning) {
        alerts.push({ orgId, orgName: name, type: 'sla_breach', severity: 'warning', message: `${cs.atRiskCases} at-risk cases`, value: cs.atRiskCases });
      }
      if (cs.activeCases >= OPS_THRESHOLDS.caseVolumeWarning) {
        alerts.push({ orgId, orgName: name, type: 'case_volume', severity: 'info', message: `${cs.activeCases} active cases`, value: cs.activeCases });
      }
    }
  });

  // Sort: critical first, then warning, then info
  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity] || a.orgName.localeCompare(b.orgName));

  const isLoading = dqQueries.some((q) => q.isLoading) || caseQueries.some((q) => q.isLoading);

  return { alerts, isLoading };
}
```

**Step 2: Verify typecheck passes**

Run: `cd frontend && npx tsc --noEmit`

Expected: PASS. Adjust any type imports if the existing CRM/Case/Correspondence type files use different export names.

**Step 3: Commit**

```bash
git add frontend/src/hooks/useEmployerOps.ts
git commit -m "[frontend] Add Employer Ops React Query hooks + alert aggregation"
```

---

## Task 4: Navigation Integration

**Files:**
- Modify: `frontend/src/types/auth.ts`
- Modify: `frontend/src/App.tsx`

**Step 1: Add `employer-ops` ViewMode**

In `frontend/src/types/auth.ts`:
- Add `'employer-ops'` to the `ViewMode` union type
- Add `'employer-ops'` to the `admin` and `staff` entries in `ROLE_ACCESS`
- Do NOT add it to `member`, `employer`, or `vendor` roles

**Step 2: Add lazy import, TopNav entry, and view-mode case in App.tsx**

In `frontend/src/App.tsx`:
- Add lazy import: `const EmployerOpsDesktop = lazy(() => import('@/components/employer-ops/EmployerOpsDesktop'));`
- Add to the `tabs` array in `TopNav`: `{ key: 'employer-ops', label: 'Employer Ops', description: 'Employer operations & monitoring' }` — position it after the `employer` entry
- Add a `case 'employer-ops':` in the view-mode rendering switch that renders `<EmployerOpsDesktop />`

**Step 3: Verify typecheck passes (will fail until component exists)**

This task should be committed together with Task 5 (container component) to avoid a broken intermediate state. Skip typecheck here — verify after Task 5.

---

## Task 5: Container Component + Empty Shell

**Files:**
- Create: `frontend/src/components/employer-ops/EmployerOpsDesktop.tsx`

**Step 1: Create the two-panel container**

```typescript
// frontend/src/components/employer-ops/EmployerOpsDesktop.tsx
import { useState } from 'react';
import { usePortalOrganizations } from '@/hooks/useCRM';
import { useEmployerAlerts } from '@/hooks/useEmployerOps';
import { C, BODY, DISPLAY } from '@/lib/designSystem';
import type { EmployerOpsTab } from '@/types/EmployerOps';

export default function EmployerOpsDesktop() {
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [activeTab, setActiveTab] = useState<EmployerOpsTab>('health');

  const { data: organizations } = usePortalOrganizations();
  const orgList = organizations ?? [];
  const orgNames = Object.fromEntries(orgList.map((o) => [o.orgId, o.name]));
  const orgIds = orgList.map((o) => o.orgId);
  const { alerts, isLoading: alertsLoading } = useEmployerAlerts(orgIds, orgNames);

  // Count alerts per org for badges
  const alertCounts: Record<string, number> = {};
  for (const a of alerts) alertCounts[a.orgId] = (alertCounts[a.orgId] ?? 0) + 1;

  return (
    <div style={{ display: 'flex', fontFamily: BODY, background: C.pageBg, color: C.text, minHeight: '100vh' }}>
      {/* Left panel — Alert Queue */}
      <div style={{
        width: 280, minWidth: 280, borderRight: `1px solid ${C.border}`,
        background: C.cardBg, overflowY: 'auto',
      }}>
        <div style={{ padding: '20px 16px 12px', fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, color: C.navy }}>
          Employer Ops
        </div>

        {/* Alerts section */}
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: C.textTertiary, padding: '8px 4px' }}>
            Alerts ({alerts.length})
          </div>
          {alertsLoading && <div style={{ padding: 8, color: C.textTertiary, fontSize: 13 }}>Loading...</div>}
          {alerts.map((a, i) => (
            <div
              key={`${a.orgId}-${a.type}-${i}`}
              onClick={() => setSelectedOrgId(a.orgId)}
              style={{
                padding: '8px 10px', marginBottom: 4, borderRadius: 6, cursor: 'pointer',
                background: selectedOrgId === a.orgId ? C.sageLight : 'transparent',
                borderLeft: `3px solid ${a.severity === 'critical' ? C.coral : a.severity === 'warning' ? C.gold : C.sky}`,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{a.orgName}</div>
              <div style={{ fontSize: 12, color: C.textSecondary }}>{a.message}</div>
            </div>
          ))}
        </div>

        {/* Org list section */}
        <div style={{ padding: '0 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: C.textTertiary, padding: '8px 4px', borderTop: `1px solid ${C.borderLight}` }}>
            All Employers
          </div>
          {orgList.map((org) => (
            <div
              key={org.orgId}
              onClick={() => setSelectedOrgId(org.orgId)}
              style={{
                padding: '6px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: selectedOrgId === org.orgId ? C.sageLight : 'transparent',
                fontSize: 13,
              }}
            >
              <span style={{ color: C.text }}>{org.name}</span>
              {(alertCounts[org.orgId] ?? 0) > 0 && (
                <span style={{
                  background: C.coralMuted, color: C.coral, borderRadius: 10,
                  padding: '1px 7px', fontSize: 11, fontWeight: 600,
                }}>
                  {alertCounts[org.orgId]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — Org Detail */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {selectedOrgId ? (
          <div>
            {/* OrgBanner + tabs rendered here — Tasks 7-12 */}
            <div style={{ padding: 24, color: C.textSecondary }}>
              Org detail: {orgNames[selectedOrgId] ?? selectedOrgId} — Tab: {activeTab}
            </div>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, padding: '0 24px' }}>
              {(['health', 'cases', 'crm', 'correspondence', 'members'] as EmployerOpsTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '10px 18px', fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
                    color: activeTab === tab ? C.navy : C.textSecondary,
                    borderBottom: activeTab === tab ? `2px solid ${C.sage}` : '2px solid transparent',
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: BODY,
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            {/* Tab content placeholder — replaced in Tasks 8-12 */}
            <div style={{ padding: 24 }}>
              <div style={{ color: C.textTertiary }}>Tab content for "{activeTab}" goes here</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.textTertiary }}>
            Select an employer from the left panel
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify typecheck and build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: PASS

**Step 3: Commit (Tasks 4 + 5 together)**

```bash
git add frontend/src/types/auth.ts frontend/src/App.tsx frontend/src/components/employer-ops/EmployerOpsDesktop.tsx
git commit -m "[frontend] Add Employer Ops Desktop shell with nav integration + alert queue"
```

---

## Task 6: Org Banner

**Files:**
- Create: `frontend/src/components/employer-ops/OrgBanner.tsx`
- Modify: `frontend/src/components/employer-ops/EmployerOpsDesktop.tsx`

**Step 1: Create org banner component**

Displays org name, EIN, active member count, DQ score, and status. Uses `usePortalOrganization`, `useEmployerDQScore`, and `useEmployerMemberSummary` hooks.

Design: horizontal strip with navy background (like the existing `OrgBanner` in employer-portal but adapted for ops context). Show DQ score with color coding based on thresholds.

**Step 2: Wire into EmployerOpsDesktop**

Replace the placeholder `<div>Org detail: ...</div>` with `<OrgBanner orgId={selectedOrgId} />`.

**Step 3: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add frontend/src/components/employer-ops/OrgBanner.tsx frontend/src/components/employer-ops/EmployerOpsDesktop.tsx
git commit -m "[frontend] Add Employer Ops org banner with DQ score indicator"
```

---

## Task 7: Health Tab

**Files:**
- Create: `frontend/src/components/employer-ops/tabs/HealthTab.tsx`
- Modify: `frontend/src/components/employer-ops/EmployerOpsDesktop.tsx`

**Step 1: Create HealthTab component**

Three sections:
1. **DQ Score gauge** — large number display with color coding + category scores breakdown. Uses `useEmployerDQScore(orgId)`.
2. **Issues table** — sortable table of open DQ issues (severity, table, description, created date). Uses `useEmployerDQIssues(orgId)`. Each row has a "Create Case" button (wires to `useCreateEmployerCase` with `triggerType: 'CONTRIBUTION_EXCEPTION'` and `triggerReferenceId: issueId`).
3. **Check results** — list of DQ checks with latest result (pass rate, records checked/failed). Uses `useEmployerDQChecks(orgId)`.

**Step 2: Wire into EmployerOpsDesktop tab content**

Replace the tab content placeholder with conditional rendering:
```typescript
{activeTab === 'health' && <HealthTab orgId={selectedOrgId} />}
```

**Step 3: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add frontend/src/components/employer-ops/tabs/HealthTab.tsx frontend/src/components/employer-ops/EmployerOpsDesktop.tsx
git commit -m "[frontend] Add Health tab — DQ score, issues table, check results"
```

---

## Task 8: Cases Tab + Create Case Dialog

**Files:**
- Create: `frontend/src/components/employer-ops/tabs/CasesTab.tsx`
- Create: `frontend/src/components/employer-ops/actions/CreateCaseDialog.tsx`
- Modify: `frontend/src/components/employer-ops/EmployerOpsDesktop.tsx`

**Step 1: Create CasesTab component**

Three sections:
1. **Summary cards** — 4 cards showing total, active, completed, at-risk case counts. Uses `useEmployerCaseSummary(orgId)`.
2. **Case table** — table of cases (type, status, priority, SLA, stage, assigned, days open). Uses `useEmployerCases(orgId)`. Color-code SLA status.
3. **"New Case" button** in header → opens `CreateCaseDialog`.

**Step 2: Create CreateCaseDialog component**

Modal dialog with:
- Trigger type dropdown (5 options from `EMPLOYER_TRIGGER_TYPES`)
- Trigger reference ID input
- Optional member ID input
- Optional priority selector (standard/high/urgent)
- Optional assigned-to input
- Submit button → `useCreateEmployerCase` mutation
- On success: close dialog, show success state

**Step 3: Wire CasesTab into EmployerOpsDesktop**

```typescript
{activeTab === 'cases' && <CasesTab orgId={selectedOrgId} />}
```

**Step 4: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add frontend/src/components/employer-ops/tabs/CasesTab.tsx frontend/src/components/employer-ops/actions/CreateCaseDialog.tsx frontend/src/components/employer-ops/EmployerOpsDesktop.tsx
git commit -m "[frontend] Add Cases tab + create case dialog with trigger types"
```

---

## Task 9: CRM Tab + Log Interaction Dialog

**Files:**
- Create: `frontend/src/components/employer-ops/tabs/CRMTab.tsx`
- Create: `frontend/src/components/employer-ops/actions/LogInteractionDialog.tsx`
- Modify: `frontend/src/components/employer-ops/EmployerOpsDesktop.tsx`

**Step 1: Create CRMTab component**

Two sections:
1. **Interaction timeline** — reverse-chronological list of org interactions (category, channel, summary, date, agent). Uses `useOrgInteractions(orgId)`. Optional category filter dropdown.
2. **Contact list** — table of org contacts with role, email, phone, title. Uses `useOrgContacts(orgId)`.

Header has "Log Interaction" button → opens `LogInteractionDialog`.

**Step 2: Create LogInteractionDialog component**

Modal dialog with:
- Category dropdown (6 options from `EMPLOYER_INTERACTION_CATEGORIES`)
- Channel dropdown (phone_inbound, phone_outbound, email_inbound, etc.)
- Direction (inbound/outbound)
- Summary textarea
- Outcome dropdown (resolved, pending, escalated)
- Optional contact selector (populated from org contacts)
- Submit button → `useCreateEmployerInteraction` mutation

**Step 3: Wire CRMTab into EmployerOpsDesktop**

```typescript
{activeTab === 'crm' && <CRMTab orgId={selectedOrgId} />}
```

**Step 4: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add frontend/src/components/employer-ops/tabs/CRMTab.tsx frontend/src/components/employer-ops/actions/LogInteractionDialog.tsx frontend/src/components/employer-ops/EmployerOpsDesktop.tsx
git commit -m "[frontend] Add CRM tab — interaction timeline, contacts, log interaction"
```

---

## Task 10: Correspondence Tab + Generate Letter Dialog

**Files:**
- Create: `frontend/src/components/employer-ops/tabs/CorrespondenceTab.tsx`
- Create: `frontend/src/components/employer-ops/actions/GenerateLetterDialog.tsx`
- Modify: `frontend/src/components/employer-ops/EmployerOpsDesktop.tsx`

**Step 1: Create CorrespondenceTab component**

Shows employer templates as a card grid. Each card shows template name, description, category, merge field count. "Generate" button on each card → opens `GenerateLetterDialog` pre-filled with that template.

Uses `useEmployerTemplates()`.

**Step 2: Create GenerateLetterDialog component**

Modal dialog with:
- Template name (read-only, from selected template)
- Org ID (pre-filled from selected org)
- Optional contact selector
- Merge data fields — dynamically rendered inputs based on the template's `mergeFields` array (7 auto-populated org fields are pre-filled, additional fields are editable)
- Preview button → shows rendered `bodyRendered` after generation
- Submit button → `useGenerateEmployerLetter` mutation

**Step 3: Wire CorrespondenceTab into EmployerOpsDesktop**

```typescript
{activeTab === 'correspondence' && <CorrespondenceTab orgId={selectedOrgId} />}
```

**Step 4: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add frontend/src/components/employer-ops/tabs/CorrespondenceTab.tsx frontend/src/components/employer-ops/actions/GenerateLetterDialog.tsx frontend/src/components/employer-ops/EmployerOpsDesktop.tsx
git commit -m "[frontend] Add Correspondence tab — template cards, letter generation"
```

---

## Task 11: Members Tab

**Files:**
- Create: `frontend/src/components/employer-ops/tabs/MembersTab.tsx`
- Modify: `frontend/src/components/employer-ops/EmployerOpsDesktop.tsx`

**Step 1: Create MembersTab component**

Two sections:
1. **Summary cards** — 4 cards showing tier breakdown (Tier 1/2/3 counts) and status breakdown (active/retired/terminated/deferred). Uses `useEmployerMemberSummary(orgId)`.
2. **Roster table** — paginated table of members (ID, name, tier, dept, status). Uses `useEmployerRoster(orgId, limit, offset)`. Pagination controls at bottom.

This tab is view-only — no action buttons.

**Step 2: Wire MembersTab into EmployerOpsDesktop**

```typescript
{activeTab === 'members' && <MembersTab orgId={selectedOrgId} />}
```

**Step 3: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add frontend/src/components/employer-ops/tabs/MembersTab.tsx frontend/src/components/employer-ops/EmployerOpsDesktop.tsx
git commit -m "[frontend] Add Members tab — tier/status summary + paginated roster"
```

---

## Task 12: Final Build Verification + Cleanup

**Files:**
- Modify: various (only if fixes needed)

**Step 1: Full typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS with zero errors

**Step 2: Build**

Run: `cd frontend && npm run build`
Expected: PASS — clean production build

**Step 3: Run existing tests**

Run: `cd frontend && npm test -- --run`
Expected: All existing tests PASS, zero regressions

**Step 4: Visual verification**

If Docker services are running, navigate to the Employer Ops tab in the browser and verify:
- Alert queue renders (may show empty if no mock data)
- Org list populates from CRM
- Clicking an org shows the detail view with all 5 tabs
- Tab switching works
- Action dialogs open and close

**Step 5: Final commit if any fixes were needed**

```bash
git add -u
git commit -m "[frontend] Employer Ops Desktop — build verification + fixes"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | 2 new | Types + config |
| 2 | 1 new, 1 mod | API client + Vite proxy fix |
| 3 | 1 new | React Query hooks + alert aggregation |
| 4 | 2 mod | Nav integration (auth + App) |
| 5 | 1 new | Container shell with alert queue |
| 6 | 1 new, 1 mod | Org banner |
| 7 | 1 new, 1 mod | Health tab (DQ) |
| 8 | 2 new, 1 mod | Cases tab + create dialog |
| 9 | 2 new, 1 mod | CRM tab + log interaction dialog |
| 10 | 2 new, 1 mod | Correspondence tab + generate dialog |
| 11 | 1 new, 1 mod | Members tab |
| 12 | — | Build verification |

**Total: 14 new files, 5 modified files, 12 commits.**
