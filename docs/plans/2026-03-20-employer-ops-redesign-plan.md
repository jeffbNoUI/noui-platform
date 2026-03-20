# Employer Ops Desktop Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the two-panel tabbed Employer Ops desktop with an alert-first triage view + summary card employer profile that scales to hundreds of employers.

**Architecture:** Single-panel layout with two states (triage/profile) in one container. Triage view shows a sortable alert table. Profile view shows an org banner, 8 summary cards, and a unified activity feed. Search dropdown overlays both states. Existing hooks, API layer, and action dialogs are reused.

**Tech Stack:** React + TypeScript, Tailwind CSS, React Query (existing hooks in `useEmployerOps.ts`), existing action dialog components.

**Design doc:** `docs/plans/2026-03-20-employer-ops-redesign-design.md`

---

## Task 1: Add ActivityEvent type and update EmployerOpsTab

**Files:**
- Modify: `frontend/src/types/EmployerOps.ts`

**Step 1: Add the ActivityEvent type**

At the end of `frontend/src/types/EmployerOps.ts`, add:

```typescript
// ── Unified Activity Feed ────────────────────────────────────────
export type ActivityEventType = 'interaction' | 'correspondence' | 'case_change' | 'dq_issue';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  timestamp: string;           // ISO 8601
  summary: string;             // One-line description
  icon: string;                // Emoji icon for timeline
  severity?: AlertSeverity;    // Optional severity for color-coding
  linkTo?: string;             // Optional deep-link target
}
```

**Step 2: Remove the old EmployerOpsTab type**

The existing `EmployerOpsTab` type in this file (`'health' | 'cases' | 'crm' | 'correspondence' | 'members'`) is no longer needed (tabs are gone). Remove it. If other files import it, they'll be updated in later tasks.

**Step 3: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

Expected: May show errors from files importing EmployerOpsTab — that's fine, we fix those in Task 3.

**Step 4: Commit**

```bash
git add frontend/src/types/EmployerOps.ts
git commit -m "[frontend] Add ActivityEvent type for unified employer activity feed"
```

---

## Task 2: Add useEmployerActivity hook

**Files:**
- Modify: `frontend/src/hooks/useEmployerOps.ts`

**Step 1: Add the useEmployerActivity hook**

This hook merges CRM interactions, correspondence (via templates/letters), and case data into a sorted `ActivityEvent[]` timeline. Add at the end of the file, before the closing exports:

```typescript
import type { ActivityEvent } from '@/types/EmployerOps';

/**
 * Merges CRM interactions, case events, and DQ issues into a unified
 * chronological activity feed for one employer.
 */
export function useEmployerActivity(orgId: string) {
  const { data: interactions } = useOrgInteractions(orgId);
  const { data: cases } = useEmployerCases(orgId);
  const { data: issues } = useEmployerDQIssues(orgId);

  const events: ActivityEvent[] = useMemo(() => {
    const items: ActivityEvent[] = [];

    // CRM interactions → activity events
    if (interactions && Array.isArray(interactions)) {
      for (const ix of interactions) {
        items.push({
          id: `ix-${ix.interactionId ?? ix.id ?? items.length}`,
          type: 'interaction',
          timestamp: ix.createdAt ?? ix.startedAt ?? new Date().toISOString(),
          summary: `${ix.direction === 'inbound' ? 'Inbound' : 'Outbound'} ${ix.channel ?? 'contact'} — ${ix.summary ?? ix.category ?? 'interaction'}`,
          icon: ix.channel?.includes('phone') ? '📞' : ix.channel?.includes('email') ? '✉️' : '💬',
        });
      }
    }

    // Cases → activity events
    if (cases && Array.isArray(cases)) {
      for (const c of cases) {
        items.push({
          id: `case-${c.caseId ?? c.id ?? items.length}`,
          type: 'case_change',
          timestamp: c.updatedAt ?? c.createdAt ?? new Date().toISOString(),
          summary: `Case ${c.caseId ?? c.id ?? '?'} — ${c.status ?? 'updated'}${c.priority === 'urgent' ? ' (urgent)' : ''}`,
          icon: c.sla === 'at-risk' || c.sla === 'urgent' ? '🔴' : c.status === 'completed' ? '✅' : '📋',
          severity: c.sla === 'at-risk' || c.sla === 'urgent' ? 'warning' : undefined,
        });
      }
    }

    // DQ issues → activity events
    if (issues && Array.isArray(issues)) {
      for (const iss of issues) {
        items.push({
          id: `dq-${iss.issueId ?? items.length}`,
          type: 'dq_issue',
          timestamp: iss.createdAt ?? new Date().toISOString(),
          summary: `DQ Issue: ${iss.description ?? 'Unknown'} (${iss.severity ?? 'unknown'})`,
          icon: iss.status === 'resolved' ? '✅' : '📋',
          severity: iss.severity === 'critical' ? 'critical' : iss.severity === 'high' ? 'warning' : undefined,
        });
      }
    }

    // Sort newest first
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items;
  }, [interactions, cases, issues]);

  return { events };
}
```

