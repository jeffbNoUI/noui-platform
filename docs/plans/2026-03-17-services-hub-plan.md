# Services Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the "Platform Health" StaffPortal tab into a 7-section Services Hub with tabbed sub-navigation, adding Audit Trail, Operational Metrics, Security & Access, Issue Management, and Configuration & Rules panels.

**Architecture:** New `ServicesHub.tsx` shell component with horizontal tab bar replaces `ServiceHealthDashboard` in `StaffPortal.tsx`. Existing `ServiceHealthDashboard` and `DataQualityPanel` become sub-tab panels unchanged. Five new panels are added, all frontend-only (three consume existing backend APIs, two use demo data with Phase B backend planned).

**Tech Stack:** React, TypeScript, Tailwind CSS, React Query, Recharts, Vitest + Testing Library

---

## Task 1: ServicesHub Shell Component

**Files:**
- Create: `frontend/src/components/admin/ServicesHub.tsx`
- Create: `frontend/src/components/admin/__tests__/ServicesHub.test.tsx`
- Modify: `frontend/src/components/StaffPortal.tsx`

**Step 1: Write the test for ServicesHub**

```tsx
// frontend/src/components/admin/__tests__/ServicesHub.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ServicesHub from '../ServicesHub';

// Mock child panels to isolate shell behavior
vi.mock('../ServiceHealthDashboard', () => ({ default: () => <div>HealthPanel</div> }));
vi.mock('../DataQualityPanel', () => ({ default: () => <div>DQPanel</div> }));
vi.mock('../AuditTrailPanel', () => ({ default: () => <div>AuditPanel</div> }));
vi.mock('../OperationalMetricsPanel', () => ({ default: () => <div>MetricsPanel</div> }));
vi.mock('../SecurityAccessPanel', () => ({ default: () => <div>SecurityPanel</div> }));
vi.mock('../IssueManagementPanel', () => ({ default: () => <div>IssuesPanel</div> }));
vi.mock('../ConfigRulesPanel', () => ({ default: () => <div>ConfigPanel</div> }));

describe('ServicesHub', () => {
  it('renders all 7 tab buttons', () => {
    renderWithProviders(<ServicesHub />);
    expect(screen.getByRole('tab', { name: /health/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /data quality/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /audit/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /metrics/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /security/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /issues/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /config/i })).toBeInTheDocument();
  });

  it('shows Health panel by default', () => {
    renderWithProviders(<ServicesHub />);
    expect(screen.getByText('HealthPanel')).toBeInTheDocument();
  });

  it('switches to Audit panel on tab click', () => {
    renderWithProviders(<ServicesHub />);
    fireEvent.click(screen.getByRole('tab', { name: /audit/i }));
    expect(screen.getByText('AuditPanel')).toBeInTheDocument();
    expect(screen.queryByText('HealthPanel')).not.toBeInTheDocument();
  });

  it('highlights active tab', () => {
    renderWithProviders(<ServicesHub />);
    const healthTab = screen.getByRole('tab', { name: /health/i });
    expect(healthTab).toHaveAttribute('aria-selected', 'true');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/ServicesHub.test.tsx`
Expected: FAIL — module not found

**Step 3: Write ServicesHub component**

```tsx
// frontend/src/components/admin/ServicesHub.tsx
import { useState } from 'react';
import ServiceHealthDashboard from './ServiceHealthDashboard';
import DataQualityPanel from './DataQualityPanel';
import AuditTrailPanel from './AuditTrailPanel';
import OperationalMetricsPanel from './OperationalMetricsPanel';
import SecurityAccessPanel from './SecurityAccessPanel';
import IssueManagementPanel from './IssueManagementPanel';
import ConfigRulesPanel from './ConfigRulesPanel';

type HubTab = 'health' | 'dq' | 'audit' | 'metrics' | 'security' | 'issues' | 'config';

const TABS: { key: HubTab; label: string }[] = [
  { key: 'health', label: 'Health' },
  { key: 'dq', label: 'Data Quality' },
  { key: 'audit', label: 'Audit Trail' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'security', label: 'Security' },
  { key: 'issues', label: 'Issues' },
  { key: 'config', label: 'Config' },
];

export default function ServicesHub() {
  const [activeTab, setActiveTab] = useState<HubTab>('health');

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="bg-white rounded-lg border border-gray-200 px-2" role="tablist">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'text-iw-sage border-iw-sage'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active panel */}
      {activeTab === 'health' && <ServiceHealthDashboard />}
      {activeTab === 'dq' && <DataQualityPanel />}
      {activeTab === 'audit' && <AuditTrailPanel />}
      {activeTab === 'metrics' && <OperationalMetricsPanel />}
      {activeTab === 'security' && <SecurityAccessPanel />}
      {activeTab === 'issues' && <IssueManagementPanel />}
      {activeTab === 'config' && <ConfigRulesPanel />}
    </div>
  );
}
```

