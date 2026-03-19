# Visual Polish + Clerk Event Types Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix DQ score formatting, add cross-service audit trail (CRM + security events merged in frontend), and extend Clerk webhook event type mappings.

**Architecture:** Three independent changes — one frontend formatting fix, one frontend data aggregation enhancement, one backend switch statement extension. No new services, no new dependencies, no migrations.

**Tech Stack:** React/TypeScript (frontend), Go (security service)

---

## Task 1: Fix DQ Score Formatting in OperationalMetricsPanel

**Files:**
- Modify: `frontend/src/components/admin/OperationalMetricsPanel.tsx:47`
- Modify: `frontend/src/components/admin/__tests__/OperationalMetricsPanel.test.tsx`

**Step 1: Write the failing test**

Add to `OperationalMetricsPanel.test.tsx` inside the existing `describe` block:

```typescript
it('formats DQ Score to 1 decimal place', () => {
  mockDQScore.mockReturnValue({ data: { overallScore: 98.61538461538461 }, isLoading: false });
  renderWithProviders(<OperationalMetricsPanel />);
  expect(screen.getByText('98.6%')).toBeInTheDocument();
  expect(screen.queryByText(/98\.615/)).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/OperationalMetricsPanel.test.tsx`
Expected: FAIL — the component renders `98.61538461538461%` not `98.6%`

**Step 3: Fix the formatting**

In `OperationalMetricsPanel.tsx` line 47, change:

```typescript
// FROM:
const dqValue = dqScore ? `${dqScore.overallScore}%` : dash;

// TO:
const dqValue = dqScore ? `${dqScore.overallScore.toFixed(1)}%` : dash;
```

Note: Other panels already use `.toFixed(1)` or `.toFixed(0)` — `DataQualityPanel.tsx:63`, `DataQualityCard.tsx:95`, `ExecutiveDashboard.tsx:65`. Only `OperationalMetricsPanel` was missing it.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/admin/__tests__/OperationalMetricsPanel.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add frontend/src/components/admin/OperationalMetricsPanel.tsx frontend/src/components/admin/__tests__/OperationalMetricsPanel.test.tsx
git commit -m "[frontend] Fix DQ score display — round to 1 decimal place"
```

---

## Task 2: Cross-Service Audit Trail (CRM + Security Events)

The AuditTrailPanel currently only queries CRM audit entries. We'll add security events as a second data source, merged and sorted by timestamp in the frontend.

**Files:**
- Modify: `frontend/src/components/admin/AuditTrailPanel.tsx`
- Modify: `frontend/src/components/admin/__tests__/AuditTrailPanel.test.tsx`

### Step 1: Write failing tests

Add new tests to `AuditTrailPanel.test.tsx`. First, add the security events mock setup alongside the existing audit mock:

```typescript
// Add near top with other mocks:
const mockUseSecurityEvents = vi.fn();
vi.mock('@/hooks/useSecurityEvents', () => ({
  useSecurityEvents: (...args: unknown[]) => mockUseSecurityEvents(...args),
}));

const MOCK_SECURITY_EVENTS = {
  items: [
    {
      id: 101,
      tenantId: 't1',
      eventType: 'login_success',
      actorId: 'user-abc',
      actorEmail: 'alice@example.com',
      ipAddress: '10.0.0.1',
      userAgent: 'Chrome',
      metadata: '{}',
      createdAt: '2026-03-17T14:35:00Z',
    },
    {
      id: 102,
      tenantId: 't1',
      eventType: 'session_end',
      actorId: 'user-xyz',
      actorEmail: 'bob@example.com',
      ipAddress: '10.0.0.2',
      userAgent: 'Firefox',
      metadata: '{}',
      createdAt: '2026-03-17T14:25:00Z',
    },
  ],
  pagination: { total: 2, limit: 25, offset: 0, hasMore: false },
};
```

Update `beforeEach` to also set the security mock default:

```typescript
mockUseSecurityEvents.mockReturnValue({ data: MOCK_SECURITY_EVENTS, isLoading: false, isError: false });
```

Add these new tests:

```typescript
it('renders security events alongside CRM audit entries', () => {
  renderWithProviders(<AuditTrailPanel />);
  // CRM entry
  expect(screen.getByText(/Updated phone number/)).toBeInTheDocument();
  // Security entry
  expect(screen.getByText(/login_success/)).toBeInTheDocument();
});