Note: The `useMemo` import should already be present (add from `react` if not). The types for interaction/case/issue records are loose here because the backend shapes vary — we access common fields defensively.

**Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

Expected: May still show EmployerOpsTab errors — that's fine.

**Step 3: Commit**

```bash
git add frontend/src/hooks/useEmployerOps.ts
git commit -m "[frontend] Add useEmployerActivity hook for unified employer timeline"
```

---

## Task 3: Build AlertTable component

**Files:**
- Create: `frontend/src/components/employer-ops/AlertTable.tsx`

**Step 1: Create the AlertTable component**

This is the main triage view — a full-width sortable table of alerts with severity filters.

```typescript
import { useState } from 'react';
import type { EmployerAlert, AlertSeverity } from '@/types/EmployerOps';

interface AlertTableProps {
  alerts: EmployerAlert[];
  isLoading: boolean;
  onSelectEmployer: (orgId: string) => void;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-400',
  info: 'bg-sky-400',
};
const SEVERITY_TEXT: Record<AlertSeverity, string> = {
  critical: 'text-red-700 bg-red-50',
  warning: 'text-amber-700 bg-amber-50',
  info: 'text-sky-700 bg-sky-50',
};
type SeverityFilter = 'all' | AlertSeverity;

export default function AlertTable({ alerts, isLoading, onSelectEmployer }: AlertTableProps) {
  const [filter, setFilter] = useState<SeverityFilter>('all');

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.severity === filter);

  const counts = {
    all: alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  };

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white p-8 text-center text-gray-400 text-sm">
        Loading alerts...
      </div>
    );
  }

  return (
    <div>
      {/* Severity filter buttons */}
      <div className="flex gap-2 mb-4">
        {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
          <button
            key={sev}
            onClick={() => setFilter(sev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === sev
                ? sev === 'all'
                  ? 'bg-gray-800 text-white'
                  : SEVERITY_TEXT[sev as AlertSeverity].replace('bg-', 'bg-') + ' ring-1 ring-current'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {sev.charAt(0).toUpperCase() + sev.slice(1)} ({counts[sev]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg bg-white border border-gray-200 p-8 text-center text-sm text-gray-400">
          {alerts.length === 0 ? 'No alerts — all employers healthy' : 'No alerts match this filter'}
        </div>
      ) : (
        <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[80px_1fr_1fr_80px_60px] gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            <div>Severity</div>
            <div>Employer</div>
            <div>Issue</div>
            <div className="text-right">Metric</div>
            <div className="text-right">Age</div>
          </div>

          {/* Alert rows */}
          {filtered.map((alert, idx) => (
            <button
              key={`${alert.orgId}-${alert.type}-${idx}`}
              onClick={() => onSelectEmployer(alert.orgId)}
              className="w-full grid grid-cols-[80px_1fr_1fr_80px_60px] gap-4 px-4 py-3 text-left border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${SEVERITY_COLORS[alert.severity]}`} />
                <span className={`text-[10px] font-semibold uppercase ${SEVERITY_TEXT[alert.severity].split(' ')[0]}`}>
                  {alert.severity}
                </span>
              </div>
              <div className="text-sm font-medium text-gray-900 truncate">{alert.orgName}</div>
              <div className="text-sm text-gray-600 truncate">{alert.message}</div>
              <div className="text-sm font-semibold text-gray-900 text-right tabular-nums">
                {typeof alert.value === 'number' && alert.type.includes('score')
                  ? `${alert.value}%`
                  : alert.value}
              </div>
              <div className="text-xs text-gray-400 text-right">—</div>
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-2">
        Showing {filtered.length} alert{filtered.length !== 1 ? 's' : ''} across{' '}
        {new Set(filtered.map((a) => a.orgId)).size} employer{new Set(filtered.map((a) => a.orgId)).size !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
```

**Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep AlertTable`

Expected: No errors from this file.

**Step 3: Commit**

```bash
git add frontend/src/components/employer-ops/AlertTable.tsx
git commit -m "[frontend] Add AlertTable component for employer triage view"
```

---

## Task 4: Build EmployerSearch component

**Files:**
- Create: `frontend/src/components/employer-ops/EmployerSearch.tsx`

**Step 1: Create the search bar with dropdown overlay**

```typescript
import { useState, useRef, useEffect } from 'react';

interface OrgResult {
  orgId: string;
  name: string;
  memberCount?: number;
}

interface ContactResult {
  contactName: string;
  orgId: string;
  orgName: string;
}

interface EmployerSearchProps {
  orgs: OrgResult[];
  contacts: ContactResult[];
  alertCount: number;
  onSelectEmployer: (orgId: string) => void;
  onShowAlerts: () => void;
}

export default function EmployerSearch({
  orgs,
  contacts,
  alertCount,
  onSelectEmployer,
  onShowAlerts,
}: EmployerSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const q = query.toLowerCase().trim();
  const showResults = open && q.length >= 2;

  const matchedOrgs = q.length >= 2
    ? orgs.filter((o) => o.name.toLowerCase().includes(q) || o.orgId.toLowerCase().includes(q)).slice(0, 8)
    : [];

  const matchedContacts = q.length >= 2
    ? contacts.filter((c) => c.contactName.toLowerCase().includes(q)).slice(0, 5)
    : [];

  const handleSelect = (orgId: string) => {
    setQuery('');
    setOpen(false);
    onSelectEmployer(orgId);
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-4" ref={ref}>
      <div className="relative flex-1">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          placeholder="Search employers by name, ID, or contact..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:border-iw-sage focus:ring-1 focus:ring-iw-sage outline-none"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>

        {/* Dropdown */}
        {showResults && (matchedOrgs.length > 0 || matchedContacts.length > 0) && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-80 overflow-y-auto">
            {matchedOrgs.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
                  Employers
                </div>
                {matchedOrgs.map((o) => (
                  <button
                    key={o.orgId}
                    onClick={() => handleSelect(o.orgId)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="text-sm font-medium text-gray-900">{o.name}</span>
                    <span className="text-xs text-gray-400">
                      {o.orgId.slice(0, 12)}...{o.memberCount != null ? ` · ${o.memberCount} mbrs` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {matchedContacts.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-t border-gray-100">
                  Contacts
                </div>
                {matchedContacts.map((c, i) => (
                  <button
                    key={`contact-${i}`}
                    onClick={() => handleSelect(c.orgId)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-900">{c.contactName}</span>
                    <span className="text-xs text-gray-400">{c.orgName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alert badge */}
      <button
        onClick={onShowAlerts}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-50"
        title="Back to alert triage"
      >
        <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold text-white ${alertCount > 0 ? 'bg-red-500' : 'bg-gray-300'}`}>
          {alertCount}
        </span>
        <span className="text-gray-600 text-sm">alerts</span>
      </button>
    </div>
  );
}
```

**Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep EmployerSearch`

Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/src/components/employer-ops/EmployerSearch.tsx
git commit -m "[frontend] Add EmployerSearch with dropdown overlay for employer lookup"
```

---

## Task 5: Build SummaryCard and SummaryCardGrid components

**Files:**
- Create: `frontend/src/components/employer-ops/SummaryCard.tsx`
- Create: `frontend/src/components/employer-ops/SummaryCardGrid.tsx`

**Step 1: Create SummaryCard — a reusable metric card**

```typescript
import type { ReactNode } from 'react';