Note: The five new panel components don't exist yet. Create minimal placeholder stubs so this compiles — each stub is a single `export default function XPanel() { return <div>Coming soon</div>; }`. These stubs will be replaced in Tasks 2–6.

**Step 4: Wire into StaffPortal**

In `frontend/src/components/StaffPortal.tsx`:
- Change import: `ServiceHealthDashboard` → `ServicesHub` from `@/components/admin/ServicesHub`
- Remove import of `DataQualityPanel` (it's now inside ServicesHub)
- Change sidebar: rename `'Platform Health'` to `'Services Hub'` in SIDEBAR_NAV
- Remove the `'dq'` sidebar entry (Data Quality is now a sub-tab inside Services Hub)
- Update `StaffTab` type: remove `'dq'`
- Change render: `{activeTab === 'service-map' && <ServicesHub />}`
- Remove: `{activeTab === 'dq' && <DataQualityPanel />}`
- Update top bar title mapping: `'service-map': 'Services Hub'` (remove `'dq': 'Data Quality'`)

**Step 5: Run tests**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/ServicesHub.test.tsx`
Expected: PASS (4 tests)

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean

**Step 6: Commit**

```bash
git add frontend/src/components/admin/ServicesHub.tsx \
       frontend/src/components/admin/__tests__/ServicesHub.test.tsx \
       frontend/src/components/admin/AuditTrailPanel.tsx \
       frontend/src/components/admin/OperationalMetricsPanel.tsx \
       frontend/src/components/admin/SecurityAccessPanel.tsx \
       frontend/src/components/admin/IssueManagementPanel.tsx \
       frontend/src/components/admin/ConfigRulesPanel.tsx \
       frontend/src/components/StaffPortal.tsx
git commit -m "[frontend] Add ServicesHub shell with 7-tab sub-navigation"
```

---

## Task 2: Audit Trail Panel

**Files:**
- Create: `frontend/src/types/Audit.ts`
- Create: `frontend/src/lib/auditApi.ts`
- Create: `frontend/src/hooks/useAuditLog.ts`
- Create: `frontend/src/components/admin/AuditTrailPanel.tsx` (replace stub)
- Create: `frontend/src/components/admin/__tests__/AuditTrailPanel.test.tsx`

**Reference:** Backend endpoint is `GET /api/v1/crm/audit?entity_type=&entity_id=&limit=50`. CRM API pattern in `frontend/src/lib/crmApi.ts`. Type pattern in `frontend/src/types/CRM.ts`.

**Step 1: Write audit types**

```typescript
// frontend/src/types/Audit.ts
export type AuditEventType = 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSITION';
export type AuditEntityType =
  | 'Contact'
  | 'Conversation'
  | 'Interaction'
  | 'Commitment'
  | 'Outreach'
  | 'Organization';

export interface AuditEntry {
  auditId: number;
  tenantId: string;
  eventType: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  agentId: string;
  agentIp?: string;
  agentDevice?: string;
  fieldChanges?: Record<string, { old: unknown; new: unknown }>;
  summary: string;
  prevAuditHash?: string;
  recordHash?: string;
  eventTime: string;
}

export interface AuditListParams {
  entity_type?: string;
  entity_id?: string;
  limit?: number;
  offset?: number;
}
```

**Step 2: Write audit API client**

```typescript
// frontend/src/lib/auditApi.ts
import { fetchPaginatedAPI, toQueryString } from './apiClient';
import type { AuditEntry, AuditListParams } from '@/types/Audit';

const CRM_URL = import.meta.env.VITE_CRM_URL || '/api';

export const auditAPI = {
  listEntries: (params?: AuditListParams) =>
    fetchPaginatedAPI<AuditEntry>(`${CRM_URL}/v1/crm/audit${toQueryString(params || {})}`),
};
```

**Step 3: Write the hook**

```typescript
// frontend/src/hooks/useAuditLog.ts
import { useQuery } from '@tanstack/react-query';
import { auditAPI } from '@/lib/auditApi';
import type { AuditListParams } from '@/types/Audit';

export function useAuditLog(params?: AuditListParams) {
  return useQuery({
    queryKey: ['audit', 'log', params],
    queryFn: () => auditAPI.listEntries(params),
    staleTime: 30_000,
  });
}
```

**Step 4: Write the test**

```tsx
// frontend/src/components/admin/__tests__/AuditTrailPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import AuditTrailPanel from '../AuditTrailPanel';

const mockUseAuditLog = vi.fn();
vi.mock('@/hooks/useAuditLog', () => ({
  useAuditLog: (...args: unknown[]) => mockUseAuditLog(...args),
}));

const MOCK_ENTRIES = {
  items: [
    {
      auditId: 1,
      tenantId: 't1',
      eventType: 'UPDATE',
      entityType: 'Contact',
      entityId: 'c1',
      agentId: 'jsmith',
      summary: 'Updated phone number for Maria Santos',
      fieldChanges: { phone: { old: '555-0100', new: '555-0142' } },
      eventTime: '2026-03-17T14:32:00Z',
    },
    {
      auditId: 2,
      tenantId: 't1',
      eventType: 'CREATE',
      entityType: 'Interaction',
      entityId: 'i1',
      agentId: 'ajonez',
      summary: 'Created phone_inbound interaction',
      eventTime: '2026-03-17T14:28:00Z',
    },
  ],
  pagination: { total: 2, limit: 50, offset: 0, hasMore: false },
};

describe('AuditTrailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuditLog.mockReturnValue({ data: MOCK_ENTRIES, isLoading: false, isError: false });
  });

  it('renders filter controls', () => {
    renderWithProviders(<AuditTrailPanel />);
    expect(screen.getByLabelText(/entity type/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('renders audit entries with summary text', () => {
    renderWithProviders(<AuditTrailPanel />);
    expect(screen.getByText(/Updated phone number/)).toBeInTheDocument();
    expect(screen.getByText(/Created phone_inbound/)).toBeInTheDocument();
  });

  it('shows agent and event type badges', () => {
    renderWithProviders(<AuditTrailPanel />);
    expect(screen.getByText('jsmith')).toBeInTheDocument();
    expect(screen.getByText('UPDATE')).toBeInTheDocument();
    expect(screen.getByText('CREATE')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseAuditLog.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithProviders(<AuditTrailPanel />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows error state gracefully', () => {
    mockUseAuditLog.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithProviders(<AuditTrailPanel />);
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it('filters by entity type', () => {
    renderWithProviders(<AuditTrailPanel />);
    fireEvent.change(screen.getByLabelText(/entity type/i), { target: { value: 'Contact' } });
    // Verify hook was called with entity_type filter
    expect(mockUseAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ entity_type: 'Contact' }),
    );
  });
});
```

**Step 5: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/AuditTrailPanel.test.tsx`
Expected: FAIL — component is still stub

**Step 6: Implement AuditTrailPanel**

Replace the stub in `frontend/src/components/admin/AuditTrailPanel.tsx` with the full implementation:
- Filter bar: entity type dropdown (All + 6 entity types), search input
- Entry list: timestamp, agent badge, event type badge, entity type, summary text
- Expandable detail: field_changes rendered as old→new diffs, agent IP/device, hash chain
- Loading skeleton state, error banner, "Load More" pagination
- Follow the card/border/text styling patterns from `DataQualityPanel` and `ServiceHealthCard`

**Step 7: Run tests**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/AuditTrailPanel.test.tsx`
Expected: PASS (6 tests)

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean

**Step 8: Commit**

```bash
git add frontend/src/types/Audit.ts \
       frontend/src/lib/auditApi.ts \
       frontend/src/hooks/useAuditLog.ts \
       frontend/src/components/admin/AuditTrailPanel.tsx \
       frontend/src/components/admin/__tests__/AuditTrailPanel.test.tsx
git commit -m "[frontend] Add Audit Trail panel with CRM audit log viewer"
```

---

## Task 3: Operational Metrics Panel

**Files:**
- Create: `frontend/src/hooks/useCommitmentStats.ts`
- Create: `frontend/src/components/admin/OperationalMetricsPanel.tsx` (replace stub)
- Create: `frontend/src/components/admin/__tests__/OperationalMetricsPanel.test.tsx`

**Reference:** Reuse existing hooks from `frontend/src/hooks/useCaseStats.ts` (`useCaseStats`, `useSLAStats`, `useVolumeStats`). CRM commitments from `frontend/src/lib/crmApi.ts`. Case types in `frontend/src/types/Case.ts`.

**Step 1: Write commitment stats hook**

```typescript
// frontend/src/hooks/useCommitmentStats.ts
import { useQuery } from '@tanstack/react-query';
import { crmAPI } from '@/lib/crmApi';

export interface CommitmentCounts {
  overdue: number;
  dueThisWeek: number;
  upcoming: number;
}

export function useCommitmentStats() {
  return useQuery<CommitmentCounts>({
    queryKey: ['crm', 'commitments', 'stats'],
    queryFn: async () => {
      const { items } = await crmAPI.listCommitments({ status: 'pending', limit: 100 });
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);

      let overdue = 0, dueThisWeek = 0, upcoming = 0;
      for (const c of items) {
        const due = new Date(c.dueDate);
        if (due < now) overdue++;
        else if (due <= weekEnd) dueThisWeek++;
        else upcoming++;
      }
      return { overdue, dueThisWeek, upcoming };
    },
    staleTime: 60_000,
  });
}
```

**Step 2: Write the test**

```tsx
// frontend/src/components/admin/__tests__/OperationalMetricsPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import OperationalMetricsPanel from '../OperationalMetricsPanel';

// Mock all data hooks
const mockCaseStats = vi.fn();
const mockSLAStats = vi.fn();
const mockVolumeStats = vi.fn();
const mockCommitmentStats = vi.fn();
const mockDQScore = vi.fn();

vi.mock('@/hooks/useCaseStats', () => ({
  useCaseStats: () => mockCaseStats(),
  useSLAStats: () => mockSLAStats(),
  useVolumeStats: () => mockVolumeStats(),
}));
vi.mock('@/hooks/useCommitmentStats', () => ({
  useCommitmentStats: () => mockCommitmentStats(),
}));
vi.mock('@/hooks/useDataQuality', () => ({
  useDQScore: () => mockDQScore(),
}));

const CASE_STATS = {
  totalActive: 47,
  byStatus: { active: 47, closed: 120 },
  byPriority: { urgent: 5, high: 12, standard: 30 },
  byStage: {
    'intake-review': 12,
    'employment-verification': 18,
    'eligibility-determination': 8,
    'benefit-calculation': 4,
    'election-enrollment': 3,
    'final-certification': 2,
  },
  avgDaysOpen: 12.3,
};

const SLA_STATS = {
  total: 47, onTrack: 39, atRisk: 5, breached: 3,
  onTrackPct: 82.9, atRiskPct: 10.7, breachedPct: 6.4,
};

const VOLUME_STATS = {
  months: [
    { month: '2025-10', count: 22 },
    { month: '2025-11', count: 28 },
    { month: '2025-12', count: 31 },
    { month: '2026-01', count: 25 },
    { month: '2026-02', count: 33 },
    { month: '2026-03', count: 18 },
  ],
};

describe('OperationalMetricsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaseStats.mockReturnValue({ data: CASE_STATS, isLoading: false });
    mockSLAStats.mockReturnValue({ data: SLA_STATS, isLoading: false });
    mockVolumeStats.mockReturnValue({ data: VOLUME_STATS, isLoading: false });
    mockCommitmentStats.mockReturnValue({ data: { overdue: 3, dueThisWeek: 7, upcoming: 12 }, isLoading: false });
    mockDQScore.mockReturnValue({ data: { overallScore: 96.2 }, isLoading: false });
  });

  it('renders KPI cards with values', () => {
    renderWithProviders(<OperationalMetricsPanel />);
    expect(screen.getByText('Active Cases')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('SLA On-Track')).toBeInTheDocument();
  });

  it('renders pipeline by stage section', () => {
    renderWithProviders(<OperationalMetricsPanel />);
    expect(screen.getByText(/pipeline/i)).toBeInTheDocument();
  });

  it('renders SLA health section', () => {
    renderWithProviders(<OperationalMetricsPanel />);
    expect(screen.getByText(/sla health/i)).toBeInTheDocument();
  });

  it('renders commitments due section', () => {
    renderWithProviders(<OperationalMetricsPanel />);
    expect(screen.getByText(/commitments/i)).toBeInTheDocument();
    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });

  it('handles loading state', () => {
    mockCaseStats.mockReturnValue({ data: undefined, isLoading: true });
    mockSLAStats.mockReturnValue({ data: undefined, isLoading: true });
    mockVolumeStats.mockReturnValue({ data: undefined, isLoading: true });
    mockCommitmentStats.mockReturnValue({ data: undefined, isLoading: true });
    mockDQScore.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<OperationalMetricsPanel />);
    // Should not crash, should show loading indicators
    expect(screen.getByText('Active Cases')).toBeInTheDocument();
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/OperationalMetricsPanel.test.tsx`
Expected: FAIL — component is stub

**Step 4: Implement OperationalMetricsPanel**

Replace stub with full implementation:
- KPI row: 4 cards (Active Cases, SLA On-Track %, Avg Processing days, DQ Score)
- Pipeline section: horizontal bars per stage using `byStage` data
- SLA health: stacked horizontal bar (on-track green, at-risk amber, breached red) with percentages
- Volume trend: Recharts BarChart with 6 months, current month highlighted
- Commitments due: 3-column card (overdue/this week/upcoming) with counts
- Use existing hooks: `useCaseStats()`, `useSLAStats()`, `useVolumeStats()`, `useDQScore()`
- Follow Recharts patterns from `HealthTrendsPanel.tsx` (import `C`, `BODY` from designSystem)

**Step 5: Run tests**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/OperationalMetricsPanel.test.tsx`
Expected: PASS (5 tests)

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean

**Step 6: Commit**

```bash
git add frontend/src/hooks/useCommitmentStats.ts \
       frontend/src/components/admin/OperationalMetricsPanel.tsx \
       frontend/src/components/admin/__tests__/OperationalMetricsPanel.test.tsx
git commit -m "[frontend] Add Operational Metrics panel with pipeline, SLA, and volume charts"
```

---

## Task 4: Security & Access Panel (Phase A)

**Files:**
- Create: `frontend/src/components/admin/SecurityAccessPanel.tsx` (replace stub)
- Create: `frontend/src/components/admin/__tests__/SecurityAccessPanel.test.tsx`

**Reference:** Role definitions in `frontend/src/types/auth.ts` (`ROLE_ACCESS`, `UserRole`, `ViewMode`). No backend needed — purely renders existing type data.

**Step 1: Write the test**

```tsx
// frontend/src/components/admin/__tests__/SecurityAccessPanel.test.tsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import SecurityAccessPanel from '../SecurityAccessPanel';

describe('SecurityAccessPanel', () => {
  it('renders role definitions table with all 5 roles', () => {
    renderWithProviders(<SecurityAccessPanel />);
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('staff')).toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();
    expect(screen.getByText('employer')).toBeInTheDocument();
    expect(screen.getByText('vendor')).toBeInTheDocument();
  });

  it('renders access matrix section', () => {
    renderWithProviders(<SecurityAccessPanel />);
    expect(screen.getByText(/access matrix/i)).toBeInTheDocument();
  });

  it('shows portal names in access matrix', () => {
    renderWithProviders(<SecurityAccessPanel />);
    expect(screen.getByText(/staff/i)).toBeInTheDocument();
    expect(screen.getByText(/workspace/i)).toBeInTheDocument();
  });

  it('renders summary stats', () => {
    renderWithProviders(<SecurityAccessPanel />);
    expect(screen.getByText('Roles Defined')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows Phase B coming soon notice for security events', () => {
    renderWithProviders(<SecurityAccessPanel />);
    expect(screen.getByText(/security events/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/SecurityAccessPanel.test.tsx`
Expected: FAIL — component is stub

**Step 3: Implement SecurityAccessPanel**

Replace stub with:
- Summary row: Roles Defined (5), Portals (8), placeholder cards for Active Users / Sessions (with "Phase B" badge)
- Role definitions table: Role name, portal count, portal list, key permissions description
- Access matrix: grid table with roles as rows, ViewModes as columns, checkmark/cross cells
- Security events section: "Coming in Phase B" notice with brief description of planned capabilities
- All data sourced from `ROLE_ACCESS` import from `@/types/auth`

**Step 4: Run tests**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/SecurityAccessPanel.test.tsx`
Expected: PASS (5 tests)

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean

**Step 5: Commit**

```bash
git add frontend/src/components/admin/SecurityAccessPanel.tsx \
       frontend/src/components/admin/__tests__/SecurityAccessPanel.test.tsx
git commit -m "[frontend] Add Security & Access panel with role definitions and access matrix"
```

---

## Task 5: Issue Management Panel (Phase A — Demo Data)

**Files:**
- Create: `frontend/src/components/admin/IssueManagementPanel.tsx` (replace stub)
- Create: `frontend/src/components/admin/__tests__/IssueManagementPanel.test.tsx`

**Note:** This uses local demo data — no API client or hooks needed yet. Phase B (backend service) is tracked in memory.

**Step 1: Write the test**

```tsx
// frontend/src/components/admin/__tests__/IssueManagementPanel.test.tsx
import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import IssueManagementPanel from '../IssueManagementPanel';

describe('IssueManagementPanel', () => {
  it('renders summary stat cards', () => {
    renderWithProviders(<IssueManagementPanel />);
    expect(screen.getByText('Open Issues')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Avg Resolution')).toBeInTheDocument();
    expect(screen.getByText(/Resolved/)).toBeInTheDocument();
  });

  it('renders issue list with demo entries', () => {
    renderWithProviders(<IssueManagementPanel />);
    // At least one demo issue should be visible
    expect(screen.getByText(/ISS-/)).toBeInTheDocument();
  });

  it('shows severity badges', () => {
    renderWithProviders(<IssueManagementPanel />);
    // Demo data includes critical and high severity issues
    expect(screen.getByText(/critical/i)).toBeInTheDocument();
  });

  it('renders filter controls', () => {
    renderWithProviders(<IssueManagementPanel />);
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/severity/i)).toBeInTheDocument();
  });

  it('expands issue to show detail', () => {
    renderWithProviders(<IssueManagementPanel />);
    const firstIssue = screen.getAllByText(/ISS-/)[0];
    fireEvent.click(firstIssue);
    // After expanding, description should be visible
    expect(screen.getByText(/description/i)).toBeInTheDocument();
  });

  it('shows demo data notice', () => {
    renderWithProviders(<IssueManagementPanel />);
    expect(screen.getByText(/demo data/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/IssueManagementPanel.test.tsx`
Expected: FAIL — component is stub

**Step 3: Implement IssueManagementPanel**

Replace stub with:
- Hardcoded `DEMO_ISSUES` array (6-8 entries spanning severity levels and statuses)
- Summary row: Open count, Critical count, Avg resolution days, Resolved (30d)
- Filter bar: Status dropdown (All/Open/Triaged/In Work/Resolved/Closed), Severity dropdown (All/Critical/High/Medium/Low)
- Issue list: expandable rows with ISS-NNN ID, severity badge (color-coded), title, reported date, assignee, status badge
- Expanded detail: description, affected service, activity log (demo timestamps), resolution note field
- "Demo data" banner at top indicating Phase B will wire to live backend
- Client-side filtering on the demo array

**Step 4: Run tests**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/IssueManagementPanel.test.tsx`
Expected: PASS (6 tests)

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean

**Step 5: Commit**

```bash
git add frontend/src/components/admin/IssueManagementPanel.tsx \
       frontend/src/components/admin/__tests__/IssueManagementPanel.test.tsx
git commit -m "[frontend] Add Issue Management panel with demo data (Phase A)"
```

---

## Task 6: Configuration & Rules Panel

**Files:**
- Create: `frontend/src/hooks/useKBRules.ts`
- Create: `frontend/src/components/admin/ConfigRulesPanel.tsx` (replace stub)
- Create: `frontend/src/components/admin/__tests__/ConfigRulesPanel.test.tsx`
- Modify: `frontend/src/components/admin/ServiceHealthDashboard.tsx` (remove FeatureBurndown)

**Reference:** KB rules API: `GET /api/v1/kb/rules?domain=&limit=50`. KB API client in `frontend/src/lib/kbApi.ts` (if exists) or create. FeatureBurndown in `frontend/src/components/admin/FeatureBurndown.tsx`.

**Step 1: Check if kbApi.ts exists and has rules endpoint**

Run: `ls frontend/src/lib/kbApi.ts 2>/dev/null && echo exists || echo missing`

If missing, create it following the `dqApi.ts` pattern. If it exists, add a `listRules` method.

**Step 2: Write the hook**

```typescript
// frontend/src/hooks/useKBRules.ts
import { useQuery } from '@tanstack/react-query';
import { kbAPI } from '@/lib/kbApi';

export function useKBRules(domain?: string) {
  return useQuery({
    queryKey: ['kb', 'rules', domain],
    queryFn: () => kbAPI.listRules({ domain, limit: 100 }),
    staleTime: 5 * 60_000,
  });
}
```

**Step 3: Write the test**

```tsx
// frontend/src/components/admin/__tests__/ConfigRulesPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ConfigRulesPanel from '../ConfigRulesPanel';

const mockUseKBRules = vi.fn();
vi.mock('@/hooks/useKBRules', () => ({
  useKBRules: (...args: unknown[]) => mockUseKBRules(...args),
}));

const MOCK_RULES = {
  items: [
    { ruleId: 'r1', domain: 'eligibility', title: 'Rule of 75', description: 'Age + service >= 75, min age 55', tier: 'T1/T2' },
    { ruleId: 'r2', domain: 'benefit-calc', title: 'AMS Window', description: 'Highest 36 consecutive months', tier: 'T1/T2' },
    { ruleId: 'r3', domain: 'benefit-calc', title: 'Multiplier', description: '2.0% for Tier 1', tier: 'T1' },
  ],
  pagination: { total: 3, limit: 100, offset: 0, hasMore: false },
};

describe('ConfigRulesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseKBRules.mockReturnValue({ data: MOCK_RULES, isLoading: false, isError: false });
  });

  it('renders plan provisions section', () => {
    renderWithProviders(<ConfigRulesPanel />);
    expect(screen.getByText(/plan provisions/i)).toBeInTheDocument();
  });

  it('renders system parameters table', () => {
    renderWithProviders(<ConfigRulesPanel />);
    expect(screen.getByText(/system parameters/i)).toBeInTheDocument();
    expect(screen.getByText(/SLA/)).toBeInTheDocument();
  });

  it('renders service catalog (FeatureBurndown)', () => {
    renderWithProviders(<ConfigRulesPanel />);
    expect(screen.getByText('Platform Completion')).toBeInTheDocument();
  });

  it('groups rules by domain', () => {
    renderWithProviders(<ConfigRulesPanel />);
    expect(screen.getByText(/eligibility/i)).toBeInTheDocument();
    expect(screen.getByText(/benefit/i)).toBeInTheDocument();
  });

  it('handles loading state', () => {
    mockUseKBRules.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithProviders(<ConfigRulesPanel />);
    expect(screen.getByText(/system parameters/i)).toBeInTheDocument();
  });
});
```

**Step 4: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/ConfigRulesPanel.test.tsx`
Expected: FAIL — component is stub

**Step 5: Implement ConfigRulesPanel**

Replace stub with:
- Plan provisions: expandable tree grouped by `domain` field, each rule shows title + description
- System parameters table: hardcoded curated list (SLA targets 30/60/90d, DQ target 95%, health poll 10s, employee/employer contribution rates 8.45%/17.95%)
- Service catalog: render `<FeatureBurndown />` component (moved from Health tab)
- Search/filter for rules by domain dropdown

**Step 6: Remove FeatureBurndown from ServiceHealthDashboard**

In `frontend/src/components/admin/ServiceHealthDashboard.tsx`:
- Remove the FeatureBurndown import and its wrapping `<div>` block (lines ~146-153)
- This keeps the Health tab focused on live operational monitoring

**Step 7: Run tests**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/ConfigRulesPanel.test.tsx`
Expected: PASS (5 tests)

Run: `cd frontend && npx vitest run src/components/admin/__tests__/ServiceHealthDashboard.test.tsx`
Expected: PASS — update this test if it asserts FeatureBurndown presence (remove that assertion)

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean

**Step 8: Commit**

```bash
git add frontend/src/hooks/useKBRules.ts \
       frontend/src/components/admin/ConfigRulesPanel.tsx \
       frontend/src/components/admin/__tests__/ConfigRulesPanel.test.tsx \
       frontend/src/components/admin/ServiceHealthDashboard.tsx \
       frontend/src/components/admin/__tests__/ServiceHealthDashboard.test.tsx
git commit -m "[frontend] Add Configuration & Rules panel, relocate FeatureBurndown from Health tab"
```

---

## Task 7: Full Regression + Cleanup

**Files:**
- Modify: `frontend/src/components/__tests__/StaffPortal.test.tsx` (update for new tab structure)

**Step 1: Run full frontend test suite**

Run: `cd frontend && npx vitest run`
Expected: All tests pass. If StaffPortal tests fail due to removed `dq` tab or renamed label, update them.

**Step 2: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean

**Step 3: Run production build**

Run: `cd frontend && npm run build`
Expected: Clean build

**Step 4: Fix any regressions**

If StaffPortal tests reference `'Data Quality'` as a sidebar item or `'Platform Health'` as the label, update to reflect the new structure:
- `'Platform Health'` → `'Services Hub'`
- `'Data Quality'` tab no longer in sidebar (it's a sub-tab inside Services Hub)

**Step 5: Remove dead code**

- `frontend/src/components/admin/ServiceMap.tsx` — the static service map is fully replaced by the dashboard. Consider removing if no other component imports it. Check first:
  Run: `grep -r 'ServiceMap' frontend/src --include='*.tsx' --include='*.ts' | grep -v __tests__ | grep -v ServiceMapLayers | grep -v ServiceHealthDashboard`
  If only test file references it, it can stay for now. If nothing references it, delete both `ServiceMap.tsx` and its test.

**Step 6: Commit**

```bash
git add -A
git commit -m "[frontend] Fix test regressions, update StaffPortal for Services Hub"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `cd frontend && npx tsc --noEmit` — clean
- [ ] `cd frontend && npx vitest run` — all tests pass
- [ ] `cd frontend && npm run build` — production build clean
- [ ] ServicesHub renders 7 tabs, each loads correct panel
- [ ] Health tab shows live service monitoring (no FeatureBurndown)
- [ ] Data Quality tab shows DQ panel (same as before)
- [ ] Audit Trail tab shows entries from CRM audit API
- [ ] Metrics tab shows pipeline, SLA, volume, commitments
- [ ] Security tab shows role definitions and access matrix
- [ ] Issues tab shows demo data with filters and expandable detail
- [ ] Config tab shows rules tree, system parameters, and FeatureBurndown
- [ ] StaffPortal sidebar shows "Services Hub" (no separate "Data Quality" entry)
- [ ] No TypeScript errors, no test regressions