it('sorts merged entries by timestamp descending (newest first)', () => {
  renderWithProviders(<AuditTrailPanel />);
  const items = screen.getAllByRole('listitem');
  // Security event at 14:35 should be first, CRM at 14:32, then security 14:25, CRM 14:28
  // Order: 14:35 (security login_success), 14:32 (CRM UPDATE), 14:28 (CRM CREATE), 14:25 (security session_end)
  const texts = items.map((li) => li.textContent);
  const loginIdx = texts.findIndex((t) => t?.includes('login_success'));
  const updateIdx = texts.findIndex((t) => t?.includes('Updated phone'));
  expect(loginIdx).toBeLessThan(updateIdx);
});

it('shows source badge to distinguish CRM vs Security entries', () => {
  renderWithProviders(<AuditTrailPanel />);
  expect(screen.getAllByText('CRM').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Security').length).toBeGreaterThan(0);
});

it('renders with only CRM data when security hook returns no data', () => {
  mockUseSecurityEvents.mockReturnValue({ data: undefined, isLoading: false, isError: true });
  renderWithProviders(<AuditTrailPanel />);
  expect(screen.getByText(/Updated phone number/)).toBeInTheDocument();
});

it('renders with only security data when CRM hook returns no data', () => {
  mockUseAuditLog.mockReturnValue({ data: undefined, isLoading: false, isError: true });
  renderWithProviders(<AuditTrailPanel />);
  expect(screen.getByText(/login_success/)).toBeInTheDocument();
});
```

### Step 2: Run tests to verify they fail

Run: `cd frontend && npx vitest run src/components/admin/__tests__/AuditTrailPanel.test.tsx`
Expected: FAIL — component doesn't import or render security events

### Step 3: Implement the cross-service merge

In `AuditTrailPanel.tsx`:

1. Add the security events import:

```typescript
import { useSecurityEvents } from '@/hooks/useSecurityEvents';
import type { SecurityEvent } from '@/lib/securityApi';
```

2. Add a union type and adapter inside the component file (above `AuditTrailPanel`):

```typescript
interface UnifiedAuditEntry {
  id: string;           // unique key for React
  source: 'CRM' | 'Security';
  eventType: string;
  entityOrActor: string;  // entityType for CRM, actorEmail/actorId for security
  agentId: string;
  summary: string;
  eventTime: string;
  // Original data for detail expansion
  crmEntry?: AuditEntry;
  securityEntry?: SecurityEvent;
}

function adaptCRMEntry(e: AuditEntry): UnifiedAuditEntry {
  return {
    id: `crm-${e.auditId}`,
    source: 'CRM',
    eventType: e.eventType,
    entityOrActor: e.entityType,
    agentId: e.agentId,
    summary: e.summary,
    eventTime: e.eventTime,
    crmEntry: e,
  };
}

function adaptSecurityEntry(e: SecurityEvent): UnifiedAuditEntry {
  return {
    id: `sec-${e.id}`,
    source: 'Security',
    eventType: e.eventType,
    entityOrActor: e.actorEmail || e.actorId,
    agentId: e.actorId,
    summary: `${e.eventType} — ${e.actorEmail || e.actorId}${e.ipAddress ? ` from ${e.ipAddress}` : ''}`,
    eventTime: e.createdAt,
    securityEntry: e,
  };
}
```

3. Inside the component, add the security query and merge logic:

```typescript
const { data: secData, isLoading: secLoading, isError: secError } = useSecurityEvents({ limit: PAGE_SIZE });
```

4. Replace the `filteredItems` useMemo with a unified merge:

```typescript
const mergedItems = useMemo(() => {
  const crmItems = data?.items?.map(adaptCRMEntry) ?? [];
  const secItems = secData?.items?.map(adaptSecurityEntry) ?? [];
  const all = [...crmItems, ...secItems];
  // Sort by eventTime descending (newest first)
  all.sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime());
  return all;
}, [data, secData]);

const filteredItems = useMemo(() => {
  let items = mergedItems;

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    items = items.filter((e) => e.summary.toLowerCase().includes(term));
  }

  const cutoff = getDateCutoff(dateRange);
  if (cutoff) {
    items = items.filter((e) => new Date(e.eventTime) >= cutoff);
  }

  if (agentFilter) {
    const agent = agentFilter.toLowerCase();
    items = items.filter((e) => e.agentId.toLowerCase().includes(agent));
  }

  return items;
}, [mergedItems, searchTerm, dateRange, agentFilter]);
```

5. Update the loading/error states to account for both sources:

```typescript
const isLoading = (data === undefined && !isError) || (secData === undefined && !secError);
const bothFailed = isError && secError;
```

6. Update the rendered list to use `UnifiedAuditEntry` — key by `entry.id`, show a source badge:

```tsx
<span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
  entry.source === 'CRM' ? 'bg-gray-100 text-gray-700' : 'bg-violet-100 text-violet-700'
}`}>
  {entry.source}
</span>
```