interface Metric {
  label: string;
  value: string | number;
  color?: string; // Tailwind text color class
}

interface SummaryCardProps {
  title: string;
  metrics: Metric[];
  linkLabel?: string;
  onLink?: () => void;
  comingSoon?: boolean;
  children?: ReactNode; // For action buttons or custom content
}

export default function SummaryCard({ title, metrics, linkLabel, onLink, comingSoon, children }: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col justify-between min-h-[140px]">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
          {comingSoon && (
            <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Coming Soon
            </span>
          )}
        </div>

        {!comingSoon && metrics.length > 0 && (
          <div className="space-y-1.5">
            {metrics.map((m, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{m.label}</span>
                <span className={`text-sm font-semibold tabular-nums ${m.color ?? 'text-gray-900'}`}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {children && <div className="mt-3">{children}</div>}
      </div>

      {linkLabel && onLink && !comingSoon && (
        <button
          onClick={onLink}
          className="mt-3 text-xs font-medium text-iw-sage hover:text-iw-sageDark transition-colors text-left"
        >
          {linkLabel} →
        </button>
      )}
    </div>
  );
}
```

**Step 2: Create SummaryCardGrid — responsive 4-column grid**

```typescript
import type { ReactNode } from 'react';

interface SummaryCardGridProps {
  children: ReactNode;
}

export default function SummaryCardGrid({ children }: SummaryCardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {children}
    </div>
  );
}
```

**Step 3: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "SummaryCard"`

Expected: No errors.

**Step 4: Commit**

```bash
git add frontend/src/components/employer-ops/SummaryCard.tsx frontend/src/components/employer-ops/SummaryCardGrid.tsx
git commit -m "[frontend] Add SummaryCard and SummaryCardGrid for employer profile"
```

---

## Task 6: Build ActivityFeed component

**Files:**
- Create: `frontend/src/components/employer-ops/ActivityFeed.tsx`

**Step 1: Create the unified activity timeline**

```typescript
import { useState } from 'react';
import type { ActivityEvent } from '@/types/EmployerOps';

interface ActivityFeedProps {
  events: ActivityEvent[];
}

const INITIAL_COUNT = 10;

export default function ActivityFeed({ events }: ActivityFeedProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? events : events.slice(0, INITIAL_COUNT);

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        No recent activity
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Recent Activity
        </h3>
      </div>

      <div className="divide-y divide-gray-100">
        {visible.map((event) => (
          <div key={event.id} className="px-4 py-3 flex items-start gap-3">
            <span className="text-sm mt-0.5 flex-shrink-0">{event.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate">{event.summary}</p>
            </div>
            <time className="text-xs text-gray-400 flex-shrink-0 tabular-nums">
              {formatRelativeTime(event.timestamp)}
            </time>
          </div>
        ))}
      </div>

      {events.length > INITIAL_COUNT && (
        <div className="px-4 py-2.5 border-t border-gray-100">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs font-medium text-iw-sage hover:text-iw-sageDark transition-colors"
          >
            {showAll ? 'Show less' : `Show all ${events.length} events...`}
          </button>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
```

**Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep ActivityFeed`

Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/src/components/employer-ops/ActivityFeed.tsx
git commit -m "[frontend] Add ActivityFeed component for unified employer timeline"
```

---

## Task 7: Build AllEmployersList component

**Files:**
- Create: `frontend/src/components/employer-ops/AllEmployersList.tsx`

**Step 1: Create the compact employer directory**

This sits below the alert table in the triage view. Shows all employers alphabetically with DQ and case badges.

```typescript
import { useRef, useMemo } from 'react';
import type { EmployerAlert } from '@/types/EmployerOps';

interface Org {
  orgId: string;
  name: string;
}

interface AllEmployersListProps {
  orgs: Org[];
  alerts: EmployerAlert[];
  onSelectEmployer: (orgId: string) => void;
}

export default function AllEmployersList({ orgs, alerts, onSelectEmployer }: AllEmployersListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Count alerts per org
  const alertCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of alerts) {
      map[a.orgId] = (map[a.orgId] ?? 0) + 1;
    }
    return map;
  }, [alerts]);

  // Worst severity per org
  const worstSeverity = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of alerts) {
      const current = map[a.orgId];
      if (!current || a.severity === 'critical' || (a.severity === 'warning' && current !== 'critical')) {
        map[a.orgId] = a.severity;
      }
    }
    return map;
  }, [alerts]);

  const sorted = useMemo(
    () => [...orgs].sort((a, b) => a.name.localeCompare(b.name)),
    [orgs],
  );

  return (
    <div className="mt-6">
      <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
        All Employers ({orgs.length})
      </h3>
      <div
        ref={listRef}
        className="rounded-lg border border-gray-200 bg-white max-h-64 overflow-y-auto divide-y divide-gray-100"
      >
        {sorted.map((org) => {
          const count = alertCounts[org.orgId] ?? 0;
          const sev = worstSeverity[org.orgId];
          return (
            <button
              key={org.orgId}
              onClick={() => onSelectEmployer(org.orgId)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-800 truncate">{org.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {count > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white ${
                      sev === 'critical' ? 'bg-red-500' : sev === 'warning' ? 'bg-amber-400' : 'bg-sky-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep AllEmployersList`

Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/src/components/employer-ops/AllEmployersList.tsx
git commit -m "[frontend] Add AllEmployersList for employer directory in triage view"
```

---

## Task 8: Rewrite OrgBanner with dense layout

**Files:**
- Modify: `frontend/src/components/employer-ops/OrgBanner.tsx`

**Step 1: Rewrite OrgBanner**

Replace the entire file with a denser banner showing address, primary contact, member count, DQ score, and case count.

```typescript
import { useEmployerDQScore, useEmployerMemberSummary, useEmployerCaseSummary, useOrgContacts } from '@/hooks/useEmployerOps';
import { usePortalOrganization } from '@/hooks/useCRM';
import { dqScoreColor } from '@/lib/employerOpsConfig';

interface OrgBannerProps {
  orgId: string;
  onBack: () => void;
}

export default function OrgBanner({ orgId, onBack }: OrgBannerProps) {
  const { data: org } = usePortalOrganization(orgId);
  const { data: dq } = useEmployerDQScore(orgId);
  const { data: members } = useEmployerMemberSummary(orgId);
  const { data: caseSummary } = useEmployerCaseSummary(orgId);
  const { data: contacts } = useOrgContacts(orgId);

  const primaryContact = Array.isArray(contacts) ? contacts.find((c: any) => c.isPrimary || c.is_primary) ?? contacts[0] : undefined;
  const score = dq?.overallScore ?? 0;

  return (
    <div>
      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-3"
      >
        <span>←</span>
        <span>Back to alerts</span>
      </button>

      {/* Banner card */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between">
          {/* Left: name and details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-lg font-bold text-gray-900 truncate">
                {org?.name ?? 'Loading...'}
              </h2>
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: dqScoreColor(score) }}
              >
                DQ: {score}%
              </span>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
              {org?.ein && <span>EIN: {org.ein}</span>}
              {org?.address && <span>{org.address}</span>}
              {primaryContact && (
                <span>
                  Contact: {primaryContact.name ?? primaryContact.firstName + ' ' + primaryContact.lastName}
                  {primaryContact.email ? ` (${primaryContact.email})` : ''}
                  {primaryContact.phone ? ` ${primaryContact.phone}` : ''}
                </span>
              )}
            </div>
          </div>

          {/* Right: key stats */}
          <div className="flex gap-6 flex-shrink-0 ml-4">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 tabular-nums">
                {members?.total_members?.toLocaleString() ?? '—'}
              </div>
              <div className="text-[10px] text-gray-400 uppercase">Members</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 tabular-nums">
                {caseSummary?.activeCases ?? '—'}
              </div>
              <div className="text-[10px] text-gray-400 uppercase">Active Cases</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Note: The hook imports (`usePortalOrganization` from `useCRM`) match the existing pattern in the current OrgBanner. Adjust import paths if the actual hook location differs.

**Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep OrgBanner`

Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/src/components/employer-ops/OrgBanner.tsx
git commit -m "[frontend] Rewrite OrgBanner with dense layout for employer profile"
```

---

## Task 9: Rewrite EmployerOpsDesktop — main container

**Files:**
- Modify: `frontend/src/components/employer-ops/EmployerOpsDesktop.tsx`

This is the main task — replacing the two-panel tabbed layout with the single-panel triage/profile design.

**Step 1: Rewrite the entire file**

Replace `EmployerOpsDesktop.tsx` with the new single-panel container that manages the triage/profile state transition.

```typescript
import { useState, useMemo } from 'react';
import { usePortalOrganizations } from '@/hooks/useCRM';
import { useEmployerAlerts, useEmployerDQScore, useEmployerCaseSummary, useEmployerMemberSummary, useOrgContacts, useEmployerDQIssues, useEmployerCases, useEmployerActivity } from '@/hooks/useEmployerOps';
import { dqScoreColor } from '@/lib/employerOpsConfig';
import AlertTable from './AlertTable';
import AllEmployersList from './AllEmployersList';
import EmployerSearch from './EmployerSearch';
import OrgBanner from './OrgBanner';
import SummaryCard from './SummaryCard';
import SummaryCardGrid from './SummaryCardGrid';
import ActivityFeed from './ActivityFeed';
import CreateCaseDialog from './actions/CreateCaseDialog';
import LogInteractionDialog from './actions/LogInteractionDialog';
import GenerateLetterDialog from './actions/GenerateLetterDialog';
import { useEmployerTemplates } from '@/hooks/useEmployerOps';

type ViewState = 'triage' | 'profile';
type DialogState = 'none' | 'case' | 'interaction' | 'letter';

export default function EmployerOpsDesktop() {
  const [view, setView] = useState<ViewState>('triage');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>('none');

  // Global data — needed for both views
  const { data: orgList = [] } = usePortalOrganizations();
  const orgIds = useMemo(() => orgList.map((o: any) => o.orgId ?? o.id), [orgList]);
  const orgNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of orgList) map[o.orgId ?? o.id] = o.name;
    return map;
  }, [orgList]);
  const { alerts, isLoading: alertsLoading } = useEmployerAlerts(orgIds, orgNames);

  // Org-scoped data — for profile view (only when selectedOrgId is set)
  const { data: dq } = useEmployerDQScore(selectedOrgId ?? '');
  const { data: caseSummary } = useEmployerCaseSummary(selectedOrgId ?? '');
  const { data: memberSummary } = useEmployerMemberSummary(selectedOrgId ?? '');
  const { data: contacts } = useOrgContacts(selectedOrgId ?? '');
  const { data: issues } = useEmployerDQIssues(selectedOrgId ?? '');
  const { data: cases } = useEmployerCases(selectedOrgId ?? '');
  const { events: activityEvents } = useEmployerActivity(selectedOrgId ?? '');
  const { data: templates } = useEmployerTemplates();

  // Build search data for EmployerSearch
  const searchOrgs = useMemo(
    () => orgList.map((o: any) => ({ orgId: o.orgId ?? o.id, name: o.name, memberCount: o.memberCount })),
    [orgList],
  );
  const searchContacts = useMemo(() => {
    if (!contacts || !Array.isArray(contacts) || !selectedOrgId) return [];
    return contacts.map((c: any) => ({
      contactName: c.name ?? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
      orgId: selectedOrgId,
      orgName: orgNames[selectedOrgId] ?? '',
    }));
  }, [contacts, selectedOrgId, orgNames]);

  const handleSelectEmployer = (orgId: string) => {
    setSelectedOrgId(orgId);
    setView('profile');
  };

  const handleShowAlerts = () => {
    setView('triage');
  };

  // Summary card metric helpers
  const dqScore = dq?.overallScore ?? 0;
  const dqIssueCount = dq?.openIssues ?? (Array.isArray(issues) ? issues.filter((i: any) => i.status === 'open').length : 0);
  const dqCriticalCount = dq?.criticalIssues ?? 0;
  const activeCases = caseSummary?.activeCases ?? 0;
  const atRiskCases = caseSummary?.atRiskCases ?? 0;
  const totalMembers = memberSummary?.total_members ?? 0;
  const contactCount = Array.isArray(contacts) ? contacts.length : 0;
  const recentCorrespondenceCount = 0; // Placeholder until correspondence history endpoint
  const caseList = Array.isArray(cases) ? cases : [];
  const overdueCases = caseList.filter((c: any) => c.sla === 'overdue' || c.sla === 'urgent').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search bar — always visible */}
      <EmployerSearch
        orgs={searchOrgs}
        contacts={searchContacts}
        alertCount={alerts.length}
        onSelectEmployer={handleSelectEmployer}
        onShowAlerts={handleShowAlerts}
      />

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* ── Triage View ───────────────────────────────────── */}
        {view === 'triage' && (
          <div>
            <h1 className="text-lg font-bold text-gray-900 mb-4">Employer Ops</h1>
            <AlertTable
              alerts={alerts}
              isLoading={alertsLoading}
              onSelectEmployer={handleSelectEmployer}
            />
            <AllEmployersList
              orgs={searchOrgs}
              alerts={alerts}
              onSelectEmployer={handleSelectEmployer}
            />
          </div>
        )}

        {/* ── Employer Profile ──────────────────────────────── */}
        {view === 'profile' && selectedOrgId && (
          <div key={selectedOrgId} className="space-y-6">
            {/* Zone 1: Org Banner */}
            <OrgBanner orgId={selectedOrgId} onBack={handleShowAlerts} />

            {/* Zone 2: Summary Card Grid */}
            <SummaryCardGrid>
              <SummaryCard
                title="DQ Health"
                metrics={[
                  { label: 'Score', value: `${dqScore}%`, color: `text-[${dqScoreColor(dqScore)}]` },
                  { label: 'Open Issues', value: dqIssueCount },
                  { label: 'Critical', value: dqCriticalCount, color: dqCriticalCount > 0 ? 'text-red-600' : undefined },
                ]}
                linkLabel="View Details"
                onLink={() => {/* Deep link to DQ view — future */}}
              />
              <SummaryCard
                title="Cases"
                metrics={[
                  { label: 'Active', value: activeCases },
                  { label: 'At Risk', value: atRiskCases, color: atRiskCases > 0 ? 'text-red-600' : undefined },
                  { label: 'Overdue', value: overdueCases, color: overdueCases > 0 ? 'text-red-600' : undefined },
                ]}
                linkLabel="View All Cases"
                onLink={() => {/* Deep link to case management — future */}}
              />
              <SummaryCard
                title="Members"
                metrics={[
                  { label: 'Total', value: totalMembers.toLocaleString() },
                  { label: 'Tier 1', value: memberSummary?.tier1_count ?? 0 },
                  { label: 'Tier 2', value: memberSummary?.tier2_count ?? 0 },
                  { label: 'Tier 3', value: memberSummary?.tier3_count ?? 0 },
                ]}
                linkLabel="View Roster"
                onLink={() => {/* Deep link to member search filtered — future */}}
              />
              <SummaryCard
                title="Contacts & Users"
                metrics={[
                  { label: 'Contacts', value: contactCount },
                ]}
                linkLabel="View Contacts"
                onLink={() => {/* Deep link to CRM contacts — future */}}
              />
              <SummaryCard
                title="Correspondence"
                metrics={[
                  { label: 'Recent', value: recentCorrespondenceCount },
                ]}
                linkLabel="View Letters"
                onLink={() => {/* Deep link to correspondence — future */}}
              />
              <SummaryCard title="Contributions" metrics={[]} comingSoon />
              <SummaryCard title="Balances" metrics={[]} comingSoon />
              <SummaryCard title="Actions" metrics={[]}>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setDialog('interaction')}
                    className="w-full text-left text-xs font-medium text-iw-sage hover:text-iw-sageDark transition-colors"
                  >
                    📞 Log Interaction
                  </button>
                  <button
                    onClick={() => setDialog('case')}
                    className="w-full text-left text-xs font-medium text-iw-sage hover:text-iw-sageDark transition-colors"
                  >
                    📋 Create Case
                  </button>
                  <button
                    onClick={() => setDialog('letter')}
                    className="w-full text-left text-xs font-medium text-iw-sage hover:text-iw-sageDark transition-colors"
                  >
                    ✉️ Send Letter
                  </button>
                </div>
              </SummaryCard>
            </SummaryCardGrid>

            {/* Zone 3: Activity Feed */}
            <ActivityFeed events={activityEvents} />
          </div>
        )}
      </main>

      {/* Action dialogs */}
      {dialog === 'case' && selectedOrgId && (
        <CreateCaseDialog orgId={selectedOrgId} onClose={() => setDialog('none')} />
      )}
      {dialog === 'interaction' && selectedOrgId && (
        <LogInteractionDialog orgId={selectedOrgId} onClose={() => setDialog('none')} />
      )}
      {dialog === 'letter' && selectedOrgId && templates?.[0] && (
        <GenerateLetterDialog orgId={selectedOrgId} template={templates[0]} onClose={() => setDialog('none')} />
      )}
    </div>
  );
}
```

**Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`

Expected: Clean, or minor issues to fix. The key thing is that all new component imports resolve and all hook calls match their signatures.

**Step 3: Commit**

```bash
git add frontend/src/components/employer-ops/EmployerOpsDesktop.tsx
git commit -m "[frontend] Rewrite EmployerOpsDesktop — triage/profile single-panel layout"
```

---

## Task 10: Delete old tab components

**Files:**
- Delete: `frontend/src/components/employer-ops/tabs/HealthTab.tsx`
- Delete: `frontend/src/components/employer-ops/tabs/CasesTab.tsx`
- Delete: `frontend/src/components/employer-ops/tabs/CRMTab.tsx`
- Delete: `frontend/src/components/employer-ops/tabs/CorrespondenceTab.tsx`
- Delete: `frontend/src/components/employer-ops/tabs/MembersTab.tsx`

**Step 1: Remove all 5 tab files**

```bash
rm frontend/src/components/employer-ops/tabs/HealthTab.tsx
rm frontend/src/components/employer-ops/tabs/CasesTab.tsx
rm frontend/src/components/employer-ops/tabs/CRMTab.tsx
rm frontend/src/components/employer-ops/tabs/CorrespondenceTab.tsx
rm frontend/src/components/employer-ops/tabs/MembersTab.tsx
```

**Step 2: Verify no remaining imports**

Run: `grep -r "tabs/HealthTab\|tabs/CasesTab\|tabs/CRMTab\|tabs/CorrespondenceTab\|tabs/MembersTab" frontend/src/`

Expected: No matches. The old EmployerOpsDesktop imported these, but the rewrite in Task 9 doesn't.

**Step 3: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

Expected: Clean.

**Step 4: Commit**

```bash
git add -u frontend/src/components/employer-ops/tabs/
git commit -m "[frontend] Remove old tab components replaced by summary card design"
```

---

## Task 11: Typecheck, fix issues, final build

**Files:**
- May modify any of the above files to fix type errors

**Step 1: Full typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1`

Fix any remaining errors. Common issues:
- Import paths that don't match (adjust hook/type import paths)
- Missing `useMemo` import in useEmployerOps.ts
- Loose `any` types on hook return data needing optional chaining
- `EmployerOpsTab` still referenced somewhere (remove the import)

**Step 2: Run existing tests**

Run: `cd frontend && npm test -- --run 2>&1 | tail -20`

Existing tests should pass. The action dialog tests and hook tests should be unaffected. Any test that imported HealthTab/CasesTab/etc. directly will fail and should be removed or updated.

**Step 3: Build check**

Run: `cd frontend && npm run build 2>&1 | tail -10`

Expected: Build succeeds.

**Step 4: Commit fixes**

```bash
git add -u frontend/src/
git commit -m "[frontend] Fix type errors and verify build for Employer Ops redesign"
```

---

## Task 12: Visual verification in browser

**Step 1: Start dev server and open Employer Ops**

Use preview tools to start the frontend dev server, navigate to Employer Ops via the Staff Portal sidebar link.

**Step 2: Verify triage view**

- Alert table renders with severity-sorted alerts
- Severity filter buttons work (All/Critical/Warning/Info)
- "All Employers" list shows below the alert table
- Search bar is visible at top with alert count badge

**Step 3: Verify employer profile**

- Click an alert → profile loads with org banner, 8 cards, activity feed
- "Back to alerts" returns to triage view
- Action buttons (Log Interaction, Create Case, Send Letter) open dialogs
- "Coming Soon" badges on Contributions and Balances cards
- Activity feed shows events in chronological order

**Step 4: Verify search**

- Type in search bar → dropdown shows matching employers and contacts
- Select a result → navigates to that employer's profile
- Escape closes dropdown

**Step 5: Take screenshots for PR**

Capture triage view and profile view screenshots.

**Step 6: Commit any visual fixes**

```bash
git add -u frontend/src/
git commit -m "[frontend] Visual polish for Employer Ops redesign"
```
