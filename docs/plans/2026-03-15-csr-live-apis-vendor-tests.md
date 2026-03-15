# CSR Context Hub Live API Integration + Vendor Portal Tests

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire CSRContextHub to live backend APIs (member search, benefit data, CRM, case management) with a working Log Call button that creates CRM interactions, and add component tests for both CSRContextHub and VendorPortal.

**Architecture:** CSRContextHub gets a new aggregating hook (`useCSRContext`) that composes existing API hooks into card data. The component replaces its hardcoded MEMBERS array with the live `MemberSearch` component. The Log Call button uses the existing `useCreateInteraction` mutation. VendorPortal keeps its demo data but gets a full test suite.

**Tech Stack:** React, TypeScript, Vitest, React Testing Library, React Query, existing CRM/dataaccess/intelligence hooks.

---

## Workstream A — CSRContextHub Live API Integration

### Task 1: Create useCSRContext aggregating hook

**Files:**
- Create: `frontend/src/hooks/useCSRContext.ts`

**Step 1: Create the hook file**

This hook is a lightweight version of `useMemberDashboard` — it fetches only what the 8 context cards need. It returns formatted card objects ready for rendering.

```typescript
import { useMemo } from 'react';
import { useMember, useServiceCredit, useBeneficiaries } from '@/hooks/useMember';
import { useEligibility } from '@/hooks/useBenefitCalculation';
import { useContactByMemberId, useFullTimeline } from '@/hooks/useCRM';
import { useMemberCases } from '@/hooks/useCaseManagement';

export interface CSRCard {
  icon: string;
  title: string;
  content: string;
  highlight?: boolean;
}

export function useCSRContext(memberId: number | null) {
  const enabled = memberId !== null && memberId > 0;
  const mid = memberId ?? 0;

  // Data hooks — each is enabled only when we have a valid memberId
  const member = useMember(mid);
  const serviceCredit = useServiceCredit(mid);
  const beneficiaries = useBeneficiaries(mid);
  const eligibility = useEligibility(mid);
  const casesQuery = useMemberCases(mid);
  const contact = useContactByMemberId(enabled ? String(mid) : '');
  const contactId = contact.data?.contactId ?? '';
  const timeline = useFullTimeline(contactId);

  const cards: CSRCard[] = useMemo(() => {
    if (!enabled || !member.data) return [];

    const m = member.data;
    const cases = casesQuery.data ?? [];
    const activeCaseCount = cases.length;
    const highPriority = cases.filter(c => c.priority === 'urgent' || c.priority === 'high');

    // Open Tasks card
    const taskContent = activeCaseCount === 0
      ? 'No open tasks'
      : `${activeCaseCount} active case${activeCaseCount !== 1 ? 's' : ''}${highPriority.length > 0 ? ` (${highPriority.length} high priority)` : ''}`;

    // Recent Activity card
    const entries = timeline.data?.timelineEntries ?? [];
    const lastEntry = entries[0];
    const activityContent = lastEntry
      ? `${lastEntry.summary ?? lastEntry.channel} — ${new Date(lastEntry.startedAt).toLocaleDateString()}`
      : 'No recent activity';

    // Benefit Estimate card
    const elig = eligibility.data;
    const benefitContent = elig?.monthlyBenefit
      ? `$${Number(elig.monthlyBenefit).toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo`
      : 'Not yet calculated';

    // Service Credit card
    const sc = serviceCredit.data?.summary;
    const scContent = sc
      ? `${sc.earnedYears}y ${sc.earnedMonths}m earned${sc.purchasedYears ? ` + ${sc.purchasedYears}y purchased` : ''}`
      : 'Loading...';

    // Contributions card
    const contribContent = m.total_contributions != null
      ? `$${Number(m.total_contributions).toLocaleString('en-US', { minimumFractionDigits: 2 })} total contributions`
      : 'Not available';

    // Beneficiary card
    const bens = beneficiaries.data ?? [];
    const primary = bens.find(b => b.beneficiaryType === 'primary' || b.beneficiaryType === 'Primary');
    const benContent = primary
      ? `${primary.firstName} ${primary.lastName} (${primary.relationship ?? 'beneficiary'})`
      : bens.length > 0
        ? `${bens.length} beneficiar${bens.length !== 1 ? 'ies' : 'y'} on file`
        : 'No beneficiary on file ⚠';

    // Contact Info card
    const c = contact.data;
    const contactParts: string[] = [];
    if (c?.primaryPhone) contactParts.push(c.primaryPhone);
    if (c?.primaryEmail) contactParts.push(c.primaryEmail);
    const contactContent = contactParts.length > 0 ? contactParts.join(' · ') : 'No contact info';

    // Documents card — count documents from cases (case document count is not exposed per-member, use case count as proxy)
    const docContent = `${activeCaseCount} active case${activeCaseCount !== 1 ? 's' : ''} on file`;

    return [
      { icon: '📥', title: 'Open Tasks', content: taskContent, highlight: highPriority.length > 0 },
      { icon: '🕒', title: 'Recent Activity', content: activityContent },
      { icon: '📊', title: 'Benefit Estimate', content: benefitContent },
      { icon: '🏅', title: 'Service Credit', content: scContent },
      { icon: '💰', title: 'Contributions', content: contribContent },
      { icon: '👥', title: 'Beneficiary Info', content: benContent, highlight: !primary && bens.length === 0 },
      { icon: '📄', title: 'Cases', content: docContent },
      { icon: '📧', title: 'Contact Info', content: contactContent },
    ];
  }, [enabled, member.data, casesQuery.data, timeline.data, eligibility.data, serviceCredit.data, beneficiaries.data, contact.data]);

  return {
    cards,
    contactId,
    member: member.data,
    isLoading: enabled && member.isLoading,
    isLoadingSecondary: enabled && (
      serviceCredit.isLoading || beneficiaries.isLoading || eligibility.isLoading ||
      contact.isLoading || casesQuery.isLoading || timeline.isLoading
    ),
    error: member.error,
  };
}
```

**Step 2: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (no new type errors)

**Step 3: Commit**

```bash
git add frontend/src/hooks/useCSRContext.ts
git commit -m "[frontend] Add useCSRContext aggregating hook for CSR context cards"
```

---

### Task 2: Create useLogCall mutation hook

**Files:**
- Create: `frontend/src/hooks/useLogCall.ts`

**Step 1: Create the hook file**

A thin wrapper around `useCreateInteraction` that defaults to phone_inbound + inquiry for the Log Call flow. Returns the mutation and a `logCall(contactId, summary)` helper.

```typescript
import { useCreateInteraction } from '@/hooks/useCRM';

/**
 * Log Call mutation for CSR Context Hub.
 * Creates a CRM interaction with phone_inbound channel.
 */
export function useLogCall() {
  const mutation = useCreateInteraction();

  const logCall = (contactId: string, summary: string) => {
    return mutation.mutateAsync({
      contactId,
      channel: 'phone_inbound',
      interactionType: 'inquiry',
      direction: 'inbound',
      summary,
      visibility: 'internal',
    });
  };

  return {
    logCall,
    isLogging: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    reset: mutation.reset,
  };
}
```

**Step 2: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/hooks/useLogCall.ts
git commit -m "[frontend] Add useLogCall CRM mutation hook"
```

---

### Task 3: Rewrite CSRContextHub to use live APIs

**Files:**
- Modify: `frontend/src/components/staff/CSRContextHub.tsx`

**Step 1: Rewrite the component**

Replace the hardcoded MEMBERS array and inline context cards with:
1. The existing `MemberSearch` component (already calls live API)
2. `useCSRContext(memberId)` for card data
3. `useLogCall()` for the Log Call button
4. A simple Log Call modal (text input + submit)

Key changes:
- Remove `MEMBERS` array entirely
- `useState<number | null>(null)` for `selectedMemberId` (numeric, from MemberSearch onSelect)
- Embed `<MemberSearch onSelect={setSelectedMemberId} />` in the search section
- Show member banner from `useCSRContext` member data
- Show context cards from `useCSRContext` cards array
- Log Call button opens a small inline form, on submit calls `logCall(contactId, summary)`
- Loading skeleton while data arrives

The full component is ~120 lines. The key structural change:

```typescript
import { useState } from 'react';
import MemberSearch from './MemberSearch';
import { useCSRContext } from '@/hooks/useCSRContext';
import { useLogCall } from '@/hooks/useLogCall';

const TIER_COLORS: Record<number, string> = {
  1: 'bg-blue-50 text-blue-700 border-blue-200',
  2: 'bg-amber-50 text-amber-700 border-amber-200',
  3: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function CSRContextHub() {
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [showLogCall, setShowLogCall] = useState(false);
  const [callNote, setCallNote] = useState('');
  const { cards, contactId, member, isLoading, isLoadingSecondary } = useCSRContext(selectedMemberId);
  const { logCall, isLogging, isSuccess } = useLogCall();

  const handleLogCall = async () => {
    if (!contactId || !callNote.trim()) return;
    await logCall(contactId, callNote.trim());
    setCallNote('');
    setShowLogCall(false);
  };

  // ... render MemberSearch, member banner, context cards, log call form
}
```

**Step 2: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/components/staff/CSRContextHub.tsx
git commit -m "[frontend] Wire CSRContextHub to live APIs with Log Call CRM action"
```

---

### Task 4: Write CSRContextHub tests

**Files:**
- Create: `frontend/src/components/staff/__tests__/CSRContextHub.test.tsx`

**Step 1: Write the test file**

Mock `useCSRContext`, `useLogCall`, and `useMemberSearch`. Test:
1. Renders search input (MemberSearch) initially
2. Shows empty state prompt when no member selected
3. After selection — member banner renders with name, tier, status
4. Context cards render with correct titles
5. Loading state shows skeleton
6. Log Call button opens form
7. Submitting log call form calls `logCall(contactId, summary)`
8. Log Call success dismisses form
9. Error state renders error message
10. Cards with `highlight` get amber border

Pattern: same mock-module pattern as MemberSearch.test.tsx.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import CSRContextHub from '../CSRContextHub';

// Mock data
const mockMember = {
  member_id: 10001,
  first_name: 'Robert',
  last_name: 'Martinez',
  tier: 1,
  status: 'Active',
  department_name: 'Public Works',
};

const mockCards = [
  { icon: '📥', title: 'Open Tasks', content: '2 active cases (1 high priority)', highlight: true },
  { icon: '🕒', title: 'Recent Activity', content: 'phone_inbound — 3/14/2026' },
  { icon: '📊', title: 'Benefit Estimate', content: '$5,087.00/mo' },
  // ... remaining cards
];

// Mock hooks
let csrContextReturn = { cards: [], contactId: '', member: null, isLoading: false, isLoadingSecondary: false, error: null };
let logCallReturn = { logCall: vi.fn(), isLogging: false, isSuccess: false, error: null, reset: vi.fn() };

vi.mock('@/hooks/useCSRContext', () => ({
  useCSRContext: () => csrContextReturn,
}));

vi.mock('@/hooks/useLogCall', () => ({
  useLogCall: () => logCallReturn,
}));

vi.mock('@/hooks/useMemberSearch', () => ({
  useMemberSearch: () => ({ query: '', setQuery: vi.fn(), results: [], loading: false, error: null }),
}));

describe('CSRContextHub', () => {
  beforeEach(() => {
    csrContextReturn = { cards: [], contactId: '', member: null, isLoading: false, isLoadingSecondary: false, error: null };
    logCallReturn = { logCall: vi.fn().mockResolvedValue({}), isLogging: false, isSuccess: false, error: null, reset: vi.fn() };
  });

  it('renders search and empty state when no member selected', () => { ... });
  it('renders member banner after selection', () => { ... });
  it('renders context cards from hook data', () => { ... });
  it('shows loading skeleton while data loads', () => { ... });
  it('opens log call form on button click', () => { ... });
  it('calls logCall mutation on form submit', () => { ... });
  it('highlights cards with highlight flag', () => { ... });
  it('shows error state', () => { ... });
});
```

**Step 2: Run tests**

Run: `cd frontend && npx vitest run src/components/staff/__tests__/CSRContextHub.test.tsx`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add frontend/src/components/staff/__tests__/CSRContextHub.test.tsx
git commit -m "[frontend] Add CSRContextHub component tests (8 tests)"
```

---

### Task 5: Write useCSRContext hook tests

**Files:**
- Create: `frontend/src/hooks/__tests__/useCSRContext.test.ts`

**Step 1: Write hook unit tests**

Use `@testing-library/react` `renderHook` with QueryClientProvider wrapper. Mock the underlying hooks (`useMember`, `useServiceCredit`, etc.) to return controlled data.

Tests:
1. Returns empty cards when memberId is null
2. Returns loading state when member is loading
3. Returns 8 formatted cards when data is available
4. Formats service credit correctly (earned + purchased)
5. Shows "No beneficiary on file" when no beneficiaries
6. Shows primary beneficiary name when present
7. Formats benefit estimate as currency
8. Returns contactId from CRM contact lookup

**Step 2: Run tests**

Run: `cd frontend && npx vitest run src/hooks/__tests__/useCSRContext.test.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add frontend/src/hooks/__tests__/useCSRContext.test.ts
git commit -m "[frontend] Add useCSRContext hook tests (8 tests)"
```

---

## Workstream B — Vendor Portal Tests

### Task 6: Write VendorPortal component tests

**Files:**
- Create: `frontend/src/components/portal/__tests__/VendorPortal.test.tsx`

**Step 1: Write the test file**

VendorPortal is 100% static demo data — no hooks to mock. Tests verify rendering:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import VendorPortal from '../VendorPortal';

describe('VendorPortal', () => {
  it('renders header with Vendor Portal title', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText('Vendor Portal')).toBeInTheDocument();
  });

  it('renders three stats cards', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText('Pending Enrollments')).toBeInTheDocument();
    expect(screen.getByText('Enrolled This Month')).toBeInTheDocument();
    expect(screen.getByText('Avg IPR Benefit')).toBeInTheDocument();
  });

  it('renders enrollment queue with 4 records', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText('Robert Martinez')).toBeInTheDocument();
    expect(screen.getByText('David Washington')).toBeInTheDocument();
    expect(screen.getByText('Patricia Morales')).toBeInTheDocument();
    expect(screen.getByText('James Butler')).toBeInTheDocument();
  });

  it('displays IPR amounts formatted as currency', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText('$359.38')).toBeInTheDocument();
    expect(screen.getByText('$169.75')).toBeInTheDocument();
  });

  it('renders status badges with correct text', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText('Pending Verification')).toBeInTheDocument();
    expect(screen.getAllByText('Enrolled')).toHaveLength(2);
    expect(screen.getByText('Pending Docs')).toBeInTheDocument();
  });

  it('renders enrollment IDs and plan names', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText(/ENR-2026-0041/)).toBeInTheDocument();
    expect(screen.getByText(/Kaiser HMO/)).toBeInTheDocument();
    expect(screen.getByText(/Cigna PPO/)).toBeInTheDocument();
  });

  it('renders footer with vendor identifier', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText(/Kaiser Permanente/)).toBeInTheDocument();
  });

  it('shows back button when onChangeView is provided', () => {
    const onChangeView = vi.fn();
    renderWithProviders(<VendorPortal onChangeView={onChangeView} />);
    const backBtn = screen.getByText(/Back to Staff/);
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(onChangeView).toHaveBeenCalledWith('staff');
  });

  it('does not show back button when onChangeView is not provided', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.queryByText(/Back to Staff/)).not.toBeInTheDocument();
  });

  it('renders user avatar with initials', () => {
    renderWithProviders(<VendorPortal />);
    expect(screen.getByText('JP')).toBeInTheDocument();
    expect(screen.getByText('James Park')).toBeInTheDocument();
  });
});
```

**Step 2: Run tests**

Run: `cd frontend && npx vitest run src/components/portal/__tests__/VendorPortal.test.tsx`
Expected: All 10 tests PASS

**Step 3: Commit**

```bash
git add frontend/src/components/portal/__tests__/VendorPortal.test.tsx
git commit -m "[frontend] Add VendorPortal component tests (10 tests)"
```

---

## Task 7: Run full test suite + typecheck

**Step 1: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 2: Full test suite**

Run: `cd frontend && npx vitest run`
Expected: All tests pass, including ~355 existing + ~26 new = ~381 total

**Step 3: Final commit (if any adjustments needed)**

---

## Summary

| Task | Files | Tests Added | Commits |
|------|-------|-------------|---------|
| 1. useCSRContext hook | 1 new | 0 | 1 |
| 2. useLogCall hook | 1 new | 0 | 1 |
| 3. CSRContextHub rewrite | 1 modified | 0 | 1 |
| 4. CSRContextHub tests | 1 new | ~8 | 1 |
| 5. useCSRContext tests | 1 new | ~8 | 1 |
| 6. VendorPortal tests | 1 new | 10 | 1 |
| 7. Full verification | 0 | 0 | 0 |
| **Total** | **5 new, 1 modified** | **~26** | **6** |