7. Update `EntryDetail` to handle both CRM field changes and security metadata.

8. Update `exportToCSV` to work with `UnifiedAuditEntry`.

### Step 4: Run tests to verify they pass

Run: `cd frontend && npx vitest run src/components/admin/__tests__/AuditTrailPanel.test.tsx`
Expected: All tests PASS (old + new)

### Step 5: Run full frontend test suite

Run: `cd frontend && npx vitest run`
Expected: 1,630+ tests PASS, zero regressions

### Step 6: Commit

```bash
git add frontend/src/components/admin/AuditTrailPanel.tsx frontend/src/components/admin/__tests__/AuditTrailPanel.test.tsx
git commit -m "[frontend] Add cross-service audit trail — merge CRM + security events"
```

---

## Task 3: Add Clerk Webhook Event Type Mappings

Extend the security service to map 5 additional Clerk event types.

**Files:**
- Modify: `platform/security/models/types.go:77-84` — add new event type constants
- Modify: `platform/security/api/handlers.go:254-267` — extend `mapClerkEventType` switch
- Modify: `platform/security/api/handlers_test.go:715-733` — extend `TestMapClerkEventType` table

### Step 1: Write the failing tests

Extend the `TestMapClerkEventType` table in `handlers_test.go`:

```go
func TestMapClerkEventType(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		// Existing mappings
		{"user.signed_in", "login_success"},
		{"session.created", "session_start"},
		{"session.ended", "session_end"},
		{"user.updated", "role_change"},
		// New mappings
		{"user.created", "account_created"},
		{"user.deleted", "account_deleted"},
		{"session.revoked", "session_revoked"},
		{"organization.membership.created", "org_member_added"},
		{"organization.membership.deleted", "org_member_removed"},
		// Still unknown
		{"unknown.event", ""},
	}

	for _, tt := range tests {
		got := mapClerkEventType(tt.input)
		if got != tt.want {
			t.Errorf("mapClerkEventType(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
```

### Step 2: Run test to verify it fails

Run: `cd platform/security && go test ./... -short -run TestMapClerkEventType -v`
Expected: FAIL — new mappings return ""

### Step 3: Add new event types to the model

In `platform/security/models/types.go`, extend `EventTypeValues`:

```go
var EventTypeValues = []string{
	"login_success",
	"login_failure",
	"role_change",
	"session_start",
	"session_end",
	"password_reset",
	"account_created",
	"account_deleted",
	"session_revoked",
	"org_member_added",
	"org_member_removed",
}
```

### Step 4: Extend the mapping function

In `platform/security/api/handlers.go`, update `mapClerkEventType`:

```go
func mapClerkEventType(clerkType string) string {
	switch clerkType {
	case "user.signed_in":
		return "login_success"
	case "session.created":
		return "session_start"
	case "session.ended":
		return "session_end"
	case "user.updated":
		return "role_change"
	case "user.created":
		return "account_created"
	case "user.deleted":
		return "account_deleted"
	case "session.revoked":
		return "session_revoked"
	case "organization.membership.created":
		return "org_member_added"
	case "organization.membership.deleted":
		return "org_member_removed"
	default:
		return ""
	}
}
```

### Step 5: Run tests to verify they pass

Run: `cd platform/security && go test ./... -short -v`
Expected: All tests PASS

### Step 6: Verify the existing `TestClerkWebhook_UnrecognizedType` test still passes

The test uses `"organization.created"` which is NOT in our mapping (we map `"organization.membership.created"` instead). This test should still return `"ignored"`. Confirm it passes.

### Step 7: Commit

```bash
git add platform/security/models/types.go platform/security/api/handlers.go platform/security/api/handlers_test.go
git commit -m "[platform/security] Add 5 Clerk webhook event type mappings"
```

---

## Task 4: Final Verification

### Step 1: Run full frontend suite

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: Typecheck clean, 1,630+ tests PASS

### Step 2: Run security service tests

Run: `cd platform/security && go test ./... -short -v`
Expected: All PASS

### Step 3: Verify no regressions in other Go services

Run: `cd platform/issues && go test ./... -short`
Expected: PASS (unchanged service, just verifying)
